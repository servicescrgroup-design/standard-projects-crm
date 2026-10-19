import { describe, expect, it } from "vitest";
import { buildQueue, type QueueLead } from "../queue";
import { DAY_MS } from "../domain";

const now = new Date("2026-10-19T10:00:00");
let n = 0;
const lead = (over: Partial<QueueLead> = {}): QueueLead => ({
  id: `l${n++}`,
  stage: "CONTACTED",
  value: 0,
  monthlyValue: 0,
  nextFollowUpAt: new Date(now.getTime() - DAY_MS),
  lastContactAt: null,
  lastReplyAt: null,
  unansweredTouches: 0,
  ...over,
});

describe("buildQueue", () => {
  it("excludes leads not yet due and closed leads", () => {
    const q = buildQueue(
      [
        lead({ nextFollowUpAt: new Date(now.getTime() + 3 * DAY_MS) }),
        lead({ stage: "WON" }),
        lead({ stage: "LOST" }),
      ],
      now,
    );
    expect(q).toHaveLength(0);
  });

  it("includes leads due later today and new leads with no date", () => {
    const later = new Date(now);
    later.setHours(18);
    const q = buildQueue([lead({ nextFollowUpAt: later }), lead({ stage: "NEW", nextFollowUpAt: null })], now);
    expect(q).toHaveLength(2);
  });

  it("puts replies waiting on us first", () => {
    const replied = lead({
      lastContactAt: new Date(now.getTime() - 2 * DAY_MS),
      lastReplyAt: new Date(now.getTime() - DAY_MS),
      nextFollowUpAt: new Date(now.getTime() + 5 * DAY_MS),
    });
    const bigDeal = lead({ stage: "PROPOSAL_SENT", value: 500000 });
    const q = buildQueue([bigDeal, replied], now);
    expect(q[0].lead.id).toBe(replied.id);
    expect(q[0].reasons[0]).toMatch(/replied/);
  });

  it("ranks proposals and bigger deals above small cold follow-ups", () => {
    const small = lead({ value: 10000 });
    const proposal = lead({ stage: "PROPOSAL_SENT", value: 249900 });
    const q = buildQueue([small, proposal], now);
    expect(q.map((i) => i.lead.id)).toEqual([proposal.id, small.id]);
  });

  it("annualises monthly revenue", () => {
    const oneOff = lead({ value: 50000 });
    const recurring = lead({ monthlyValue: 10000 });
    const q = buildQueue([oneOff, recurring], now);
    expect(q[0].lead.id).toBe(recurring.id);
  });

  it("sinks leads that need a keep-or-close decision and flags them", () => {
    const exhausted = lead({ stage: "PROPOSAL_SENT", unansweredTouches: 6 });
    const normal = lead();
    const q = buildQueue([exhausted, normal], now);
    expect(q[1].lead.id).toBe(exhausted.id);
    expect(q[1].needsDecision).toBe(true);
  });

  it("never asks for a decision on a lead that has replied", () => {
    const q = buildQueue(
      [lead({ unansweredTouches: 6, lastReplyAt: new Date(now.getTime() - 3600_000), lastContactAt: null })],
      now,
    );
    expect(q[0].needsDecision).toBe(false);
  });

  it("explains overdue days", () => {
    const q = buildQueue([lead({ nextFollowUpAt: new Date(now.getTime() - 5 * DAY_MS) })], now);
    expect(q[0].reasons).toContain("Overdue 5 days");
  });
});
