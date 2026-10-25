import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma, User } from "@prisma/client";
import { db } from "./db";
import { leadScope, canSendEmail, canSeeLead } from "../access";
import { notify, managersFor } from "./notifications";
import { logActivity } from "./activities";
import { publicBase } from "./quotes";
import { cleanDemoUrl, isDemoStatus, sanitizeTasks, starterBrief, starterTasks, type DemoTask } from "../demos";
import { quoteTotals, sanitizeItems } from "../quotes";
import { formatMoney } from "../domain";

/** Demos someone can see: on leads they can see, or assigned to them to build. */
export function demoScope(user: User): Prisma.DemoProjectWhereInput {
  const scope = leadScope(user);
  if (Object.keys(scope).length === 0) return {}; // owners see everything
  return { OR: [{ lead: { is: scope } }, { assignedToId: user.id }] };
}

export async function visibleDemo(user: User, id: string) {
  const d = await db.demoProject.findFirst({ where: { AND: [{ id }, demoScope(user)] }, include: { lead: { include: { owner: true } } } });
  if (!d) throw new Error("Demo not found");
  return d;
}

export async function createDemo(user: User, leadId: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { owner: true } });
  if (!lead || !canSeeLead(user, lead)) throw new Error("Lead not found");
  return db.demoProject.create({
    data: {
      leadId: lead.id,
      name: `${lead.company} – demo website`,
      brief: starterBrief(lead),
      tasks: starterTasks(lead.segment),
      createdById: user.id,
      token: randomBytes(24).toString("base64url"),
      dueAt: new Date(Date.now() + 3 * 86_400_000),
    },
  });
}

export type DemoPatch = {
  name?: string; status?: string; brief?: string; tasks?: DemoTask[]; assignedToId?: string | null; dueAt?: string | null; demoUrl?: string | null; quoteId?: string | null;
};

export async function updateDemo(user: User, id: string, patch: DemoPatch) {
  const d = await visibleDemo(user, id);
  const data: Prisma.DemoProjectUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name.trim().slice(0, 150) || d.name;
  if (patch.status !== undefined && isDemoStatus(patch.status)) data.status = patch.status;
  if (patch.brief !== undefined) data.brief = patch.brief.slice(0, 5000) || null;
  if (patch.tasks !== undefined) data.tasks = sanitizeTasks(patch.tasks);
  if (patch.dueAt !== undefined) data.dueAt = patch.dueAt ? new Date(patch.dueAt) : null;
  if (patch.demoUrl !== undefined) {
    const url = cleanDemoUrl(patch.demoUrl);
    if (patch.demoUrl && !url) throw new Error("That demo link isn't a web address");
    data.demoUrl = url;
  }
  if (patch.quoteId !== undefined) {
    if (patch.quoteId && !(await db.quote.findFirst({ where: { id: patch.quoteId, leadId: d.leadId } }))) throw new Error("That quote isn't on this lead");
    data.quoteId = patch.quoteId || null;
  }
  if (patch.assignedToId !== undefined && patch.assignedToId !== d.assignedToId) {
    const who = patch.assignedToId ? await db.user.findUnique({ where: { id: patch.assignedToId } }) : null;
    if (patch.assignedToId && !who) throw new Error("Unknown team member");
    data.assignedTo = who ? { connect: { id: who.id } } : { disconnect: true };
    if (who && who.id !== user.id) {
      await notify(who.id, { type: "LEAD_ASSIGNED", title: `${user.name} asked you to build a demo for ${d.lead.company}`, body: "The brief and checklist are on the Demos board.", href: `/demos?open=${d.id}` });
    }
  }
  // Ticking the last box moves a demo that's being built to "Ready to send".
  if (data.tasks && !patch.status && (d.status === "TODO" || d.status === "BUILDING")) {
    const t = data.tasks as DemoTask[];
    if (t.length && t.every((x) => x.done)) data.status = "READY";
    else if (d.status === "TODO" && t.some((x) => x.done)) data.status = "BUILDING";
  }
  return db.demoProject.update({ where: { id }, data });
}

export function demoLink(token: string, origin: string) {
  return `${publicBase(origin)}/demo/${token}`;
}

/**
 * Emails the client the demo page (demo + offer). Owners and team leads send straight away; reps' emails go
 * to a manager for approval. Logged as a proposal, so the deal moves to "Proposal sent".
 */
export async function sendDemo(user: User, id: string, opts: { subject: string; body: string; origin: string }) {
  const d = await visibleDemo(user, id);
  if (!d.demoUrl) throw new Error("Add the demo link first");
  if (!d.lead.email) throw new Error("This lead has no email address. Copy the client link and send it another way.");
  const link = demoLink(d.token, opts.origin);
  const body = opts.body.includes(link) ? opts.body : `${opts.body.trim()}\n\n${link}`;
  const direct = canSendEmail(user);
  const draft = await db.emailDraft.create({
    data: { leadId: d.leadId, authorId: user.id, to: d.lead.email, subject: opts.subject.trim().slice(0, 300) || `A demo website for ${d.lead.company}`, body, status: direct ? "DRAFT" : "AWAITING_APPROVAL" },
  });
  if (direct) {
    const { sendDraft } = await import("./mailbox");
    await sendDraft(draft.id, user.id);
  } else {
    await notify(await managersFor(user.teamId), { type: "APPROVAL_NEEDED", title: `${user.name} wants to send the ${d.lead.company} demo`, href: "/emails" });
  }
  const now = new Date();
  await db.demoProject.update({ where: { id }, data: { status: d.status === "INTERESTED" || d.status === "WON" ? d.status : "SENT", sentAt: d.sentAt ?? now } });
  await logActivity({ leadId: d.leadId, userId: user.id, type: "PROPOSAL", occurredAt: now, summary: `Demo sent: ${d.demoUrl}\nClient page: ${link}` });
  return { link, approval: !direct };
}

// ---------- Client page (/demo/<token>) ----------

export async function demoByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const d = await db.demoProject.findUnique({
    where: { token },
    include: { lead: { select: { id: true, company: true, contactName: true, ownerId: true, owner: { select: { name: true, email: true, teamId: true } } } } },
  });
  if (!d || !d.demoUrl) return null;
  const quote = d.quoteId ? await db.quote.findUnique({ where: { id: d.quoteId } }) : null;
  return { ...d, quote: quote && quote.status !== "DRAFT" ? quote : null };
}

export async function recordDemoView(token: string) {
  const d = await demoByToken(token);
  if (!d) return;
  const first = !d.viewedAt;
  await db.demoProject.update({ where: { id: d.id }, data: { viewCount: { increment: 1 }, viewedAt: d.viewedAt ?? new Date() } });
  if (first) {
    await notify([d.lead.ownerId ?? d.createdById, d.assignedToId], { type: "QUOTE_VIEWED", title: `${d.lead.company} opened their demo`, body: "Good moment to call them.", href: `/leads/${d.lead.id}#demos` });
  }
}

export async function markInterested(token: string, note: string) {
  const d = await demoByToken(token);
  if (!d) throw new Error("Demo not found");
  const now = new Date();
  const text = note.trim().slice(0, 1000);
  await db.demoProject.update({ where: { id: d.id }, data: { status: d.status === "WON" ? "WON" : "INTERESTED", interestedAt: d.interestedAt ?? now, clientNote: text || d.clientNote } });
  await db.lead.update({ where: { id: d.lead.id }, data: { lastReplyAt: now, nextFollowUpAt: now, unansweredTouches: 0 } });
  await db.activity.create({ data: { leadId: d.lead.id, type: "NOTE", source: "DEMO", summary: `Client wants to go ahead after seeing the demo${text ? `: “${text}”` : ""}`, occurredAt: now } });
  await db.sequenceEnrollment.updateMany({ where: { leadId: d.lead.id, status: "ACTIVE" }, data: { status: "REPLIED", stopReason: "Interested in the demo", nextRunAt: null } });
  await notify([d.lead.ownerId ?? d.createdById, d.assignedToId, ...(await managersFor(d.lead.owner?.teamId ?? null))], {
    type: "QUOTE_ACCEPTED",
    title: `🔥 ${d.lead.company} wants to go ahead`,
    body: text ? `“${text}”` : "They clicked “I'd like to go ahead” on their demo. Call them now.",
    href: `/leads/${d.lead.id}#demos`,
  });
}

/** When the deal is won, its demos are too. */
export async function markDemosWon(leadId: string) {
  await db.demoProject.updateMany({ where: { leadId, status: { notIn: ["WON", "LOST"] } }, data: { status: "WON" } });
}

/** Demos ready for the editor (with each lead's quotes as offer options). */
export async function loadDemoViews(where: Prisma.DemoProjectWhereInput, origin: string) {
  const rows = await db.demoProject.findMany({
    where,
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include: { lead: { select: { company: true, contactName: true, email: true } }, assignedTo: { select: { name: true } } },
    take: 300,
  });
  const quotes = await db.quote.findMany({ where: { leadId: { in: [...new Set(rows.map((r) => r.leadId))] } }, orderBy: { createdAt: "desc" } });
  return rows.map((d) => ({
    id: d.id,
    leadId: d.leadId,
    company: d.lead.company,
    contactName: d.lead.contactName,
    leadEmail: d.lead.email,
    name: d.name,
    status: d.status,
    brief: d.brief ?? "",
    tasks: sanitizeTasks(d.tasks),
    assignedToId: d.assignedToId,
    assignedToName: d.assignedTo?.name ?? null,
    dueAt: d.dueAt?.toISOString() ?? null,
    demoUrl: d.demoUrl,
    quoteId: d.quoteId,
    clientLink: demoLink(d.token, origin),
    sentAt: d.sentAt?.toISOString() ?? null,
    viewedAt: d.viewedAt?.toISOString() ?? null,
    viewCount: d.viewCount,
    interestedAt: d.interestedAt?.toISOString() ?? null,
    clientNote: d.clientNote,
    quotes: quotes.filter((q) => q.leadId === d.leadId).map((q) => {
      const t = quoteTotals(sanitizeItems(q.items), q.discount);
      return { id: q.id, label: `${q.number} · ${formatMoney(t.oneOff)}${t.monthly ? ` + ${formatMoney(t.monthly)}/mo` : ""}`, sent: q.status !== "DRAFT" };
    }),
  }));
}

/** Request origin for building client links inside server components. */
export async function requestOrigin() {
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}
