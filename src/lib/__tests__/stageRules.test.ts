import { describe, expect, it } from "vitest";
import { applyActivity, type LeadState } from "../stageRules";
import { DAY_MS } from "../domain";

const now = new Date("2026-10-19T10:00:00Z");
const lead = (over: Partial<LeadState> = {}): LeadState => ({
  stage: "NEW",
  lastContactAt: null,
  lastReplyAt: null,
  unansweredTouches: 0,
  nextFollowUpAt: null,
  ...over,
});

describe("applyActivity", () => {
  it("moves a new lead to Contacted on first outbound email and schedules the cadence", () => {
    const p = applyActivity(lead(), { type: "EMAIL_OUT", occurredAt: now }, now);
    expect(p.stage).toBe("CONTACTED");
    expect(p.unansweredTouches).toBe(1);
    expect(p.nextFollowUpAt?.getTime()).toBe(now.getTime() + 14 * DAY_MS);
  });

  it("books a meeting from a calendar event and follows up the day after it", () => {
    const meeting = new Date(now.getTime() + 3 * DAY_MS);
    const p = applyActivity(lead({ stage: "CONTACTED" }), { type: "MEETING", occurredAt: meeting }, now);
    expect(p.stage).toBe("MEETING_BOOKED");
    expect(p.nextFollowUpAt?.getTime()).toBe(meeting.getTime() + DAY_MS);
    expect(p.unansweredTouches).toBe(0);
  });

  it("never moves stages backwards", () => {
    const p = applyActivity(lead({ stage: "PROPOSAL_SENT" }), { type: "MEETING", occurredAt: now }, now);
    expect(p.stage).toBeUndefined();
  });

  it("uses the 7-day proposal cadence", () => {
    const p = applyActivity(lead({ stage: "MEETING_BOOKED" }), { type: "PROPOSAL", occurredAt: now }, now);
    expect(p.stage).toBe("PROPOSAL_SENT");
    expect(p.nextFollowUpAt?.getTime()).toBe(now.getTime() + 7 * DAY_MS);
  });

  it("a reply resets the unanswered counter and makes the lead due now", () => {
    const p = applyActivity(
      lead({ stage: "CONTACTED", unansweredTouches: 4 }),
      { type: "EMAIL_IN", occurredAt: now },
      now,
    );
    expect(p.unansweredTouches).toBe(0);
    expect(p.lastReplyAt).toEqual(now);
    expect(p.nextFollowUpAt).toEqual(now);
    expect(p.lastContactAt).toBeUndefined();
  });

  it("counts no-answer calls as unanswered touches", () => {
    const p = applyActivity(
      lead({ stage: "CONTACTED", unansweredTouches: 2 }),
      { type: "CALL", outcome: "NO_ANSWER", occurredAt: now },
      now,
    );
    expect(p.unansweredTouches).toBe(3);
  });

  it("marks the lead lost when they say not interested", () => {
    const p = applyActivity(
      lead({ stage: "CONTACTED" }),
      { type: "CALL", outcome: "NOT_INTERESTED", occurredAt: now },
      now,
    );
    expect(p.stage).toBe("LOST");
    expect(p.nextFollowUpAt).toBeNull();
  });

  it("leaves won leads alone", () => {
    const p = applyActivity(lead({ stage: "WON" }), { type: "CALL", outcome: "CONNECTED", occurredAt: now }, now);
    expect(p.stage).toBeUndefined();
    expect(p.nextFollowUpAt).toBeNull();
  });

  it("an explicit follow-up date beats the cadence", () => {
    const chosen = new Date("2026-11-01T09:00:00Z");
    const p = applyActivity(lead(), { type: "CALL", outcome: "CONNECTED", occurredAt: now, nextFollowUpAt: chosen }, now);
    expect(p.nextFollowUpAt).toEqual(chosen);
  });

  it("notes don't change stage or contact dates", () => {
    const p = applyActivity(lead(), { type: "NOTE", occurredAt: now }, now);
    expect(p).toEqual({});
  });
});
