/** Call list rules: who to call next, and what each call outcome does. Pure, unit-tested. */
import { DAY_MS } from "./domain";
import { localClock } from "./timezones";

/** Businesses are worth calling on weekdays 9:00–17:30, their time. */
export function openForCalls(zone: string, at: Date): boolean {
  const { day, minutes } = localClock(zone, at);
  return day >= 1 && day <= 5 && minutes >= 9 * 60 && minutes < 17 * 60 + 30;
}

export type QueueLead = { id: string; priority: string | null; lastContactAt: Date | null; nextFollowUpAt: Date | null; openNow: boolean };

const PRIORITY_RANK: Record<string, number> = { A: 0, B: 1, C: 2 };

/** Open-now first, then follow-ups that are due, then priority A→C, then whoever was contacted longest ago (never first). */
export function sortQueue<T extends QueueLead>(leads: T[], now: Date): T[] {
  const due = (l: T) => (l.nextFollowUpAt && l.nextFollowUpAt <= now ? 0 : 1);
  return [...leads].sort(
    (a, b) =>
      Number(b.openNow) - Number(a.openNow) ||
      due(a) - due(b) ||
      (PRIORITY_RANK[a.priority ?? ""] ?? 3) - (PRIORITY_RANK[b.priority ?? ""] ?? 3) ||
      (a.lastContactAt?.getTime() ?? 0) - (b.lastContactAt?.getTime() ?? 0),
  );
}

export const CALL_OUTCOMES = [
  { id: "no_answer", label: "No answer", key: "n", needsDate: false },
  { id: "voicemail", label: "Left voicemail", key: "v", needsDate: false },
  { id: "callback", label: "Call back later", key: "c", needsDate: true },
  { id: "interested", label: "Interested", key: "i", needsDate: false },
  { id: "meeting", label: "Meeting booked", key: "m", needsDate: true },
  { id: "not_interested", label: "Not interested", key: "x", needsDate: false },
  { id: "wrong_number", label: "Wrong number", key: "w", needsDate: false },
] as const;
export type CallOutcomeId = (typeof CALL_OUTCOMES)[number]["id"];

export function isCallOutcome(v: unknown): v is CallOutcomeId {
  return CALL_OUTCOMES.some((o) => o.id === v);
}

/** 09:00 (server time) `days` from now: when to try again after no answer or a voicemail. */
export function retryAt(now: Date, days: number): Date {
  const d = new Date(now.getTime() + days * DAY_MS);
  d.setHours(9, 0, 0, 0);
  return d;
}
