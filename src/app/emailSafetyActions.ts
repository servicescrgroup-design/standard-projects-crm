"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";
import { canSeeLead, canSendEmail } from "@/lib/access";
import { clearOptOut, markOptOut } from "@/lib/server/emailFlags";
import { CONSENT_METHODS } from "@/lib/emailSafety";

type Result = { ok?: boolean; error?: string; message?: string };

async function visible(leadId: string) {
  const user = await requireUser();
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { owner: true } });
  return { user, lead: lead && canSeeLead(user, lead) ? lead : null };
}

/** Mark or unmark "Do not email". Anyone can mark it; only owners and team leads can remove it. */
export async function setDoNotEmail(leadId: string, on: boolean): Promise<Result> {
  const { user, lead } = await visible(leadId);
  if (!lead) return { error: "Lead not found" };
  if (on) {
    await markOptOut(lead.id, `Marked by ${user.name}`);
  } else {
    if (!canSendEmail(user)) return { error: "Ask a manager to remove “Do not email”" };
    await clearOptOut(lead.id);
  }
  revalidatePath(`/leads/${lead.id}`);
  return { ok: true, message: on ? "Marked “Do not email”. Their sequences were stopped." : "They can be emailed again" };
}

/** Records proof that the lead agreed to receive emails (how, and when). */
export async function recordConsent(leadId: string, method: string, note: string): Promise<Result> {
  const { user, lead } = await visible(leadId);
  if (!lead) return { error: "Lead not found" };
  if (!(CONSENT_METHODS as readonly string[]).includes(method)) return { error: "Choose how they agreed" };
  const extra = note.trim().slice(0, 200);
  await db.lead.update({
    where: { id: lead.id },
    data: { emailConsentAt: new Date(), emailConsentNote: `${method}${extra ? ` – ${extra}` : ""} (recorded by ${user.name})` },
  });
  revalidatePath(`/leads/${lead.id}`);
  return { ok: true, message: "Consent recorded" };
}

export async function clearConsent(leadId: string): Promise<Result> {
  const { lead } = await visible(leadId);
  if (!lead) return { error: "Lead not found" };
  await db.lead.update({ where: { id: lead.id }, data: { emailConsentAt: null, emailConsentNote: null } });
  revalidatePath(`/leads/${lead.id}`);
  return { ok: true, message: "Consent removed" };
}
