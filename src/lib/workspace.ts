/** Pure helpers for the Workspace page (lead interest, task titles, schedule layout). Unit-tested. */
import { DAY_MS, type Stage } from "./domain";

export type Interest = "hot" | "great" | "medium" | "unrated";
export const INTEREST_LABELS: Record<Interest, string> = { hot: "Hot client", great: "Great interest", medium: "Medium interest", unrated: "Not rated" };

/** Lead-list priority as an interest level, plus how many of the five dots light up. */
export function interestOf(priority: string | null | undefined): { level: Interest; dots: number } {
  if (priority === "A") return { level: "hot", dots: 5 };
  if (priority === "B") return { level: "great", dots: 4 };
  if (priority === "C") return { level: "medium", dots: 3 };
  return { level: "unrated", dots: 1 };
}

export type TaskKind = "reply" | "call" | "meeting" | "proposal" | "close";

/** What the rep should do next on a lead, as a short task title. */
export function taskFor(stage: string, awaitingReply: boolean): { title: string; kind: TaskKind } {
  if (awaitingReply) return { title: "Reply to their email", kind: "reply" };
  switch (stage as Stage) {
    case "NEW":
      return { title: "First call", kind: "call" };
    case "CONTACTED":
      return { title: "Follow-up call", kind: "call" };
    case "MEETING_BOOKED":
      return { title: "Discovery meeting", kind: "meeting" };
    case "PROPOSAL_SENT":
      return { title: "Chase the proposal", kind: "proposal" };
    case "NEGOTIATION":
      return { title: "Close the deal", kind: "close" };
    default:
      return { title: "Check in", kind: "call" };
  }
}

export type DueState = "overdue" | "today" | "upcoming" | "none";
export function dueState(nextFollowUpAt: Date | null, now: Date): DueState {
  if (!nextFollowUpAt) return "none";
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (nextFollowUpAt < start) return "overdue";
  if (nextFollowUpAt < new Date(start.getTime() + DAY_MS)) return "today";
  return "upcoming";
}

/** Places today's meetings on a day timeline (default 08:00–20:00) as left/width percentages. */
export function scheduleLayout(
  meetings: { id: string; start: Date }[],
  day: Date,
  fromHour = 8,
  toHour = 20,
  slotMinutes = 60,
): { id: string; left: number; width: number }[] {
  const start = new Date(day);
  start.setHours(fromHour, 0, 0, 0);
  const span = (toHour - fromHour) * 60 * 60 * 1000;
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  return meetings.map((m) => {
    const left = clamp(((m.start.getTime() - start.getTime()) / span) * 100);
    const width = Math.min(100 - left, ((slotMinutes * 60 * 1000) / span) * 100);
    return { id: m.id, left, width };
  });
}

/** Where "now" sits on the same timeline, or null outside working hours. */
export function nowPosition(now: Date, fromHour = 8, toHour = 20): number | null {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < fromHour || h > toHour) return null;
  return ((h - fromHour) / (toHour - fromHour)) * 100;
}
