/** Sequence timing and stop rules. Pure, unit-tested. */
import { CLOSED_STAGES, DAY_MS, type Stage } from "./domain";

export type EnrollmentState = { status: string; stepIndex: number; createdAt: Date; lastSentAt: Date | null };
export type LeadState = { stage: string; email: string | null; lastReplyAt: Date | null; country: string | null };

/** Countries where unsolicited marketing email to businesses needs prior consent: call first instead. */
export const EMAIL_RESTRICTED_COUNTRIES = ["Germany", "Austria"];

/** Why an enrolment should stop now, or null to keep going. */
export function stopReason(e: EnrollmentState, lead: LeadState, totalSteps: number): { status: string; reason: string } | null {
  if (lead.lastReplyAt && lead.lastReplyAt > e.createdAt) return { status: "REPLIED", reason: "They replied" };
  if (CLOSED_STAGES.includes(lead.stage as Stage)) return { status: "STOPPED", reason: "Deal closed" };
  if (!lead.email) return { status: "FAILED", reason: "No email address" };
  if (e.stepIndex >= totalSteps) return { status: "COMPLETED", reason: "All emails sent" };
  return null;
}

/**
 * When the next step goes out: `waitDays` after the previous email (or after enrolment for the first),
 * moved to 09:00 local time if it would land at night, and never in the past.
 */
export function nextRunAt(from: Date, waitDays: number, now: Date = new Date()): Date {
  const at = new Date(from.getTime() + Math.max(0, waitDays) * DAY_MS);
  if (waitDays > 0) {
    const h = at.getHours();
    if (h < 8 || h >= 18) {
      if (h >= 18) at.setDate(at.getDate() + 1);
      at.setHours(9, 0, 0, 0);
    }
  }
  return at < now ? now : at;
}

/** Sending limits per mailbox, to protect deliverability (Gmail allows ~500/day on free accounts). */
export const SEQUENCE_LIMITS = { perRunPerMailbox: 25, perDayPerMailbox: 120 };

export function enrollmentLabel(status: string): string {
  return (
    {
      PENDING_APPROVAL: "Waiting for approval",
      ACTIVE: "Active",
      COMPLETED: "Finished",
      REPLIED: "Replied",
      STOPPED: "Stopped",
      FAILED: "Couldn't send",
    } as Record<string, string>
  )[status] ?? status;
}
