import "server-only";
import type { Prisma } from "@prisma/client";
import { DAY_MS, isStage } from "../domain";
import type { Viewer } from "../access";
import { leadWhere, leadWhereWithCountry } from "./leadFilters";

/** Filters on the Contacts page (URL params). Shared by the page and "Select all matching". */
export type ContactFilterParams = { q?: string; cat?: string | string[]; country?: string | string[]; range?: string; stage?: string; email?: string };

export const NO_CATEGORY = "Uncategorised";
export const CONTACT_RANGES: Record<string, { label: string; days: number | null }> = {
  all: { label: "All time", days: null },
  "30": { label: "Last 30 days", days: 30 },
  "7": { label: "Last 7 days", days: 7 },
};
export const HAS_CONTACT: Prisma.LeadWhereInput = { OR: [{ contactName: { not: null } }, { email: { not: null } }, { phone: { not: null } }] };
export const listOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

export async function contactsWhere(user: Viewer, p: ContactFilterParams, now = Date.now()): Promise<Prisma.LeadWhereInput> {
  const cats = listOf(p.cat);
  const countries = listOf(p.country);
  const range = CONTACT_RANGES[p.range ?? ""] ? (p.range as string) : "all";
  const stage = isStage(p.stage) ? p.stage : undefined;
  const filters: Prisma.LeadWhereInput[] = [leadWhere(user, { q: p.q, stage }), HAS_CONTACT];
  if (cats.length) {
    const named = cats.filter((c) => c !== NO_CATEGORY);
    filters.push({ OR: [...(named.length ? [{ segment: { in: named } }] : []), ...(cats.includes(NO_CATEGORY) ? [{ segment: null }] : [])] });
  }
  if (countries.length) filters.push(await leadWhereWithCountry(user, { country: countries.join(",") }));
  if (CONTACT_RANGES[range].days) filters.push({ createdAt: { gte: new Date(now - CONTACT_RANGES[range].days! * DAY_MS) } });
  if (p.email === "1") filters.push({ email: { not: null } });
  return { AND: filters };
}
