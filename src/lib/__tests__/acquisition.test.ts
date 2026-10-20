import { describe, expect, it } from "vitest";
import { computeCAC, recentMonths } from "../acquisition";

const now = new Date(2026, 9, 20);

describe("customer acquisition cost", () => {
  it("covers the current month and the two before", () => {
    expect(recentMonths(now, 3)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("divides spend by won customers per source and flags the cheapest", () => {
    const r = computeCAC(
      [
        { source: "FACEBOOK", month: "2026-09", amount: 900_000 },
        { source: "FACEBOOK", month: "2026-10", amount: 300_000 },
        { source: "GOOGLE", month: "2026-10", amount: 400_000 },
        { source: "GOOGLE", month: "2026-01", amount: 999_999 }, // outside the window
      ],
      [
        { source: "FACEBOOK", wonAt: new Date(2026, 9, 1) },
        { source: "FACEBOOK", wonAt: new Date(2026, 8, 3) },
        { source: "GOOGLE", wonAt: new Date(2026, 9, 5) },
        { source: "REFERRAL", wonAt: new Date(2026, 9, 6) },
        { source: "REFERRAL", wonAt: new Date(2025, 0, 6) }, // outside the window
      ],
      now,
    );
    const by = Object.fromEntries(r.channels.map((c) => [c.source, c]));
    expect(by.FACEBOOK).toMatchObject({ spend: 1_200_000, customers: 2, cac: 600_000, share: 50 });
    expect(by.GOOGLE).toMatchObject({ spend: 400_000, customers: 1, cac: 400_000, mostEffective: true });
    expect(by.REFERRAL).toMatchObject({ spend: 0, customers: 1, share: 25, mostEffective: false });
    expect(r.average).toBe(Math.round(1_600_000 / 3));
    expect(r.newCustomers).toBe(4);
  });

  it("reports no average when no spend is recorded", () => {
    const r = computeCAC([], [{ source: "REFERRAL", wonAt: new Date(2026, 9, 6) }], now);
    expect(r.average).toBeNull();
    expect(r.hasSpend).toBe(false);
  });
});
