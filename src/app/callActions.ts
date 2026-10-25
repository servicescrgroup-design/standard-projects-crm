"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";
import { canSeeLead } from "@/lib/access";
import { logActivity } from "@/lib/server/activities";
import { CALL_OUTCOMES, isCallOutcome, retryAt } from "@/lib/callList";
import { stageIndex, type Outcome, type Stage } from "@/lib/domain";

type Result = { ok?: boolean; error?: string; message?: string };

/**
 * Logs a call from the Call list in one click. Each outcome sets the next step: try again in a few days,
 * call back on a chosen date, book the meeting, or close the lead. Calling an unassigned lead claims it.
 */
export async function logCallOutcome(leadId: string, outcome: string, opts: { date?: string; note?: string } = {}): Promise<Result> {
  const user = await requireUser();
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { owner: true } });
  if (!lead || !canSeeLead(user, lead)) return { error: "Lead not found" };
  if (!isCallOutcome(outcome)) return { error: "Choose what happened" };
  const spec = CALL_OUTCOMES.find((o) => o.id === outcome)!;
  const date = opts.date ? new Date(opts.date) : null;
  if (spec.needsDate && (!date || Number.isNaN(date.getTime()))) return { error: "Pick a date and time" };
  const note = (opts.note ?? "").trim().slice(0, 1000);
  const now = new Date();

  if (!lead.ownerId) await db.lead.update({ where: { id: lead.id }, data: { ownerId: user.id, assignedAt: now } });

  if (outcome === "wrong_number") {
    // Keep the number in the notes and remove it, so the lead leaves the call list.
    await logActivity({ leadId: lead.id, userId: user.id, type: "NOTE", summary: `Wrong number: ${lead.phone}${note ? ` – ${note}` : ""}`, occurredAt: now });
    await db.lead.update({ where: { id: lead.id }, data: { phone: null, notes: [lead.notes, `Wrong number (was ${lead.phone})`].filter(Boolean).join("\n") } });
  } else {
    const map: Record<string, { outcome: Outcome; next: Date | null }> = {
      no_answer: { outcome: "NO_ANSWER", next: retryAt(now, 2) },
      voicemail: { outcome: "VOICEMAIL", next: retryAt(now, 3) },
      callback: { outcome: "CONNECTED", next: date },
      interested: { outcome: "INTERESTED", next: retryAt(now, 1) },
      meeting: { outcome: "INTERESTED", next: date },
      not_interested: { outcome: "NOT_INTERESTED", next: null },
    };
    const m = map[outcome];
    await logActivity({ leadId: lead.id, userId: user.id, type: "CALL", outcome: m.outcome, summary: note || spec.label, occurredAt: now, nextFollowUpAt: m.next });
    if (outcome === "meeting" && stageIndex(lead.stage as Stage) < stageIndex("MEETING_BOOKED")) {
      await db.lead.update({ where: { id: lead.id }, data: { stage: "MEETING_BOOKED", stageChangedAt: now, nextFollowUpAt: date } });
    }
    if (outcome === "not_interested") await db.lead.update({ where: { id: lead.id }, data: { lostReason: lead.lostReason ?? "Not interested (phone call)" } });
  }

  revalidatePath("/calls");
  revalidatePath(`/leads/${lead.id}`);
  return { ok: true, message: `${lead.company}: ${spec.label.toLowerCase()}` };
}
