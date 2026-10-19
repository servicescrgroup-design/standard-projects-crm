import {
  CADENCE_DAYS,
  DAY_MS,
  type ActivityType,
  type Outcome,
  type Stage,
  isStage,
  stageIndex,
} from "./domain";

export type LeadState = {
  stage: string;
  lastContactAt: Date | null;
  lastReplyAt: Date | null;
  unansweredTouches: number;
  nextFollowUpAt: Date | null;
};

export type ActivityInput = {
  type: ActivityType;
  outcome?: Outcome | null;
  occurredAt: Date;
  /** Rep explicitly chose a follow-up date; takes priority over the cadence. */
  nextFollowUpAt?: Date | null;
};

export type LeadPatch = Partial<LeadState> & { stageChangedAt?: Date };

const OUTBOUND: ActivityType[] = ["CALL", "EMAIL_OUT", "MEETING", "VISIT", "PROPOSAL"];
const NO_REPLY_OUTCOMES: Outcome[] = ["NO_ANSWER", "VOICEMAIL"];

/** True when the contact actually engaged (replied, picked up, met). Resets the unanswered counter. */
export function isEngagement(a: ActivityInput): boolean {
  if (a.type === "EMAIL_IN" || a.type === "MEETING" || a.type === "VISIT") return true;
  if (a.type === "CALL") return !!a.outcome && !NO_REPLY_OUTCOMES.includes(a.outcome);
  return false;
}

/** An outbound touch that got no response. Counts towards MAX_UNANSWERED_TOUCHES. */
export function isUnansweredTouch(a: ActivityInput): boolean {
  if (a.type === "EMAIL_OUT" || a.type === "PROPOSAL") return true;
  return a.type === "CALL" && (!a.outcome || NO_REPLY_OUTCOMES.includes(a.outcome));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/**
 * Works out how logging an activity changes a lead, so reps never have to move stages or
 * set follow-up dates by hand. Stages only move forward, and Won/Lost are never changed.
 */
export function applyActivity(lead: LeadState, a: ActivityInput, now: Date = new Date()): LeadPatch {
  const patch: LeadPatch = {};
  const current: Stage = isStage(lead.stage) ? lead.stage : "NEW";
  const closed = current === "WON" || current === "LOST";

  if (a.type === "NOTE") {
    if (a.nextFollowUpAt) patch.nextFollowUpAt = a.nextFollowUpAt;
    return patch;
  }

  // --- stage progression ---
  let target: Stage = current;
  if (!closed) {
    if (a.type === "PROPOSAL") target = "PROPOSAL_SENT";
    else if (a.type === "MEETING") target = "MEETING_BOOKED";
    else if (OUTBOUND.includes(a.type) || a.type === "EMAIL_IN") target = "CONTACTED";
    if (a.type === "CALL" && a.outcome === "NOT_INTERESTED") target = "LOST";
    if (target !== "LOST" && stageIndex(target) <= stageIndex(current)) target = current;
  }
  if (target !== current) {
    patch.stage = target;
    patch.stageChangedAt = now;
  }

  // --- contact tracking ---
  if (a.type !== "EMAIL_IN" && (!lead.lastContactAt || a.occurredAt > lead.lastContactAt)) {
    patch.lastContactAt = a.occurredAt;
  }
  if (isEngagement(a)) {
    patch.unansweredTouches = 0;
    if (a.type === "EMAIL_IN") patch.lastReplyAt = a.occurredAt;
  } else if (isUnansweredTouch(a)) {
    patch.unansweredTouches = lead.unansweredTouches + 1;
  }

  // --- next follow-up ---
  const stageAfter: Stage = target;
  if (a.nextFollowUpAt) {
    patch.nextFollowUpAt = a.nextFollowUpAt;
  } else if (stageAfter === "WON" || stageAfter === "LOST") {
    patch.nextFollowUpAt = null;
  } else if (a.type === "EMAIL_IN") {
    // They replied: it's on us now.
    patch.nextFollowUpAt = now;
  } else if (a.type === "MEETING") {
    // Follow up the day after the meeting (meetings from the calendar may be in the future).
    const base = a.occurredAt > now ? a.occurredAt : now;
    patch.nextFollowUpAt = addDays(base, CADENCE_DAYS.MEETING_BOOKED ?? 1);
  } else {
    patch.nextFollowUpAt = addDays(now, CADENCE_DAYS[stageAfter] ?? 7);
  }

  return patch;
}
