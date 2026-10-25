"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";
import { canManagePeople, canSendEmail } from "@/lib/access";
import { approveEnrollments, enrollLeads, runDueSequences, stopEnrollment } from "@/lib/server/sequences";
import { createQuote, sendQuote, updateQuote, visibleQuote } from "@/lib/server/quotes";
import { assignInboundLeads, saveAssignment } from "@/lib/server/assignment";
import { sanitizeAssignment } from "@/lib/assignment";
import { templateLanguage } from "@/lib/templates";
import { toMinor } from "@/lib/domain";

export type ActionResult = { ok?: boolean; error?: string; message?: string };
const fail = (e: unknown): ActionResult => ({ error: (e as Error).message || "Something went wrong" });

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ---------- Templates ----------

const targetList = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 80)).filter(Boolean))].slice(0, 40) : [];

export async function saveTemplate(input: { id?: string | null; name: string; category: string; language: string; subject: string; body: string; countries?: string[]; industries?: string[] }): Promise<ActionResult & { id?: string }> {
  const user = await requireUser();
  if (!canSendEmail(user)) return { error: "Only owners and team leads can edit templates" };
  const data = {
    name: input.name.trim().slice(0, 120),
    category: input.category.trim().slice(0, 60) || null,
    language: templateLanguage(input.language),
    subject: input.subject.replace(/[\r\n]+/g, " ").trim().slice(0, 300),
    body: input.body.trim().slice(0, 20_000),
    countries: targetList(input.countries),
    industries: targetList(input.industries),
  };
  if (!data.name || !data.subject || !data.body) return { error: "Name, subject and message are all needed" };
  const row = input.id ? await db.emailTemplate.update({ where: { id: input.id }, data }) : await db.emailTemplate.create({ data: { ...data, createdById: user.id } });
  revalidatePath("/outreach");
  return { ok: true, id: row.id, message: "Template saved" };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!canSendEmail(user)) return { error: "Only owners and team leads can delete templates" };
  if (await db.sequenceStep.count({ where: { templateId: id } })) return { error: "This template is used in a sequence. Remove it from the sequence first." };
  await db.emailTemplate.delete({ where: { id } });
  revalidatePath("/outreach");
  return { ok: true, message: "Template deleted" };
}

// ---------- Sequences ----------

export async function saveSequence(input: { id?: string | null; name: string; description: string; active: boolean; steps: { templateId: string; waitDays: number }[] }): Promise<ActionResult & { id?: string }> {
  const user = await requireUser();
  if (!canSendEmail(user)) return { error: "Only owners and team leads can edit sequences" };
  const steps = input.steps.filter((s) => s.templateId).slice(0, 10).map((s, i) => ({ position: i, templateId: s.templateId, waitDays: i === 0 ? Math.max(0, Math.min(30, Math.round(s.waitDays))) : Math.max(1, Math.min(60, Math.round(s.waitDays))) }));
  if (!input.name.trim()) return { error: "Give the sequence a name" };
  if (!steps.length) return { error: "Add at least one email" };
  const templates = await db.emailTemplate.count({ where: { id: { in: steps.map((s) => s.templateId) } } });
  if (templates !== new Set(steps.map((s) => s.templateId)).size) return { error: "One of the templates no longer exists" };
  const data = { name: input.name.trim().slice(0, 120), description: input.description.trim().slice(0, 500) || null, active: input.active };
  const id = await db.$transaction(async (tx) => {
    const seq = input.id ? await tx.sequence.update({ where: { id: input.id }, data }) : await tx.sequence.create({ data: { ...data, createdById: user.id } });
    await tx.sequenceStep.deleteMany({ where: { sequenceId: seq.id } });
    await tx.sequenceStep.createMany({ data: steps.map((s) => ({ ...s, sequenceId: seq.id })) });
    return seq.id;
  });
  revalidatePath("/outreach");
  return { ok: true, id, message: "Sequence saved" };
}

export async function enrollAction(sequenceId: string, leadIds: string[], includeRestricted = false): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const r = await enrollLeads(user, sequenceId, leadIds, includeRestricted);
    const parts = [
      r.enrolled && `${r.enrolled} started`,
      r.pending && `${r.pending} sent for approval`,
      r.skippedNoEmail && `${r.skippedNoEmail} skipped (no email)`,
      r.skippedBlocked && `${r.skippedBlocked} skipped (do not email or bounced)`,
      r.skippedRestricted && `${r.skippedRestricted} skipped (Germany/Austria: no recorded consent)`,
      r.skippedAlready && `${r.skippedAlready} already in it`,
    ].filter(Boolean);
    revalidatePath("/outreach");
    revalidatePath("/emails");
    return { ok: true, message: parts.join(" · ") || "Nothing to add" };
  } catch (e) {
    return fail(e);
  }
}

export async function approveEnrollmentsAction(ids: string[], approve: boolean): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const n = await approveEnrollments(user, ids, approve);
    revalidatePath("/emails");
    revalidatePath("/outreach");
    return { ok: true, message: `${n} ${approve ? "approved" : "rejected"}` };
  } catch (e) {
    return fail(e);
  }
}

export async function stopEnrollmentAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await stopEnrollment(user, id);
    revalidatePath("/outreach");
    return { ok: true, message: "Sequence stopped for this lead" };
  } catch (e) {
    return fail(e);
  }
}

/** Owner: send whatever is due now instead of waiting for the 10-minute run. */
export async function runSequencesNow(): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManagePeople(user)) return { error: "Only the owner can do this" };
  const r = await runDueSequences(40_000);
  revalidatePath("/outreach");
  return { ok: true, message: `${r.sent} sent · ${r.later} held for their working hours · ${r.stopped} finished or stopped · ${r.waiting} waiting · ${r.failed} failed` };
}

// ---------- Quotes ----------

export async function createQuoteAction(leadId: string) {
  const user = await requireUser();
  const q = await createQuote(user, leadId);
  redirect(`/quotes/${q.id}`);
}

export async function saveQuoteAction(id: string, input: { title: string; items: unknown; discount: number; notes: string; validUntil: string }): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await updateQuote(user, id, input);
    revalidatePath(`/quotes/${id}`);
    return { ok: true, message: "Quote saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function sendQuoteAction(id: string, opts: { email: boolean; message?: string }): Promise<ActionResult & { link?: string }> {
  const user = await requireUser();
  try {
    const r = await sendQuote(user, id, { ...opts, origin: await origin() });
    const q = await visibleQuote(user, id);
    revalidatePath(`/quotes/${id}`);
    revalidatePath(`/leads/${q.leadId}`);
    return {
      ok: true,
      link: r.link,
      message: r.emailStatus === "sent" ? "Quote emailed and logged as a proposal" : r.emailStatus === "approval" ? "Email sent for approval; quote logged as a proposal" : "Quote marked as sent. Copy the link to share it.",
    };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteQuoteAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const q = await visibleQuote(user, id);
    if (q.status !== "DRAFT") return { error: "Only drafts can be deleted" };
    await db.quote.delete({ where: { id } });
    revalidatePath(`/leads/${q.leadId}`);
    return { ok: true, message: "Draft deleted" };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Price list (owner) ----------

export async function savePriceItem(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManagePeople(user)) return { error: "Only the owner can edit prices" };
  const id = String(fd.get("id") ?? "");
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  if (!name) return { error: "Give the item a name" };
  const data = { name, description: String(fd.get("description") ?? "").trim().slice(0, 500) || null, price: toMinor(String(fd.get("price") ?? "")), monthly: fd.get("monthly") === "on", active: true };
  if (id) await db.priceItem.update({ where: { id }, data });
  else await db.priceItem.create({ data: { ...data, position: await db.priceItem.count() } });
  revalidatePath("/settings");
  return { ok: true, message: `${name} saved` };
}

export async function deletePriceItem(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManagePeople(user)) return { error: "Only the owner can edit prices" };
  await db.priceItem.update({ where: { id }, data: { active: false } });
  revalidatePath("/settings");
  return { ok: true, message: "Removed from the price list" };
}

// ---------- Assignment (owner) ----------

export async function saveAssignmentAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManagePeople(user)) return { error: "Only the owner can change assignment" };
  const users = await db.user.findMany({ select: { id: true } });
  const s = sanitizeAssignment(input, users.map((u) => u.id));
  if (s.mode === "ROUND_ROBIN" && s.pool.length === 0 && s.rules.length === 0) return { error: "Pick at least one person for the rotation" };
  await saveAssignment(s);
  const n = await assignInboundLeads();
  revalidatePath("/settings");
  return { ok: true, message: s.mode === "OFF" ? "Automatic assignment is off" : `Saved. New enquiries will be assigned automatically${n ? ` (${n} assigned just now)` : ""}.` };
}

// ---------- Notifications ----------

export async function markNotificationsRead(ids: string[] | "all"): Promise<ActionResult> {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null, ...(ids === "all" ? {} : { id: { in: ids } }) }, data: { readAt: new Date() } });
  return { ok: true };
}
