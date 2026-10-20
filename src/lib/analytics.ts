/** Pure calculations behind the dashboard. Everything works from real records passed in. */

export const RANGES = ["1D", "1W", "1M", "6M", "1Y", "ALL"] as const;
export type Range = (typeof RANGES)[number];

export type MoneyPoint = { at: Date; amount: number };
export type Bucket = { start: Date; end: Date; label: string; tooltip: string; value: number };

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", o);

/** Buckets for a time range ending now, oldest first. Also returns the equal-length previous period. */
export function rangeBuckets(range: Range, now: Date, earliest?: Date): { buckets: Bucket[]; previousStart: Date; start: Date } {
  const buckets: Bucket[] = [];
  if (range === "1D") {
    const end = new Date(now);
    end.setMinutes(0, 0, 0);
    for (let i = 23; i >= 0; i--) {
      const s = new Date(end.getTime() - i * 3600_000);
      buckets.push({ start: s, end: new Date(s.getTime() + 3600_000), label: `${String(s.getHours()).padStart(2, "0")}:00`, tooltip: `${fmt(s, { day: "numeric", month: "short" })} ${String(s.getHours()).padStart(2, "0")}:00`, value: 0 });
    }
  } else if (range === "1W" || range === "1M") {
    const days = range === "1W" ? 7 : 30;
    const today = startOfDay(now);
    for (let i = days - 1; i >= 0; i--) {
      const s = new Date(today.getTime() - i * DAY);
      buckets.push({ start: s, end: new Date(s.getTime() + DAY), label: range === "1W" ? fmt(s, { weekday: "short" }) : fmt(s, { day: "numeric", month: "short" }), tooltip: fmt(s, { weekday: "short", day: "numeric", month: "short", year: "numeric" }), value: 0 });
    }
  } else {
    const months = range === "6M" ? 6 : range === "1Y" ? 12 : Math.max(6, monthsBetween(earliest ?? now, now) + 1);
    const thisMonth = startOfMonth(now);
    for (let i = months - 1; i >= 0; i--) {
      const s = addMonths(thisMonth, -i);
      buckets.push({ start: s, end: addMonths(s, 1), label: fmt(s, { month: "short" }), tooltip: fmt(s, { month: "short", year: "numeric" }), value: 0 });
    }
  }
  const start = buckets[0].start;
  const span = buckets[buckets.length - 1].end.getTime() - start.getTime();
  return { buckets, start, previousStart: new Date(start.getTime() - span) };
}

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export type Series = { buckets: Bucket[]; total: number; previousTotal: number; changePct: number | null };

/** Sums amounts into the range's buckets and compares with the previous period of the same length. */
export function revenueSeries(points: MoneyPoint[], range: Range, now: Date): Series {
  const earliest = points.reduce<Date | undefined>((m, p) => (!m || p.at < m ? p.at : m), undefined);
  const { buckets, start, previousStart } = rangeBuckets(range, now, earliest);
  let previousTotal = 0;
  for (const p of points) {
    const t = p.at.getTime();
    if (t >= previousStart.getTime() && t < start.getTime()) previousTotal += p.amount;
    const b = buckets.find((x) => t >= x.start.getTime() && t < x.end.getTime());
    if (b) b.value += p.amount;
  }
  const total = buckets.reduce((s, b) => s + b.value, 0);
  return { buckets, total, previousTotal, changePct: range === "ALL" ? null : pctChange(total, previousTotal) };
}

/** Percentage change, or null when there's nothing to compare with. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Smooth SVG path through points using monotone cubic interpolation (Fritsch–Carlson), so the curve
 * never overshoots: it can't dip below zero or above a peak between two data points.
 */
export function smoothPath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  const dx = pts.slice(1).map((p, i) => p.x - pts[i].x);
  const slope = pts.slice(1).map((p, i) => (p.y - pts[i].y) / (dx[i] || 1));
  const m = pts.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    return slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  const r = (v: number) => Math.round(v * 10) / 10;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${r(pts[i].x + h)},${r(pts[i].y + m[i] * h)} ${r(pts[i + 1].x - h)},${r(pts[i + 1].y - m[i + 1] * h)} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

/** A "nice" axis maximum (1, 2, 2.5, 5 × 10ⁿ) at or above the largest value. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

export type Slot = { start: Date; end: Date };

/** Free gaps of at least `minMinutes` between meetings inside working hours (default 09:00–18:00). */
export function freeSlots(meetings: Slot[], day: Date, opts: { startHour?: number; endHour?: number; minMinutes?: number } = {}): Slot[] {
  const { startHour = 9, endHour = 18, minMinutes = 30 } = opts;
  const dayStart = new Date(day);
  dayStart.setHours(startHour, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(endHour, 0, 0, 0);
  const sorted = meetings
    .filter((m) => m.end > dayStart && m.start < dayEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const gaps: Slot[] = [];
  let cursor = dayStart;
  for (const m of sorted) {
    if (m.start.getTime() - cursor.getTime() >= minMinutes * 60_000) gaps.push({ start: cursor, end: m.start });
    if (m.end > cursor) cursor = m.end;
  }
  if (dayEnd.getTime() - cursor.getTime() >= minMinutes * 60_000) gaps.push({ start: cursor, end: dayEnd });
  return gaps;
}

// ---------- Dashboard layout (Customize Widget) ----------

export const WIDGETS = ["kpis", "revenue", "calendar", "leads", "retention", "locations"] as const;
export type WidgetId = (typeof WIDGETS)[number];
export const WIDGET_LABELS: Record<WidgetId, string> = {
  kpis: "Key numbers",
  revenue: "Revenue",
  calendar: "Calendar",
  leads: "Leads management",
  retention: "Care-plan retention",
  locations: "Top customer locations",
};
export type DashboardLayout = { order: WidgetId[]; hidden: WidgetId[] };
export const DEFAULT_LAYOUT: DashboardLayout = { order: [...WIDGETS], hidden: [] };

/** Accepts whatever was saved and returns a valid layout: unknown ids dropped, missing ones appended. */
export function sanitizeLayout(raw: unknown): DashboardLayout {
  const o = (raw && typeof raw === "object" ? raw : {}) as { order?: unknown; hidden?: unknown };
  const known = (v: unknown): v is WidgetId => typeof v === "string" && (WIDGETS as readonly string[]).includes(v);
  const order = Array.isArray(o.order) ? [...new Set(o.order.filter(known))] : [];
  for (const w of WIDGETS) if (!order.includes(w)) order.push(w);
  const hidden = Array.isArray(o.hidden) ? [...new Set(o.hidden.filter(known))] : [];
  return { order, hidden };
}
