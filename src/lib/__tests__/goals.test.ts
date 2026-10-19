import { describe, expect, it } from "vitest";
import { computeRepStats, leaderboardScore, progressPct } from "../goals";

describe("goals", () => {
  it("tallies activity and won revenue per rep", () => {
    const stats = computeRepStats(
      ["a", "b"],
      [
        { userId: "a", type: "CALL" },
        { userId: "a", type: "EMAIL_OUT" },
        { userId: "a", type: "EMAIL_IN" },
        { userId: "b", type: "MEETING" },
        { userId: "zzz", type: "CALL" },
      ],
      [{ ownerId: "b", value: 249900, monthlyValue: 4900 }],
    );
    expect(stats.get("a")).toMatchObject({ CALLS: 1, EMAILS: 1, MEETINGS: 0 });
    expect(stats.get("b")).toMatchObject({ MEETINGS: 1, DEALS_WON: 1, REVENUE_WON: 2499 + 588 });
  });

  it("caps progress at 100%", () => {
    expect(progressPct(30, 20)).toBe(100);
    expect(progressPct(5, 20)).toBe(25);
    expect(progressPct(5, 0)).toBe(0);
  });

  it("ranks by average attainment when goals exist", () => {
    const s = { CALLS: 10, EMAILS: 0, MEETINGS: 2, DEALS_WON: 0, REVENUE_WON: 0 };
    expect(leaderboardScore(s, [{ metric: "CALLS", target: 20 }, { metric: "MEETINGS", target: 2 }])).toBe(75);
  });
});
