export const ROLES = ["OWNER", "TEAM_LEAD", "REP"] as const;
export type Role = (typeof ROLES)[number];

export const STAGES = ["NEW", "CONTACTED", "MEETING_BOOKED", "PROPOSAL_SENT", "WON", "LOST"] as const;
export type Stage = (typeof STAGES)[number];
export const OPEN_STAGES: Stage[] = ["NEW", "CONTACTED", "MEETING_BOOKED", "PROPOSAL_SENT"];

export const STAGE_LABELS: Record<Stage, string> = {
  NEW: "New lead",
  CONTACTED: "Contacted",
  MEETING_BOOKED: "Meeting booked",
  PROPOSAL_SENT: "Proposal sent",
  WON: "Won",
  LOST: "Lost",
};

export const ACTIVITY_TYPES = ["CALL", "EMAIL_OUT", "EMAIL_IN", "MEETING", "VISIT", "NOTE", "PROPOSAL"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  CALL: "Call",
  EMAIL_OUT: "Email sent",
  EMAIL_IN: "Email received",
  MEETING: "Meeting",
  VISIT: "Site visit",
  NOTE: "Note",
  PROPOSAL: "Proposal sent",
};

export const OUTCOMES = ["CONNECTED", "NO_ANSWER", "VOICEMAIL", "INTERESTED", "NOT_INTERESTED"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABELS: Record<Outcome, string> = {
  CONNECTED: "Spoke to them",
  NO_ANSWER: "No answer",
  VOICEMAIL: "Left voicemail",
  INTERESTED: "Interested",
  NOT_INTERESTED: "Not interested",
};

export const GOAL_METRICS = ["CALLS", "EMAILS", "MEETINGS", "DEALS_WON", "REVENUE_WON"] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];
export const GOAL_PERIODS = ["WEEK", "MONTH"] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number];

export const GOAL_LABELS: Record<GoalMetric, string> = {
  CALLS: "Calls",
  EMAILS: "Emails sent",
  MEETINGS: "Meetings",
  DEALS_WON: "Deals won",
  REVENUE_WON: "Revenue won (£)",
};

/** Days until the next follow-up after an unanswered touch, per stage. */
export const CADENCE_DAYS: Partial<Record<Stage, number>> = {
  NEW: 1,
  CONTACTED: 14,
  MEETING_BOOKED: 1,
  PROPOSAL_SENT: 7,
};

/** After this many unanswered touches in a round, the lead needs a keep/close decision. */
export const MAX_UNANSWERED_TOUCHES = 6;

/** Open leads with no contact for this many days count as stalled on the manager view. */
export const STALLED_AFTER_DAYS = 14;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function isStage(v: unknown): v is Stage {
  return typeof v === "string" && (STAGES as readonly string[]).includes(v);
}
export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}
export function isActivityType(v: unknown): v is ActivityType {
  return typeof v === "string" && (ACTIVITY_TYPES as readonly string[]).includes(v);
}
export function isOutcome(v: unknown): v is Outcome {
  return typeof v === "string" && (OUTCOMES as readonly string[]).includes(v);
}

export function stageIndex(s: Stage): number {
  return STAGES.indexOf(s);
}

export function formatGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(
    pence / 100,
  );
}

export function startOfWeek(now: Date): Date {
  // Monday 00:00 local time
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

export function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function endOfDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d;
}
