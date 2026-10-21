import "server-only";
import { db } from "./db";
import { applyActivity, type ActivityInput } from "../stageRules";
import { emailDomain, isFreeMail, matchLead, normaliseEmail } from "../matching";

export type LogActivityArgs = ActivityInput & {
  leadId: string;
  userId: string | null;
  summary?: string | null;
  source?: "MANUAL" | "GMAIL" | "OUTLOOK" | "CALENDAR" | "BOT";
  externalId?: string | null;
  subject?: string | null;
  threadId?: string | null;
  webLink?: string | null;
  mailboxId?: string | null;
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
        subject: args.subject ?? null,
        threadId: args.threadId ?? null,
        webLink: args.webLink ?? null,
        mailboxId: args.mailboxId ?? null,
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

export type MatchContext = { teamEmails: Set<string>; internalDomains: string[]; leads: { id: string; email: string | null; website: string | null }[] };

/** Everything needed to match addresses to leads. Teammates' addresses (and non-free-mail domains) never identify a lead. */
export async function loadMatchContext(extraInternal: string[] = []): Promise<MatchContext> {
  const [users, mailboxes, leads] = await Promise.all([
    db.user.findMany({ select: { email: true } }),
    db.mailbox.findMany({ select: { address: true } }),
    db.lead.findMany({ select: { id: true, email: true, website: true } }),
  ]);
  const teamEmails = new Set([...users.map((u) => u.email), ...mailboxes.map((m) => m.address), ...extraInternal].map((e) => e.toLowerCase()));
  const internalDomains = [...teamEmails].map(emailDomain).filter((d) => !isFreeMail(d));
  return { teamEmails, internalDomains, leads };
}

/** The lead a set of addresses belongs to, ignoring the team's own addresses. */
export function leadForAddresses(ctx: MatchContext, addresses: string[]) {
  const external = addresses.filter((a) => !ctx.teamEmails.has(normaliseEmail(a) ?? ""));
  return matchLead(external, ctx.leads, ctx.internalDomains);
}

export type IngestResult = { logged: number; duplicates: number; unmatched: number };

/**
 * Auto-capture: turns a mailbox owner's Gmail messages and Calendar events into activities on
 * the matching leads. Matching considers every lead (not just the user's), so a reply from a
 * client still lands on the right record even if someone else owns it.
 */
export async function ingestSyncItems(userEmail: string, items: SyncItem[]): Promise<IngestResult> {
  const user = await db.user.findUnique({ where: { email: userEmail.toLowerCase() } });
  if (!user) throw new Error(`Unknown user ${userEmail}`);

  const { teamEmails, internalDomains, leads } = await loadMatchContext();
  const result: IngestResult = { logged: 0, duplicates: 0, unmatched: 0 };

  for (const item of items) {
    const addresses = item.kind === "email" ? [item.from, ...item.to, ...(item.cc ?? [])] : item.attendees;
    const lead = leadForAddresses({ teamEmails, internalDomains, leads }, addresses);
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
