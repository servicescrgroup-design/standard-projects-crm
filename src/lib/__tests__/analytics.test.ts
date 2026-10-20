import { describe, expect, it } from "vitest";
import { freeSlots, niceMax, pctChange, revenueSeries, sanitizeLayout, smoothPath } from "../analytics";

const now = new Date(2026, 9, 20, 14, 30); // 20 Oct 2026 14:30 local

describe("revenue series", () => {
  const points = [
    { at: new Date(2026, 9, 19, 10), amount: 100 }, // this month
    { at: new Date(2026, 9, 2, 10), amount: 50 }, // this month
    { at: new Date(2026, 8, 15, 10), amount: 30 }, // last month
    { at: new Date(2025, 0, 5, 10), amount: 999 }, // long ago
  ];

  it("buckets the last year by month and compares with the year before", () => {
    const s = revenueSeries(points, "1Y", now);
    expect(s.buckets).toHaveLength(12);
    expect(s.buckets.at(-1)!.label).toBe("Oct");
    expect(s.buckets.at(-1)!.value).toBe(150);
    expect(s.buckets.at(-2)!.value).toBe(30);
    expect(s.total).toBe(180);
    expect(s.previousTotal).toBe(999);
    expect(s.changePct).toBe(-82);
  });

  it("uses days for 1M and hours for 1D", () => {
    expect(revenueSeries(points, "1M", now).buckets).toHaveLength(30);
    const d = revenueSeries([...points, { at: new Date(2026, 9, 20, 9, 15), amount: 7 }], "1D", now);
    expect(d.buckets).toHaveLength(24);
    expect(d.total).toBe(7); // yesterday 10:00 is more than 24 hours before 14:30 today
    expect(d.buckets.find((b) => b.value === 7)!.label).toBe("09:00");
  });

  it("ALL starts at the first sale and has no comparison", () => {
    const s = revenueSeries(points, "ALL", now);
    expect(s.buckets[0].tooltip).toBe("Jan 2025");
    expect(s.total).toBe(1179);
    expect(s.changePct).toBeNull();
  });
});

describe("helpers", () => {
  it("pctChange handles empty previous periods", () => {
    expect(pctChange(120, 100)).toBe(20);
    expect(pctChange(0, 0)).toBe(0);
    expect(pctChange(5, 0)).toBeNull();
  });
  it("niceMax rounds up to tidy axis values", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(37)).toBe(50);
    expect(niceMax(180000)).toBe(200000);
  });
  it("smoothPath never overshoots below a flat baseline", () => {
    // y grows downward in SVG: 100 is the baseline (zero revenue)
    const d = smoothPath([{ x: 0, y: 100 }, { x: 10, y: 100 }, { x: 20, y: 20 }, { x: 30, y: 60 }]);
    const ys = [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[2]));
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(20);
  });

  it("smoothPath draws through every point", () => {
    const d = smoothPath([{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 5 }]);
    expect(d.startsWith("M0,10")).toBe(true);
    expect(d.endsWith("20,5")).toBe(true);
  });
});

describe("free time", () => {
  const day = new Date(2026, 9, 20);
  const at = (h: number, m = 0) => new Date(2026, 9, 20, h, m);
  it("finds gaps of 30+ minutes between meetings in working hours", () => {
    const gaps = freeSlots([{ start: at(9), end: at(10) }, { start: at(10, 45), end: at(11, 45) }], day);
    expect(gaps.map((g) => [g.start.getHours() * 60 + g.start.getMinutes(), g.end.getHours() * 60 + g.end.getMinutes()])).toEqual([
      [600, 645],
      [705, 1080],
    ]);
  });
  it("ignores gaps shorter than 30 minutes", () => {
    const gaps = freeSlots([{ start: at(9), end: at(17, 45) }], day);
    expect(gaps).toEqual([]);
  });
});

describe("dashboard layout", () => {
  it("repairs bad saved layouts instead of breaking", () => {
    expect(sanitizeLayout(null).order).toHaveLength(6);
    const l = sanitizeLayout({ order: ["revenue", "nope", "revenue"], hidden: ["calendar", 7] });
    expect(l.order[0]).toBe("revenue");
    expect(l.order).toHaveLength(6);
    expect(new Set(l.order).size).toBe(6);
    expect(l.hidden).toEqual(["calendar"]);
  });
});
