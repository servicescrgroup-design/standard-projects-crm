import "server-only";
import { db } from "./db";
import { applyActivity, type ActivityInput } from "../stageRules";
import { emailDomain, isFreeMail, matchLead, normaliseEmail } from "../matching";

export type LogActivityArgs = ActivityInput & {
  leadId: string;
  userId: string | null;
  summary?: string | null;
  source?: "MANUAL" | "GMAIL" | "CALENDAR" | "BOT";
  externalId?: string | null;
};

/**
 * The one way activities enter the system. Records the activity and applies the stage/follow-up
 * rules in a single transaction. Returns null if an activity with this externalId already exists
 * (sync is safe to re-run).
 */
export async function logActivity(args: LogActivityArgs) {
  return db.$transaction(async (tx) => {
    if (args.externalId) {
      const existing = await tx.activity.findUnique({ where: { externalId: args.externalId } });
      if (existing) return null;
    }
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: args.leadId } });
    const patch = applyActivity(lead, args);
    const activity = await tx.activity.create({
      data: {
        type: args.type,
        outcome: args.outcome ?? null,
        summary: args.summary ?? null,
        source: args.source ?? "MANUAL",
        externalId: args.externalId ?? null,
        leadId: args.leadId,
        userId: args.userId,
        occurredAt: args.occurredAt,
      },
    });
    if (Object.keys(patch).length > 0) await tx.lead.update({ where: { id: lead.id }, data: patch });
    return activity;
  });
}

export type SyncEmail = {
  kind: "email";
  externalId: string;
  direction: "in" | "out";
  from: string;
  to: string[];
  cc?: string[];
  subject?: string;
  snippet?: string;
  occurredAt: string;
};

export type SyncEvent = {
  kind: "event";
  externalId: string;
  title?: string;
  attendees: string[];
  start: string;
};

export type SyncItem = SyncEmail | SyncEvent;

export type IngestResult = { logged: number; duplicates: number; unmatched: number };

/**
 * Auto-capture: turns a mailbox owner's Gmail messages and Calendar events into activities on
 * the matching leads. Matching considers every lead (not just the user's), so a reply from a
 * client still lands on the right record even if someone else owns it.
 */
export async function ingestSyncItems(userEmail: string, items: SyncItem[]): Promise<IngestResult> {
  const user = await db.user.findUnique({ where: { email: userEmail.toLowerCase() } });
  if (!user) throw new Error(`Unknown user ${userEmail}`);

  // Teammates' addresses never identify a lead. Their domains are excluded too, unless it's free mail.
  const teamEmails = new Set((await db.user.findMany({ select: { email: true } })).map((u) => u.email.toLowerCase()));
  const internalDomains = [...teamEmails].map(emailDomain).filter((d) => !isFreeMail(d));
  const leads = await db.lead.findMany({ select: { id: true, email: true, website: true } });
  const result: IngestResult = { logged: 0, duplicates: 0, unmatched: 0 };

  for (const item of items) {
    const addresses = item.kind === "email" ? [item.from, ...item.to, ...(item.cc ?? [])] : item.attendees;
    const external = addresses.filter((a) => !teamEmails.has(normaliseEmail(a) ?? ""));
    const lead = matchLead(external, leads, internalDomains);
    if (!lead) {
      result.unmatched++;
      continue;
    }
    const logged =
      item.kind === "email"
        ? await logActivity({
            leadId: lead.id,
            userId: user.id,
            type: item.direction === "in" ? "EMAIL_IN" : "EMAIL_OUT",
            occurredAt: new Date(item.occurredAt),
            summary: [item.subject, item.snippet].filter(Boolean).join(": ") || null,
            source: "GMAIL",
            externalId: `gmail:${item.externalId}`,
          })
        : await logActivity({
            leadId: lead.id,
            userId: user.id,
            type: "MEETING",
            occurredAt: new Date(item.start),
            summary: item.title ?? null,
            source: "CALENDAR",
            externalId: `gcal:${item.externalId}`,
          });
    if (logged) result.logged++;
    else result.duplicates++;
  }
  return result;
}
