/** Sequence timing and stop rules. Pure, unit-tested. */
import { CLOSED_STAGES, DAY_MS, type Stage } from "./domain";
import { localClock } from "./timezones";

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

/** Sequence emails go out on weekdays between these times, in the lead's own time zone. */
export const SEND_WINDOW = { startMinutes: 9 * 60, endMinutes: 16 * 60, days: [1, 2, 3, 4, 5] };

export function inSendWindow(zone: string, at: Date): boolean {
  const { day, minutes } = localClock(zone, at);
  return SEND_WINDOW.days.includes(day) && minutes >= SEND_WINDOW.startMinutes && minutes < SEND_WINDOW.endMinutes;
}

/**
 * The next moment the send window opens for this time zone (or `at` itself when it's already open),
 * plus `spreadMinutes` so a batch doesn't all go out at exactly 9:00.
 */
export function nextSendTime(zone: string, at: Date, spreadMinutes = 0): Date {
  if (inSendWindow(zone, at)) return at;
  const step = 15 * 60_000;
  let t = new Date(Math.ceil(at.getTime() / step) * step);
  for (let i = 0; i < 4 * 24 * 8 && !inSendWindow(zone, t); i++) t = new Date(t.getTime() + step);
  return new Date(t.getTime() + spreadMinutes * 60_000);
}

/** A stable 0–44 minute offset per enrolment, to spread a batch across the first part of the morning. */
export function spreadFor(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 45;
}
