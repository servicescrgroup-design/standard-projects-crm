import "server-only";
import { randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { db } from "./db";
import { notify, managersFor } from "./notifications";
import { logActivity } from "./activities";
import { canSeeLead, canSendEmail } from "../access";
import { formatMoney } from "../domain";
import { isExpired, quoteNumber, quoteTotals, sanitizeItems, type QuoteItem } from "../quotes";

/** The public site address for quote links: customers can't open the password-protected preview. */
export function publicBase(requestOrigin: string): string {
  return (
    process.env.APP_URL?.replace(/\/+$/, "") ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : requestOrigin)
  );
}

async function visibleLead(user: User, leadId: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { owner: true } });
  if (!lead || !canSeeLead(user, lead)) throw new Error("Lead not found");
  return lead;
}

export async function visibleQuote(user: User, id: string) {
  const q = await db.quote.findUnique({ where: { id }, include: { lead: { include: { owner: true } } } });
  if (!q || !canSeeLead(user, q.lead)) throw new Error("Quote not found");
  return q;
}

/** New draft quote, pre-filled with the price-list item matching the lead's package (if any). */
export async function createQuote(user: User, leadId: string) {
  const lead = await visibleLead(user, leadId);
  const year = new Date().getFullYear();
  const pkg = lead.package ? await db.priceItem.findFirst({ where: { active: true, name: { contains: lead.package, mode: "insensitive" } } }) : null;
  const items: QuoteItem[] = pkg ? [{ name: pkg.name, description: pkg.description ?? undefined, qty: 1, unitPrice: pkg.price, monthly: pkg.monthly }] : [];
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await db.quote.count({ where: { number: { startsWith: `Q-${year}-` } } });
    try {
      return await db.quote.create({
        data: {
          number: quoteNumber(year, count + 1 + attempt),
          leadId: lead.id,
          createdById: user.id,
          items,
          validUntil: new Date(Date.now() + 30 * 86_400_000),
          token: randomBytes(24).toString("base64url"),
        },
      });
    } catch (e) {
      if (!String((e as Error).message).includes("Unique constraint")) throw e; // number taken: try the next one
    }
  }
  throw new Error("Couldn't number the quote, please try again");
}

export async function updateQuote(user: User, id: string, input: { title?: string; items?: unknown; discount?: number; notes?: string | null; validUntil?: string | null }) {
  const q = await visibleQuote(user, id);
  if (q.status === "ACCEPTED") throw new Error("This quote was accepted and can't be changed. Create a new one.");
  const validUntil = input.validUntil ? new Date(`${input.validUntil}T12:00:00`) : null;
  return db.quote.update({
    where: { id },
    data: {
      title: (input.title ?? q.title).trim().slice(0, 120) || "Quote",
      items: sanitizeItems(input.items ?? q.items),
      discount: Math.max(0, Math.round(input.discount ?? q.discount)),
      notes: input.notes === undefined ? q.notes : input.notes?.trim().slice(0, 4000) || null,
      validUntil: validUntil && !Number.isNaN(validUntil.getTime()) ? validUntil : null,
    },
  });
}

/**
 * Marks the quote as sent and logs it as a Proposal on the lead (stage → Proposal sent, follow-ups on
 * day 2, 5 and 10). Optionally prepares an email with the link; reps' emails go for approval.
 */
export async function sendQuote(user: User, id: string, opts: { email: boolean; origin: string; message?: string }) {
  const q = await visibleQuote(user, id);
  const items = sanitizeItems(q.items);
  if (!items.length) throw new Error("Add at least one line before sending");
  if (items.some((i) => i.unitPrice === 0)) throw new Error("Some lines have no price. Set them, or remove them.");
  const t = quoteTotals(items, q.discount);
  const link = `${publicBase(opts.origin)}/q/${q.token}`;
  const now = new Date();
  await db.quote.update({ where: { id }, data: { status: q.status === "DRAFT" ? "SENT" : q.status, sentAt: q.sentAt ?? now } });
  await db.lead.update({ where: { id: q.leadId }, data: { value: t.oneOff, monthlyValue: t.monthly } });
  await logActivity({
    leadId: q.leadId,
    userId: user.id,
    type: "PROPOSAL",
    occurredAt: now,
    summary: `Quote ${q.number} sent: ${formatMoney(t.oneOff)}${t.monthly ? ` + ${formatMoney(t.monthly)}/month` : ""}\n${link}`,
  });

  let emailStatus: "none" | "sent" | "approval" = "none";
  if (opts.email) {
    if (!q.lead.email) throw new Error("This lead has no email address. Copy the link and send it another way.");
    const body = `${opts.message?.trim() || `Hi ${q.lead.contactName ?? "there"},\n\nThank you for your time. Here is your quote from Standard Projects:`}\n\n${link}\n\nYou can review it and accept it online. Any questions, just reply to this email.\n\nBest regards,\n${user.name}`;
    const draft = await db.emailDraft.create({
      data: { leadId: q.leadId, authorId: user.id, to: q.lead.email, subject: `Your quote ${q.number} from Standard Projects`, body, status: canSendEmail(user) ? "DRAFT" : "AWAITING_APPROVAL" },
    });
    if (canSendEmail(user)) {
      const { sendDraft } = await import("./mailbox");
      await sendDraft(draft.id, user.id);
      emailStatus = "sent";
    } else {
      emailStatus = "approval";
      await notify(await managersFor(user.teamId), { type: "APPROVAL_NEEDED", title: `${user.name} wants to email quote ${q.number}`, href: "/emails" });
    }
  }
  return { link, emailStatus };
}

// ---------- Public link (/q/<token>) ----------

export async function quoteByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return db.quote.findUnique({ where: { token }, include: { lead: { select: { id: true, company: true, contactName: true, ownerId: true, owner: { select: { name: true, email: true, teamId: true } } } } } });
}

/** Counts a customer view and alerts the owner the first time. */
export async function recordView(token: string) {
  const q = await quoteByToken(token);
  if (!q || q.status === "DRAFT") return;
  const first = !q.viewedAt;
  await db.quote.update({ where: { id: q.id }, data: { viewCount: { increment: 1 }, viewedAt: q.viewedAt ?? new Date(), ...(q.status === "SENT" ? { status: "VIEWED" } : {}) } });
  if (first) {
    await notify(q.lead.ownerId ?? q.createdById, { type: "QUOTE_VIEWED", title: `${q.lead.company} opened quote ${q.number}`, body: "Good moment to follow up.", href: `/leads/${q.lead.id}#quotes` });
  }
}

export async function acceptQuote(token: string, name: string) {
  const q = await quoteByToken(token);
  if (!q || q.status === "DRAFT") throw new Error("Quote not found");
  if (q.status === "ACCEPTED") return q;
  if (q.status === "DECLINED") throw new Error("This quote was declined. Please contact us for a new one.");
  if (isExpired(q.validUntil)) throw new Error("This quote has expired. Please contact us for an updated one.");
  const who = name.trim().slice(0, 120);
  if (who.length < 2) throw new Error("Please type your name to accept");
  const t = quoteTotals(sanitizeItems(q.items), q.discount);
  const now = new Date();
  await db.$transaction([
    db.quote.update({ where: { id: q.id }, data: { status: "ACCEPTED", acceptedAt: now, acceptedName: who } }),
    db.lead.update({
      where: { id: q.lead.id },
      data: { stage: "WON", stageChangedAt: now, nextFollowUpAt: null, value: t.oneOff, monthlyValue: t.monthly, lastReplyAt: now, unansweredTouches: 0 },
    }),
    db.activity.create({ data: { leadId: q.lead.id, type: "NOTE", source: "QUOTE", summary: `Quote ${q.number} accepted online by ${who}: ${formatMoney(t.oneOff)}${t.monthly ? ` + ${formatMoney(t.monthly)}/month` : ""}`, occurredAt: now } }),
    db.sequenceEnrollment.updateMany({ where: { leadId: q.lead.id, status: "ACTIVE" }, data: { status: "STOPPED", stopReason: "Quote accepted", nextRunAt: null } }),
  ]);
  const { markDemosWon } = await import("./demos");
  await markDemosWon(q.lead.id);
  await notify([q.lead.ownerId ?? q.createdById, ...(await managersFor(q.lead.owner?.teamId ?? null))], {
    type: "QUOTE_ACCEPTED",
    title: `🎉 ${q.lead.company} accepted quote ${q.number}`,
    body: `${who} accepted ${formatMoney(t.oneOff)}${t.monthly ? ` + ${formatMoney(t.monthly)}/month` : ""}. The deal is now Won.`,
    href: `/leads/${q.lead.id}#quotes`,
  });
  return q;
}

export async function declineQuote(token: string, reason: string) {
  const q = await quoteByToken(token);
  if (!q || q.status === "DRAFT") throw new Error("Quote not found");
  if (q.status === "ACCEPTED" || q.status === "DECLINED") return q;
  const why = reason.trim().slice(0, 500);
  const now = new Date();
  await db.$transaction([
    db.quote.update({ where: { id: q.id }, data: { status: "DECLINED", declinedAt: now, declineReason: why || null } }),
    db.lead.update({ where: { id: q.lead.id }, data: { lastReplyAt: now, nextFollowUpAt: now } }),
    db.activity.create({ data: { leadId: q.lead.id, type: "NOTE", source: "QUOTE", summary: `Quote ${q.number} declined online${why ? `: “${why}”` : ""}`, occurredAt: now } }),
  ]);
  await notify(q.lead.ownerId ?? q.createdById, { type: "QUOTE_DECLINED", title: `${q.lead.company} declined quote ${q.number}`, body: why || "No reason given. Worth a call to find out why.", href: `/leads/${q.lead.id}#quotes` });
  return q;
}
