import "server-only";
import type { Mailbox } from "@prisma/client";
import { db } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";
import { leadForAddresses, loadMatchContext, logActivity, type MatchContext } from "./activities";
import { PROVIDERS, refreshAccess } from "../mail/oauth";
import { MailAuthError } from "../mail/http";
import { replySubject } from "../mail/mime";
import { OUTREACH_LABEL, isMailProvider, type MailMessage, type MailProviderId } from "../mail/types";

export const messageRef = (provider: MailProviderId, id: string) => `${provider.toLowerCase()}:${id}`;

/** A valid access token, refreshed (and re-encrypted) when it is about to expire. */
export async function accessTokenFor(mb: Mailbox): Promise<string> {
  if (mb.accessToken && mb.accessExpiresAt && mb.accessExpiresAt.getTime() > Date.now() + 60_000) {
    try {
      return decryptSecret(mb.accessToken);
    } catch {
      /* fall through to refresh */
    }
  }
  if (!isMailProvider(mb.provider)) throw new Error("Unknown mail provider");
  let refreshToken: string;
  try {
    refreshToken = decryptSecret(mb.refreshToken);
  } catch {
    throw new MailAuthError("Stored access can't be read any more");
  }
  const t = await refreshAccess(mb.provider, refreshToken);
  await db.mailbox.update({
    where: { id: mb.id },
    data: {
      accessToken: encryptSecret(t.accessToken),
      accessExpiresAt: new Date(Date.now() + t.expiresIn * 1000),
      // Microsoft rotates refresh tokens; keep the newest.
      ...(t.refreshToken ? { refreshToken: encryptSecret(t.refreshToken) } : {}),
    },
  });
  return t.accessToken;
}

async function markError(mb: Mailbox, e: unknown) {
  const auth = e instanceof MailAuthError;
  await db.mailbox.update({
    where: { id: mb.id },
    data: {
      status: auth ? "ERROR" : mb.status,
      lastError: auth ? "Access expired or was removed. Disconnect and connect again." : String((e as Error).message ?? e).slice(0, 300),
      ...(auth ? { accessToken: null, accessExpiresAt: null } : {}),
    },
  });
}

/** Logs one message on its lead (if any). Returns "logged" | "duplicate" | "unmatched". */
async function logMessage(ctx: MatchContext, mb: Mailbox, m: MailMessage) {
  const provider = mb.provider as MailProviderId;
  const addresses = m.direction === "in" ? [m.from] : [...m.to, ...m.cc];
  const lead = leadForAddresses(ctx, addresses);
  if (!lead) return "unmatched" as const;
  const logged = await logActivity({
    leadId: lead.id,
    userId: mb.userId,
    type: m.direction === "in" ? "EMAIL_IN" : "EMAIL_OUT",
    occurredAt: m.date,
    summary: m.snippet.slice(0, 500) || null,
    subject: m.subject.slice(0, 300) || null,
    source: provider,
    externalId: messageRef(provider, m.id),
    threadId: m.threadId,
    webLink: m.webLink,
    mailboxId: mb.id,
  });
  return logged ? ("logged" as const) : ("duplicate" as const);
}

export type SyncResult = { mailboxes: number; logged: number; unmatched: number; errors: number };

/**
 * Pulls new mail from one mailbox and logs what belongs to a lead. Only matched messages are stored;
 * everything else is ignored. Safe to re-run (messages are de-duplicated by provider id).
 */
export async function syncMailbox(mb: Mailbox, ctx?: MatchContext): Promise<SyncResult> {
  const result: SyncResult = { mailboxes: 1, logged: 0, unmatched: 0, errors: 0 };
  if (!isMailProvider(mb.provider)) return result;
  try {
    const token = await accessTokenFor(mb);
    const provider = PROVIDERS[mb.provider];
    const { messages, cursor } = await provider.listNewMessages(token, mb.cursor, mb.address);
    const context = ctx ?? (await loadMatchContext());
    const known = new Set(
      (await db.activity.findMany({ where: { externalId: { in: messages.map((m) => messageRef(mb.provider as MailProviderId, m.id)) } }, select: { externalId: true } })).map((a) => a.externalId),
    );
    for (const m of messages.sort((a, b) => a.date.getTime() - b.date.getTime())) {
      if (known.has(messageRef(mb.provider, m.id))) continue;
      const r = await logMessage(context, mb, m);
      if (r === "logged") result.logged++;
      if (r === "unmatched") result.unmatched++;
    }
    await db.mailbox.update({ where: { id: mb.id }, data: { cursor, lastSyncAt: new Date(), lastError: null, status: "ACTIVE" } });
  } catch (e) {
    result.errors++;
    await markError(mb, e);
  }
  return result;
}

/** Syncs every connected mailbox, least recently synced first, within a time budget. */
export async function syncAllMailboxes(budgetMs = 45_000): Promise<SyncResult> {
  const started = Date.now();
  const total: SyncResult = { mailboxes: 0, logged: 0, unmatched: 0, errors: 0 };
  const mailboxes = await db.mailbox.findMany({ where: { status: "ACTIVE" }, orderBy: { lastSyncAt: { sort: "asc", nulls: "first" } } });
  if (mailboxes.length === 0) return total;
  const ctx = await loadMatchContext();
  for (const mb of mailboxes) {
    if (Date.now() - started > budgetMs) break;
    const r = await syncMailbox(mb, ctx);
    total.mailboxes++;
    total.logged += r.logged;
    total.unmatched += r.unmatched;
    total.errors += r.errors;
  }
  return total;
}

/** The mailbox an email is sent from: the author's own, else the approver's. */
export async function sendingMailbox(authorId: string, actorId: string): Promise<Mailbox | null> {
  for (const userId of [authorId, actorId]) {
    const mb = await db.mailbox.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { updatedAt: "desc" } });
    if (mb) return mb;
  }
  return null;
}

/**
 * Sends a CRM draft through Gmail or Outlook, tags it "Standard Projects/Outreach Sent" and logs it
 * on the lead. Replies stay in the original thread when the original came through the same mailbox.
 * Permission checks happen in the calling server action.
 */
export async function sendDraft(draftId: string, actorId: string) {
  const draft = await db.emailDraft.findUniqueOrThrow({ where: { id: draftId }, include: { author: true } });
  if (draft.status === "SENT") throw new Error("This email was already sent");
  const mb = await sendingMailbox(draft.authorId, actorId);
  if (!mb || !isMailProvider(mb.provider)) throw new Error("Connect Gmail or Outlook in Settings → Email before sending");

  let replyToMessageId: string | null = null;
  let threadId: string | null = null;
  let subject = draft.subject;
  if (draft.replyToActivityId) {
    const original = await db.activity.findUnique({ where: { id: draft.replyToActivityId } });
    const prefix = `${mb.provider.toLowerCase()}:`;
    if (original?.mailboxId === mb.id && original.externalId?.startsWith(prefix)) {
      replyToMessageId = original.externalId.slice(prefix.length);
      threadId = original.threadId;
    }
    if (original?.subject && !subject.trim()) subject = replySubject(original.subject);
  }

  const provider = PROVIDERS[mb.provider];
  try {
    const token = await accessTokenFor(mb);
    const sent = await provider.sendMessage(token, {
      fromAddress: mb.address,
      fromName: draft.author.name,
      to: draft.to.split(",").map((s) => s.trim()).filter(Boolean),
      subject: subject || "(no subject)",
      body: draft.body,
      replyToMessageId,
      threadId,
    });
    let labelId = mb.labelId;
    let labelError: string | null = null;
    try {
      labelId = await provider.applyLabel(token, sent.id, OUTREACH_LABEL, mb.labelId);
    } catch (e) {
      labelError = (e as Error).message; // sent fine; tagging is secondary
    }
    if (labelId !== mb.labelId) await db.mailbox.update({ where: { id: mb.id }, data: { labelId } });

    const activity = await logActivity({
      leadId: draft.leadId,
      userId: draft.authorId,
      type: "EMAIL_OUT",
      occurredAt: new Date(),
      summary: draft.body.slice(0, 500),
      subject,
      source: mb.provider,
      externalId: messageRef(mb.provider, sent.id),
      threadId: sent.threadId,
      webLink: sent.webLink,
      mailboxId: mb.id,
    });
    await db.emailDraft.update({
      where: { id: draft.id },
      data: { status: "SENT", sentAt: new Date(), approvedById: actorId, sentActivityId: activity?.id ?? null, error: labelError ? `Sent, but couldn't add the label: ${labelError}` : null },
    });
    return { mailbox: mb.address };
  } catch (e) {
    if (e instanceof MailAuthError) await markError(mb, e);
    await db.emailDraft.update({ where: { id: draft.id }, data: { status: "FAILED", error: (e as Error).message.slice(0, 300) } });
    throw e;
  }
}
