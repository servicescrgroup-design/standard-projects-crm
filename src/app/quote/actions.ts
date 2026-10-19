"use server";

import { headers } from "next/headers";
import { db } from "@/lib/server/db";
import {
  parseQuoteForm,
  quoteSummary,
  quoteToLead,
  validateQuote,
  type QuoteAnswers,
  type QuoteErrorCode,
} from "@/lib/quote";

export type QuoteResult = { ok?: boolean; errors?: Partial<Record<keyof QuoteAnswers, QuoteErrorCode>>; error?: "rateLimited" };

const MAX_PER_HOUR = 5;

/**
 * Public "Get a quote" submission. Creates an unassigned lead (due now) with every answer as a note.
 * If the email already belongs to a lead, the request is added to that lead instead of duplicating it.
 */
export async function submitQuote(_prev: QuoteResult, fd: FormData): Promise<QuoteResult> {
  // Honeypot: real people never see or fill this field.
  if (String(fd.get("fax") ?? "")) return { ok: true };

  const answers = parseQuoteForm(fd);
  const errors = validateQuote(answers);
  if (Object.keys(errors).length > 0) return { errors };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const key = `quote:${ip}`;
  const recent = await db.loginAttempt.count({ where: { email: key, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (recent >= MAX_PER_HOUR) return { error: "rateLimited" };
  await db.loginAttempt.create({ data: { email: key } });

  const fields = quoteToLead(answers);
  const now = new Date();
  const existing = await db.lead.findFirst({ where: { email: fields.email }, orderBy: { createdAt: "desc" } });

  await db.$transaction(async (tx) => {
    const lead = existing
      ? await tx.lead.update({
          where: { id: existing.id },
          data: {
            nextFollowUpAt: now,
            ...(existing.stage === "LOST" ? { stage: "NEW", stageChangedAt: now } : {}),
            ...(existing.value === 0 ? { value: fields.value } : {}),
          },
        })
      : await tx.lead.create({ data: { ...fields, stage: "NEW", nextFollowUpAt: now } });
    await tx.activity.create({
      data: { leadId: lead.id, type: "NOTE", source: "QUOTE", summary: quoteSummary(answers), occurredAt: now },
    });
  });

  return { ok: true };
}
