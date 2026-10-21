export const ROLES = ["OWNER", "TEAM_LEAD", "REP"] as const;
export type Role = (typeof ROLES)[number];

/** Pipeline, following the "SOP Lead to Launch" in Notion. MEETING_BOOKED is the Discovery call stage. */
export const STAGES = [
  "NEW",
  "CONTACTED",
  "MEETING_BOOKED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "MAINTENANCE",
  "LOST",
] as const;
export type Stage = (typeof STAGES)[number];
export const OPEN_STAGES: Stage[] = ["NEW", "CONTACTED", "MEETING_BOOKED", "PROPOSAL_SENT", "NEGOTIATION"];
/** Stages that count as a won customer. */
export const WON_STAGES: Stage[] = ["WON", "MAINTENANCE"];
export const CLOSED_STAGES: Stage[] = ["WON", "MAINTENANCE", "LOST"];

export const STAGE_LABELS: Record<Stage, string> = {
  NEW: "Lead",
  CONTACTED: "Contacted",
  MEETING_BOOKED: "Discovery",
  PROPOSAL_SENT: "Proposal sent",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  MAINTENANCE: "Maintenance client",
  LOST: "Lost",
};

export const SOURCES = [
  "MANUAL",
  "WEBSITE",
  "QUOTE",
  "COLD_OUTREACH",
  "REFERRAL",
  "LINE",
  "FACEBOOK",
  "GOOGLE",
] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_LABELS: Record<Source, string> = {
  MANUAL: "Added by hand",
  WEBSITE: "Website enquiry",
  QUOTE: "Quote request",
  COLD_OUTREACH: "Cold outreach",
  REFERRAL: "Referral",
  LINE: "LINE",
  FACEBOOK: "Facebook",
  GOOGLE: "Google",
};

export const PRIORITIES = ["A", "B", "C"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = {
  A: "A · strongest",
  B: "B · good",
  C: "C · smaller / unconfirmed",
};

export const SEGMENTS = [
  "Consignment",
  "Spa",
  "Website-Marketing",
  "Rental",
  "Gym",
  "Export-Trading",
  "Multi-location",
  "Wellness",
  "Hospitality",
  "Restaurant",
  "Cannabis-CBD",
  "Trades",
  "Clinic",
  "Professional-Services",
  "Retail",
] as const;

export const PACKAGES = ["Starter", "Business", "Growth", "Custom"] as const;

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
  REVENUE_WON: "Revenue won (฿)",
};

/** Days until the next follow-up after an unanswered touch, per stage. */
export const CADENCE_DAYS: Partial<Record<Stage, number>> = {
  NEW: 1,
  CONTACTED: 14,
  MEETING_BOOKED: 1,
  PROPOSAL_SENT: 3,
  NEGOTIATION: 3,
};

/**
 * Proposal follow-ups per the SOP: day 2, day 5 and day 10 after sending, then mark Lost with a reason.
 * Index = unanswered touches so far in this proposal round (the proposal itself counts as the first).
 */
export const PROPOSAL_FOLLOW_UP_GAPS = [2, 3, 5];

/** After this many unanswered touches in a round, the lead needs a keep/close decision. */
export const MAX_UNANSWERED_TOUCHES = 6;

/** Unanswered touches allowed before a keep/close decision: proposals follow the SOP (sent + 3 chases). */
export function touchLimit(stage: string): number {
  return stage === "PROPOSAL_SENT" ? PROPOSAL_FOLLOW_UP_GAPS.length + 1 : MAX_UNANSWERED_TOUCHES;
}

/** Open leads with no contact for this many days count as stalled on the manager view. */
export const STALLED_AFTER_DAYS = 14;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function isSource(v: unknown): v is Source {
  return typeof v === "string" && (SOURCES as readonly string[]).includes(v);
}
export function isPriority(v: unknown): v is Priority {
  return typeof v === "string" && (PRIORITIES as readonly string[]).includes(v);
}
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

/** All money is stored in the currency's minor unit (satang for baht) as integers. */
export const CURRENCY = "THB";
export const CURRENCY_SYMBOL = "฿";

export function formatMoney(minor: number): string {
  return `${CURRENCY_SYMBOL}${Math.round(minor / 100).toLocaleString("en-GB")}`;
}

/** Parses what someone typed ("฿30,000", "30000", "1,250.50") into minor units; 0 if not a positive number. */
export function toMinor(raw: string): number {
  const n = Number(raw.replace(/[฿£$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
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

/** Kanban/table pill colours per stage (reference palette: grey, pastel blue, orange, mint, red). */
export const STAGE_PILL: Record<Stage, string> = {
  NEW: "bg-[#f0f1f3] text-[#475467]",
  CONTACTED: "bg-[#e0f2fe] text-[#075985]",
  MEETING_BOOKED: "bg-[#dbeafe] text-[#1e40af]",
  PROPOSAL_SENT: "bg-[#ffedd5] text-[#9a3412]",
  NEGOTIATION: "bg-[#fef3c7] text-[#92400e]",
  WON: "bg-[#d5f5e8] text-[#146c4b]",
  MAINTENANCE: "bg-[#e9e3ff] text-[#5b3cc4]",
  LOST: "bg-[#ffdada] text-[#a93f42]",
};

/** Position for a card dropped between two neighbours (null = column edge). */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1000;
  if (before === null) return (after as number) - 1000;
  if (after === null) return before + 1000;
  return (before + after) / 2;
}
