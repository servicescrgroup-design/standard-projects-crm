/** Report builder: configuration, available fields and the aggregation engine (pure, tested). */

export const DATA_SOURCES = ["leads", "activities"] as const;
export type DataSource = (typeof DATA_SOURCES)[number];
export const SOURCE_NAMES: Record<DataSource, string> = { leads: "Company", activities: "Activity" };

export const OPS = ["count", "sum", "avg", "min", "max"] as const;
export type Op = (typeof OPS)[number];
export const OP_NAMES: Record<Op, string> = { count: "Count records", sum: "Sum", avg: "Average", min: "Minimum", max: "Maximum" };

export const CHARTS = ["bar", "stacked", "line", "area", "pie", "table"] as const;
export type Chart = (typeof CHARTS)[number];
export const CHART_NAMES: Record<Chart, string> = { bar: "Bar chart", stacked: "Stacked bar", line: "Line", area: "Area", pie: "Pie / donut", table: "Table only" };

/** Grouping/segment fields per data source (key → label). */
export const DIMENSIONS: Record<DataSource, Record<string, string>> = {
  leads: {
    domain: "Domains",
    stage: "Stage",
    segment: "Segment",
    priority: "Priority",
    source: "Lead source",
    industry: "Industry",
    location: "Area",
    owner: "Owner",
    serviceInterest: "Category",
    createdMonth: "Month added",
    wonMonth: "Month won",
  },
  activities: { type: "Activity type", outcome: "Outcome", by: "Logged by", month: "Month", company: "Company", channel: "Channel" },
};

/** Numeric fields that sum/avg/min/max can use (values in the row, already in display units). */
export const MEASURES: Record<DataSource, Record<string, string>> = {
  leads: { firstYear: "Deal value, first year (฿)", value: "One-off value (฿)", monthly: "Monthly care plan (฿)", googleReviews: "Google reviews", googleRating: "Google rating" },
  activities: {},
};

export type ReportConfig = {
  source: DataSource;
  op: Op;
  measure: string | null;
  groupBy: string | null;
  includeEmpty: boolean;
  segmentBy: string | null;
  segmentValues: string[] | null; // null = all
  chart: Chart;
};

export const DEFAULT_CONFIG: ReportConfig = {
  source: "leads",
  op: "count",
  measure: null,
  groupBy: "segment",
  includeEmpty: false,
  segmentBy: "priority",
  segmentValues: null,
  chart: "stacked",
};

/** Accepts anything (saved JSON, request body) and returns a valid config. */
export function sanitizeConfig(raw: unknown): ReportConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const source: DataSource = DATA_SOURCES.includes(o.source as DataSource) ? (o.source as DataSource) : "leads";
  const dims = DIMENSIONS[source];
  const measures = MEASURES[source];
  let op: Op = OPS.includes(o.op as Op) ? (o.op as Op) : "count";
  const measure = typeof o.measure === "string" && o.measure in measures ? o.measure : null;
  if (op !== "count" && !measure) op = "count";
  const groupBy = typeof o.groupBy === "string" && o.groupBy in dims ? o.groupBy : null;
  const segmentBy = typeof o.segmentBy === "string" && o.segmentBy in dims && o.segmentBy !== groupBy ? o.segmentBy : null;
  const segmentValues = Array.isArray(o.segmentValues) ? o.segmentValues.filter((v): v is string => typeof v === "string").slice(0, 50) : null;
  const chart: Chart = CHARTS.includes(o.chart as Chart) ? (o.chart as Chart) : "bar";
  return { source, op, measure: op === "count" ? null : measure, groupBy, includeEmpty: o.includeEmpty === true, segmentBy, segmentValues: segmentBy ? segmentValues : null, chart };
}

export type ReportRow = Record<string, string | number | null>;
export const EMPTY = "(empty)";
export const TOTAL = "Total";

export type ReportResult = {
  groups: string[];
  segments: string[];
  /** values[g][s] for each group and segment */
  values: number[][];
  groupTotals: number[];
  allSegments: string[]; // every segment value present, for the "include values" picker
  rowCount: number;
};

function aggregate(nums: number[], op: Op): number {
  if (op === "count") return nums.length;
  if (nums.length === 0) return 0;
  if (op === "sum") return nums.reduce((a, b) => a + b, 0);
  if (op === "avg") return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
  if (op === "min") return Math.min(...nums);
  return Math.max(...nums);
}

/** Groups rows, optionally segments them, and aggregates the metric. Groups sorted by total, descending. */
export function runReport(rows: ReportRow[], config: ReportConfig, maxGroups = 30): ReportResult {
  const key = (r: ReportRow, f: string | null) => {
    if (!f) return TOTAL;
    const v = r[f];
    return v === null || v === undefined || v === "" ? EMPTY : String(v);
  };
  const usable = config.groupBy && !config.includeEmpty ? rows.filter((r) => key(r, config.groupBy) !== EMPTY) : rows;
  const allSegments = config.segmentBy ? [...new Set(usable.map((r) => key(r, config.segmentBy)))].sort() : [TOTAL];
  const segments = config.segmentBy && config.segmentValues?.length ? allSegments.filter((s) => config.segmentValues!.includes(s)) : allSegments;
  const segSet = new Set(segments);

  const buckets = new Map<string, Map<string, number[]>>();
  for (const r of usable) {
    const s = key(r, config.segmentBy);
    if (!segSet.has(s)) continue;
    const g = key(r, config.groupBy);
    const m = config.op === "count" ? 1 : Number(r[config.measure ?? ""]);
    if (config.op !== "count" && !Number.isFinite(m)) continue;
    if (!buckets.has(g)) buckets.set(g, new Map());
    const inner = buckets.get(g)!;
    inner.set(s, [...(inner.get(s) ?? []), m]);
  }

  const totalOf = (g: string) => {
    const nums = [...(buckets.get(g)?.values() ?? [])].flat();
    return aggregate(nums, config.op);
  };
  const isTime = config.groupBy === "createdMonth" || config.groupBy === "wonMonth" || config.groupBy === "month";
  const groups = [...buckets.keys()]
    .sort((a, b) => (isTime ? a.localeCompare(b) : totalOf(b) - totalOf(a) || a.localeCompare(b)))
    .slice(0, maxGroups);

  return {
    groups,
    segments,
    values: groups.map((g) => segments.map((s) => aggregate(buckets.get(g)?.get(s) ?? [], config.op))),
    groupTotals: groups.map(totalOf),
    allSegments,
    rowCount: usable.length,
  };
}

/** "acme.co.th" from "https://www.acme.co.th/menu". */
export function domainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
