import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, EMPTY, domainOf, runReport, sanitizeConfig } from "../reports";

const rows = [
  { domain: "a.com", segment: "Spa", priority: "A", firstYear: 100 },
  { domain: "a.com", segment: "Spa", priority: "B", firstYear: 50 },
  { domain: "b.com", segment: "Gym", priority: "A", firstYear: 30 },
  { domain: null, segment: "Gym", priority: "C", firstYear: 10 },
];

describe("report engine", () => {
  it("counts records grouped and segmented, largest group first", () => {
    const r = runReport(rows, { ...DEFAULT_CONFIG, groupBy: "domain", segmentBy: "priority", op: "count", includeEmpty: false });
    expect(r.groups).toEqual(["a.com", "b.com"]);
    expect(r.segments).toEqual(["A", "B"]); // C only appears on the empty-domain row, which is excluded
    expect(r.values).toEqual([[1, 1], [1, 0]]);
    expect(r.groupTotals).toEqual([2, 1]);
    expect(r.rowCount).toBe(3);
  });

  it("includes empty values when asked", () => {
    const r = runReport(rows, { ...DEFAULT_CONFIG, groupBy: "domain", segmentBy: null, includeEmpty: true });
    expect(r.groups).toContain(EMPTY);
  });

  it("sums and averages a measure", () => {
    const sum = runReport(rows, { ...DEFAULT_CONFIG, groupBy: "segment", segmentBy: null, op: "sum", measure: "firstYear" });
    expect(Object.fromEntries(sum.groups.map((g, i) => [g, sum.groupTotals[i]]))).toEqual({ Spa: 150, Gym: 40 });
    const avg = runReport(rows, { ...DEFAULT_CONFIG, groupBy: "segment", segmentBy: null, op: "avg", measure: "firstYear" });
    expect(avg.groupTotals[avg.groups.indexOf("Spa")]).toBe(75);
  });

  it("keeps only the chosen segment values", () => {
    const r = runReport(rows, { ...DEFAULT_CONFIG, groupBy: "segment", segmentBy: "priority", segmentValues: ["A"] });
    expect(r.segments).toEqual(["A"]);
    expect(r.allSegments).toEqual(["A", "B", "C"]);
  });
});

describe("report config", () => {
  it("repairs invalid saved configs", () => {
    const c = sanitizeConfig({ source: "nope", op: "sum", measure: "evil", groupBy: "domain", segmentBy: "domain", chart: "3d" });
    expect(c).toMatchObject({ source: "leads", op: "count", measure: null, groupBy: "domain", segmentBy: null, chart: "bar" });
  });
  it("reads domains from websites", () => {
    expect(domainOf("https://www.canva.com/x")).toBe("canva.com");
    expect(domainOf("shop.co.th")).toBe("shop.co.th");
    expect(domainOf(null)).toBeNull();
  });
});
