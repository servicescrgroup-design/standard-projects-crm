import "server-only";
import { db } from "./db";
import { guessIndustry } from "../industryGuess";

/** Leads with no industry, and what we can fill in for them. */
export async function missingIndustryPlan() {
  const rows = await db.lead.findMany({ where: { segment: null }, select: { id: true, company: true, industry: true, notes: true, whyFit: true } });
  const bySegment = new Map<string, string[]>();
  for (const r of rows) {
    const s = guessIndustry(r);
    if (s) bySegment.set(s, [...(bySegment.get(s) ?? []), r.id]);
  }
  return { missing: rows.length, bySegment };
}

/** Fills in every industry we can guess. Leads that already have one are never changed. */
export async function fillMissingIndustries(): Promise<number> {
  const { bySegment } = await missingIndustryPlan();
  let updated = 0;
  for (const [segment, ids] of bySegment) {
    for (let i = 0; i < ids.length; i += 500) {
      const { count } = await db.lead.updateMany({ where: { id: { in: ids.slice(i, i + 500) }, segment: null }, data: { segment } });
      updated += count;
    }
  }
  return updated;
}
