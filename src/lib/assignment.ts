/** Who gets a new enquiry: rules by country/industry, then round-robin. Pure, unit-tested. */

export type AssignmentSettings = {
  mode: "OFF" | "ROUND_ROBIN";
  /** People in the rotation, in order. */
  pool: string[];
  /** First matching rule wins; otherwise the rotation. */
  rules: { field: "country" | "industry"; value: string; userId: string }[];
  /** Which lead sources count as new enquiries. */
  sources: string[];
};

export const DEFAULT_ASSIGNMENT: AssignmentSettings = { mode: "OFF", pool: [], rules: [], sources: ["WEBSITE", "QUOTE"] };

export function sanitizeAssignment(raw: unknown, validUserIds: string[]): AssignmentSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const valid = new Set(validUserIds);
  const pool = Array.isArray(o.pool) ? [...new Set(o.pool.filter((x): x is string => typeof x === "string" && valid.has(x)))] : [];
  const rules = Array.isArray(o.rules)
    ? o.rules
        .map((r) => (r ?? {}) as Record<string, unknown>)
        .filter((r) => (r.field === "country" || r.field === "industry") && typeof r.value === "string" && r.value.trim() && typeof r.userId === "string" && valid.has(r.userId))
        .map((r) => ({ field: r.field as "country" | "industry", value: String(r.value).trim(), userId: String(r.userId) }))
        .slice(0, 50)
    : [];
  const sources = Array.isArray(o.sources) ? o.sources.filter((x): x is string => typeof x === "string").slice(0, 10) : DEFAULT_ASSIGNMENT.sources;
  return { mode: o.mode === "ROUND_ROBIN" ? "ROUND_ROBIN" : "OFF", pool, rules, sources };
}

/**
 * Picks the owner for one lead. Returns the user and the next rotation pointer (unchanged when a rule
 * matched), or null when assignment is off or nobody is available.
 */
export function pickAssignee(
  lead: { country: string | null; industry: string | null },
  s: AssignmentSettings,
  pointer: number,
): { userId: string; pointer: number; reason: string } | null {
  if (s.mode === "OFF") return null;
  for (const r of s.rules) {
    const v = r.field === "country" ? lead.country : lead.industry;
    if (v && v.toLowerCase() === r.value.toLowerCase()) return { userId: r.userId, pointer, reason: `${r.field === "country" ? "Country" : "Industry"} is ${r.value}` };
  }
  if (s.pool.length === 0) return null;
  const i = ((pointer % s.pool.length) + s.pool.length) % s.pool.length;
  return { userId: s.pool[i], pointer: i + 1, reason: "Round-robin" };
}

/** "3 min", "1 h 20 min" since a lead was assigned. */
export function waitingFor(since: Date, now = new Date()): string {
  const m = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ${m % 60} min` : `${Math.floor(h / 24)} d ${h % 24} h`;
}
