"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";
import { decryptSecret } from "@/lib/server/crypto";
import { sendDraft, syncMailbox } from "@/lib/server/mailbox";
import { canSendNow, setAgentsSendDirect } from "@/lib/server/emailPolicy";
import { canSeeLead, canSendEmail } from "@/lib/access";
import { parseAddressList } from "@/lib/mail/mime";
import { isMailProvider, PROVIDER_NAMES } from "@/lib/mail/types";
import { revoke } from "@/lib/mail/oauth";

export type EmailResult = { ok?: boolean; error?: string; message?: string };

const fail = (error: string): EmailResult => ({ error });

function refresh(leadId?: string) {
  revalidatePath("/emails");
  revalidatePath("/settings");
  revalidatePath("/today");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

async function visibleLead(leadId: string) {
  const user = await requireUser();
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { owner: true } });
  if (!lead || !canSeeLead(user, lead)) return { user, lead: null };
  return { user, lead };
}

export async function disconnectMailbox(provider: string): Promise<EmailResult> {
  const user = await requireUser();
  if (!isMailProvider(provider)) return fail("Unknown provider");
  const mb = await db.mailbox.findUnique({ where: { userId_provider: { userId: user.id, provider } } });
  if (!mb) return { ok: true };
  try {
    await revoke(provider, decryptSecret(mb.refreshToken));
  } catch {
    /* already unreadable or revoked: deleting is enough */
  }
  await db.mailbox.delete({ where: { id: mb.id } });
  refresh();
  return { ok: true, message: `${PROVIDER_NAMES[provider]} disconnected` };
}

export async function syncMyMailboxes(): Promise<EmailResult> {
  const user = await requireUser();
  const mailboxes = await db.mailbox.findMany({ where: { userId: user.id } });
  if (mailboxes.length === 0) return fail("Connect a mailbox first");
  let logged = 0;
  let errors = 0;
  for (const mb of mailboxes) {
    const r = await syncMailbox(mb);
    logged += r.logged;
    errors += r.errors;
  }
  refresh();
  if (errors) return fail("Couldn't reach your mailbox. Check the status below.");
  return { ok: true, message: logged ? `${logged} new email${logged === 1 ? "" : "s"} logged on leads` : "Up to date" };
}

export async function dismissEmailPrompt(): Promise<void> {
  const user = await requireUser();
  const prefs = (user.preferences && typeof user.preferences === "object" ? user.preferences : {}) as Record<string, unknown>;
  await db.user.update({ where: { id: user.id }, data: { preferences: { ...prefs, emailPromptDismissed: true } } });
  revalidatePath("/dashboard");
}

/**
 * Saves an email written on a lead. intent: "draft" (keep editing later), "approval" (Draft – awaiting
 * approval) or "send" (owners/team leads only; reps' emails always go through approval).
 */
export async function saveEmailDraft(_prev: EmailResult, fd: FormData): Promise<EmailResult> {
  const leadId = String(fd.get("leadId") ?? "");
  const { user, lead } = await visibleLead(leadId);
  if (!lead) return fail("Lead not found");

  const to = parseAddressList(String(fd.get("to") ?? ""));
  const subject = String(fd.get("subject") ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 300);
  const body = String(fd.get("body") ?? "").trim();
  const replyTo = String(fd.get("replyToActivityId") ?? "") || null;
  const templateId = String(fd.get("templateId") ?? "").slice(0, 60) || null;
  let intent = String(fd.get("intent") ?? "draft");
  if (to.length === 0) return fail("Add at least one valid email address");
  if (to.length > 10) return fail("At most 10 recipients");
  if (!body) return fail("Write a message");
  if (body.length > 20_000) return fail("Message is too long");
  if (!subject && !replyTo) return fail("Add a subject");
  if (intent === "send" && !(await canSendNow(user))) intent = "approval";
  if (replyTo) {
    const original = await db.activity.findUnique({ where: { id: replyTo }, select: { leadId: true } });
    if (original?.leadId !== lead.id) return fail("That email isn't on this lead");
  }

  const draftId = String(fd.get("draftId") ?? "");
  const data = { to: to.join(", "), subject, body, replyToActivityId: replyTo, templateId, status: intent === "draft" ? "DRAFT" : "AWAITING_APPROVAL", error: null };
  let id: string;
  if (draftId) {
    const existing = await db.emailDraft.findUnique({ where: { id: draftId } });
    if (!existing || existing.leadId !== lead.id || existing.status === "SENT") return fail("Draft not found");
    if (existing.authorId !== user.id && !canSendEmail(user)) return fail("Only the author or a manager can edit this draft");
    id = (await db.emailDraft.update({ where: { id: draftId }, data })).id;
  } else {
    id = (await db.emailDraft.create({ data: { ...data, leadId: lead.id, authorId: user.id } })).id;
  }

  if (intent !== "send") {
    refresh(lead.id);
    return { ok: true, message: intent === "draft" ? "Draft saved" : "Sent for approval. A manager will approve & send it." };
  }
  try {
    const r = await sendDraft(id, user.id);
    refresh(lead.id);
    return { ok: true, message: `Sent from ${r.mailbox}` };
  } catch (e) {
    refresh(lead.id);
    return fail((e as Error).message);
  }
}

export async function approveAndSend(draftId: string): Promise<EmailResult> {
  const user = await requireUser();
  if (!canSendEmail(user)) return fail("Only owners and team leads can approve emails");
  const draft = await db.emailDraft.findUnique({ where: { id: draftId }, include: { lead: { include: { owner: true } } } });
  if (!draft || !canSeeLead(user, draft.lead)) return fail("Email not found");
  try {
    const r = await sendDraft(draft.id, user.id);
    refresh(draft.leadId);
    return { ok: true, message: `Approved and sent from ${r.mailbox}` };
  } catch (e) {
    refresh(draft.leadId);
    return fail((e as Error).message);
  }
}

export async function deleteDraft(draftId: string): Promise<EmailResult> {
  const user = await requireUser();
  if (!canSendEmail(user)) return fail("Only owners and team leads can delete emails");
  const draft = await db.emailDraft.findUnique({ where: { id: draftId }, include: { lead: { include: { owner: true } } } });
  if (!draft || !canSeeLead(user, draft.lead)) return fail("Email not found");
  if (draft.status === "SENT") return fail("Sent emails can't be deleted here");
  await db.emailDraft.delete({ where: { id: draft.id } });
  refresh(draft.leadId);
  return { ok: true, message: "Draft deleted" };
}

/** Owner: let agents send one-off emails from their own mailbox without approval. */
export async function setAgentsSendDirectAction(on: boolean): Promise<EmailResult> {
  const user = await requireUser();
  if (user.role !== "OWNER") return fail("Only the owner can change this");
  await setAgentsSendDirect(on);
  revalidatePath("/settings");
  return { ok: true, message: on ? "Agents can now send from their own mailbox without approval" : "Agents' emails now wait for approval" };
}
