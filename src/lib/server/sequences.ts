import "server-only";
import type { User } from "@prisma/client";
import { db } from "./db";
import { notify, managersFor } from "./notifications";
import { sendDraft, sendingMailbox } from "./mailbox";
import { MailAuthError } from "../mail/http";
import { leadScope, canSendEmail } from "../access";
import { countryOfLead } from "../countries";
import { replySubject } from "../mail/mime";
import { EMAIL_RESTRICTED_COUNTRIES, SEQUENCE_LIMITS, nextRunAt, stopReason } from "../sequences";
import { OPT_OUT_LINE, leadMergeContext, renderTemplate, templateLanguage } from "../templates";
import { DEFAULT_TEMPLATES, DEFAULT_SEQUENCES } from "../outreachDefaults";

/** First visit to Outreach: add the starter templates and sequences (English + Thai). */
export async function ensureOutreachDefaults(userId: string) {
  if ((await db.emailTemplate.count()) > 0) return;
  const created = new Map<string, string>();
  for (const t of DEFAULT_TEMPLATES) {
    const row = await db.emailTemplate.create({ data: { name: t.name, category: t.category, language: t.language, subject: t.subject, body: t.body, createdById: userId } });
    created.set(t.key, row.id);
  }
  for (const s of DEFAULT_SEQUENCES) {
    await db.sequence.create({
      data: {
        name: s.name,
        description: s.description,
        createdById: userId,
        steps: { create: s.steps.map((st, i) => ({ position: i, waitDays: st.waitDays, templateId: created.get(st.template)! })) },
      },
    });
  }
}

export type EnrollResult = { enrolled: number; pending: number; skippedNoEmail: number; skippedRestricted: number; skippedAlready: number; skippedHidden: number };

/**
 * Puts leads into a sequence. Owners/team leads start it straight away; reps' enrolments wait for approval.
 * Leads in Germany/Austria are skipped unless explicitly included (cold email there needs consent).
 */
export async function enrollLeads(user: User, sequenceId: string, leadIds: string[], includeRestricted = false): Promise<EnrollResult> {
  const sequence = await db.sequence.findUnique({ where: { id: sequenceId }, include: { steps: { orderBy: { position: "asc" } } } });
  if (!sequence || !sequence.active || sequence.steps.length === 0) throw new Error("That sequence has no emails yet");
  const ids = [...new Set(leadIds)].slice(0, 1000);
  const leads = await db.lead.findMany({
    where: { AND: [{ id: { in: ids } }, leadScope(user)] },
    select: { id: true, email: true, location: true, industry: true, phone: true, company: true, enrollments: { where: { sequenceId }, select: { id: true, status: true } } },
  });
  const r: EnrollResult = { enrolled: 0, pending: 0, skippedNoEmail: 0, skippedRestricted: 0, skippedAlready: 0, skippedHidden: ids.length - leads.length };
  const direct = canSendEmail(user);
  const now = new Date();
  const firstRun = nextRunAt(now, sequence.steps[0].waitDays, now);

  for (const l of leads) {
    if (!l.email) { r.skippedNoEmail++; continue; }
    const country = countryOfLead(l)?.name ?? null;
    if (!includeRestricted && country && EMAIL_RESTRICTED_COUNTRIES.includes(country)) { r.skippedRestricted++; continue; }
    const existing = l.enrollments[0];
    if (existing && (existing.status === "ACTIVE" || existing.status === "PENDING_APPROVAL")) { r.skippedAlready++; continue; }
    const data = {
      enrolledById: user.id,
      approvedById: direct ? user.id : null,
      status: direct ? "ACTIVE" : "PENDING_APPROVAL",
      stepIndex: 0,
      nextRunAt: direct ? firstRun : null,
      lastSentAt: null,
      stopReason: null,
      createdAt: now,
    };
    if (existing) await db.sequenceEnrollment.update({ where: { id: existing.id }, data });
    else await db.sequenceEnrollment.create({ data: { ...data, sequenceId, leadId: l.id } });
    if (direct) r.enrolled++;
    else r.pending++;
  }
  if (r.pending > 0) {
    await notify(await managersFor(user.teamId), {
      type: "APPROVAL_NEEDED",
      title: `${user.name} wants to start “${sequence.name}” for ${r.pending} lead${r.pending === 1 ? "" : "s"}`,
      body: "Approve or reject on the Emails page.",
      href: "/emails",
    });
  }
  return r;
}

export async function approveEnrollments(user: User, ids: string[], approve: boolean) {
  if (!canSendEmail(user)) throw new Error("Only owners and team leads can approve");
  const rows = await db.sequenceEnrollment.findMany({
    where: { id: { in: ids }, status: "PENDING_APPROVAL", lead: leadScope(user) },
    include: { sequence: { include: { steps: { orderBy: { position: "asc" }, take: 1 } } } },
  });
  const now = new Date();
  for (const e of rows) {
    await db.sequenceEnrollment.update({
      where: { id: e.id },
      data: approve
        ? { status: "ACTIVE", approvedById: user.id, nextRunAt: nextRunAt(now, e.sequence.steps[0]?.waitDays ?? 0, now), createdAt: now }
        : { status: "STOPPED", stopReason: `Not approved by ${user.name}` },
    });
  }
  const byEnroller = new Map<string, number>();
  for (const e of rows) byEnroller.set(e.enrolledById, (byEnroller.get(e.enrolledById) ?? 0) + 1);
  for (const [uid, n] of byEnroller) {
    await notify(uid, { type: "APPROVAL_NEEDED", title: `${user.name} ${approve ? "approved" : "didn't approve"} ${n} sequence enrolment${n === 1 ? "" : "s"}`, href: "/outreach" });
  }
  return rows.length;
}

export async function stopEnrollment(user: User, id: string) {
  const e = await db.sequenceEnrollment.findFirst({ where: { id, lead: leadScope(user) } });
  if (!e) throw new Error("Not found");
  if (e.enrolledById !== user.id && !canSendEmail(user)) throw new Error("Only the person who started it or a manager can stop it");
  await db.sequenceEnrollment.update({ where: { id }, data: { status: "STOPPED", stopReason: `Stopped by ${user.name}`, nextRunAt: null } });
}

/** Called when a reply is logged: stops that lead's sequences at once and tells whoever started them. */
export async function stopSequencesOnReply(leadId: string, company: string) {
  const active = await db.sequenceEnrollment.findMany({ where: { leadId, status: "ACTIVE" }, include: { sequence: { select: { name: true } } } });
  if (!active.length) return;
  await db.sequenceEnrollment.updateMany({ where: { id: { in: active.map((a) => a.id) } }, data: { status: "REPLIED", stopReason: "They replied", nextRunAt: null } });
  for (const a of active) {
    await notify(a.enrolledById, { type: "SEQUENCE_REPLY", title: `${company} replied`, body: `“${a.sequence.name}” stopped automatically. Reply to keep the conversation going.`, href: `/leads/${leadId}#email` });
  }
}

export type RunResult = { sent: number; stopped: number; waiting: number; failed: number };

/** Sends every sequence email that's due, within per-mailbox limits. Safe to run every few minutes. */
export async function runDueSequences(budgetMs = 30_000): Promise<RunResult> {
  const started = Date.now();
  const now = new Date();
  const r: RunResult = { sent: 0, stopped: 0, waiting: 0, failed: 0 };
  const due = await db.sequenceEnrollment.findMany({
    where: { status: "ACTIVE", nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: 300,
    include: {
      sequence: { include: { steps: { orderBy: { position: "asc" }, include: { template: true } } } },
      lead: { select: { id: true, company: true, contactName: true, email: true, stage: true, lastReplyAt: true, location: true, website: true, industry: true, segment: true, whyFit: true, serviceInterest: true, phone: true } },
    },
  });
  const sentThisRun = new Map<string, number>();
  const sentToday = new Map<string, number>();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  for (const e of due) {
    if (Date.now() - started > budgetMs) break;
    const steps = e.sequence.steps;
    const country = countryOfLead(e.lead)?.name ?? null;
    const stop = stopReason(e, { stage: e.lead.stage, email: e.lead.email, lastReplyAt: e.lead.lastReplyAt, country }, steps.length);
    if (stop) {
      await db.sequenceEnrollment.update({ where: { id: e.id }, data: { status: stop.status, stopReason: stop.reason, nextRunAt: null } });
      if (stop.status === "FAILED") r.failed++;
      else r.stopped++;
      continue;
    }

    const author = await db.user.findUnique({ where: { id: e.enrolledById } });
    const mb = author ? await sendingMailbox(author.id, e.approvedById ?? author.id) : null;
    if (!author || !mb) {
      await db.sequenceEnrollment.update({ where: { id: e.id }, data: { nextRunAt: new Date(now.getTime() + 60 * 60_000), stopReason: "Waiting: connect Gmail or Outlook in Settings → Email" } });
      r.waiting++;
      continue;
    }
    if (!sentToday.has(mb.id)) {
      sentToday.set(mb.id, await db.activity.count({ where: { mailboxId: mb.id, type: "EMAIL_OUT", occurredAt: { gte: dayStart } } }));
    }
    if ((sentThisRun.get(mb.id) ?? 0) >= SEQUENCE_LIMITS.perRunPerMailbox || (sentToday.get(mb.id) ?? 0) >= SEQUENCE_LIMITS.perDayPerMailbox) {
      r.waiting++;
      continue; // stays due; picked up next run (or tomorrow)
    }

    const step = steps[e.stepIndex];
    const lang = templateLanguage(step.template.language);
    const ctx = leadMergeContext(e.lead, { name: author.name, email: mb.address });
    // Follow-ups go in the same thread as the first email.
    const previous = e.stepIndex > 0
      ? await db.emailDraft.findFirst({ where: { leadId: e.leadId, authorId: author.id, status: "SENT", createdAt: { gte: e.createdAt } }, orderBy: { createdAt: "asc" } })
      : null;
    const firstSubject = renderTemplate(steps[0].template.subject, ctx);
    const subject = previous ? replySubject(firstSubject) : renderTemplate(step.template.subject, ctx);
    const body = `${renderTemplate(step.template.body, ctx)}\n\n${OPT_OUT_LINE[lang]}`;
    const draft = await db.emailDraft.create({
      data: { leadId: e.leadId, authorId: author.id, to: e.lead.email!, subject, body, status: "DRAFT", replyToActivityId: previous?.sentActivityId ?? null },
    });
    try {
      await sendDraft(draft.id, e.approvedById ?? author.id);
      const next = e.stepIndex + 1;
      await db.sequenceEnrollment.update({
        where: { id: e.id },
        data: next >= steps.length
          ? { stepIndex: next, lastSentAt: new Date(), status: "COMPLETED", stopReason: "All emails sent", nextRunAt: null }
          : { stepIndex: next, lastSentAt: new Date(), stopReason: null, nextRunAt: nextRunAt(new Date(), steps[next].waitDays) },
      });
      sentThisRun.set(mb.id, (sentThisRun.get(mb.id) ?? 0) + 1);
      sentToday.set(mb.id, (sentToday.get(mb.id) ?? 0) + 1);
      r.sent++;
    } catch (err) {
      if (err instanceof MailAuthError) {
        await db.sequenceEnrollment.update({ where: { id: e.id }, data: { nextRunAt: new Date(now.getTime() + 60 * 60_000), stopReason: "Waiting: the mailbox needs reconnecting" } });
        r.waiting++;
      } else {
        await db.sequenceEnrollment.update({ where: { id: e.id }, data: { status: "FAILED", stopReason: String((err as Error).message).slice(0, 200), nextRunAt: null } });
        r.failed++;
      }
    }
  }
  return r;
}
