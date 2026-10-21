import { DAY_MS, OPEN_STAGES, endOfDay, formatMoney, touchLimit, type Stage } from "./domain";

export type QueueLead = {
  id: string;
  stage: string;
  value: number;
  monthlyValue: number;
  nextFollowUpAt: Date | null;
  lastContactAt: Date | null;
  lastReplyAt: Date | null;
  unansweredTouches: number;
  priority?: string | null;
};

/** The columns the queue needs; select only these so pages don't load whole lead records. */
export const QUEUE_SELECT = {
  id: true,
  stage: true,
  value: true,
  monthlyValue: true,
  nextFollowUpAt: true,
  lastContactAt: true,
  lastReplyAt: true,
  unansweredTouches: true,
  priority: true,
} as const;

export type QueueItem<T extends QueueLead> = {
  lead: T;
  score: number;
  reasons: string[];
  needsDecision: boolean;
};

const STAGE_WEIGHT: Partial<Record<Stage, number>> = {
  NEGOTIATION: 35,
  PROPOSAL_SENT: 30,
  MEETING_BOOKED: 25,
  NEW: 15,
  CONTACTED: 10,
};

export function isAwaitingOurReply(lead: QueueLead): boolean {
  return !!lead.lastReplyAt && (!lead.lastContactAt || lead.lastReplyAt > lead.lastContactAt);
}

/** A lead is due today if its follow-up date has arrived, it has none yet, or they replied and we haven't. */
export function isDue(lead: QueueLead, now: Date): boolean {
  if (!OPEN_STAGES.includes(lead.stage as Stage)) return false;
  if (isAwaitingOurReply(lead)) return true;
  return !lead.nextFollowUpAt || lead.nextFollowUpAt <= endOfDay(now);
}

/**
 * Scores a due lead so the most valuable, most urgent work rises to the top of the rep's day.
 * Replies waiting on us beat everything; then deal stage, deal size and how overdue it is.
 */
export function scoreLead<T extends QueueLead>(lead: T, now: Date): QueueItem<T> {
  const reasons: string[] = [];
  let score = 0;

  const awaitingReply = isAwaitingOurReply(lead);
  if (awaitingReply) {
    score += 50;
    reasons.push("Replied · waiting on you");
  }

  score += STAGE_WEIGHT[lead.stage as Stage] ?? 0;

  // Lead-list priority (A = strongest fit) breaks ties between otherwise similar prospects.
  if (lead.priority === "A") {
    score += 12;
    reasons.push("Priority A");
  } else if (lead.priority === "B") {
    score += 5;
  }

  // Annualise recurring revenue so ฿3,000/mo outranks a ฿20,000 one-off. A ฿200k+ deal earns the full 25.
  const dealMinor = lead.value + lead.monthlyValue * 12;
  if (dealMinor > 0) {
    score += Math.min(25, dealMinor / 100 / 8000);
    reasons.push(lead.monthlyValue > 0 ? `${formatMoney(lead.monthlyValue)}/mo` : formatMoney(lead.value));
  }

  if (lead.nextFollowUpAt) {
    const overdueDays = Math.floor((endOfDay(now).getTime() - lead.nextFollowUpAt.getTime()) / DAY_MS);
    if (overdueDays >= 1) {
      score += Math.min(overdueDays, 14) * 2;
      reasons.push(`Overdue ${overdueDays} day${overdueDays === 1 ? "" : "s"}`);
    }
  } else if (lead.stage === "NEW") {
    reasons.push("New, not contacted yet");
  }

  // A reply means the round isn't unanswered any more, whatever the counter says.
  const needsDecision = !awaitingReply && lead.unansweredTouches >= touchLimit(lead.stage);
  if (needsDecision) {
    // Push to the bottom: a decision is needed, not another chase.
    score -= 40;
    reasons.push(`${lead.unansweredTouches} unanswered touches: keep or close?`);
  }

  return { lead, score: Math.round(score * 10) / 10, reasons, needsDecision };
}

export function buildQueue<T extends QueueLead>(leads: T[], now: Date = new Date()): QueueItem<T>[] {
  return leads
    .filter((l) => isDue(l, now))
    .map((l) => scoreLead(l, now))
    .sort((a, b) => b.score - a.score);
}
