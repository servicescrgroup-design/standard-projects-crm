import "server-only";
import type { Prisma } from "@prisma/client";
import { leadScope, type Viewer } from "../access";
import { isPriority, isSource, isStage } from "../domain";
import { cache } from "react";
import { countryOfLead } from "../countries";
import { db } from "./db";

export type LeadFilterParams = {
  q?: string; stage?: string; status?: string; owner?: string; priority?: string; source?: string;
  /** Industry (lead segment); several allowed, comma-separated. "none" = no industry set. */
  segment?: string;
  /** Country names (e.g. "United States,Germany"); several allowed. */
  country?: string;
};

/** "a,b" → ["a","b"]; also accepts repeated params passed as arrays. */
export function listParam(v: string | string[] | undefined): string[] {
  const all = Array.isArray(v) ? v : v ? [v] : [];
  return all.flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean).slice(0, 50);
}

/** The lead filters shared by the Leads, Companies and Deals pages and their exports. Always includes the viewer's scope. Country is handled by leadWhereWithCountry. */
export function leadWhere(user: Viewer, p: LeadFilterParams): Prisma.LeadWhereInput {
  const filters: Prisma.LeadWhereInput[] = [leadScope(user)];
  const q = p.q?.trim();
  if (q)
    filters.push({
      OR: [
        { company: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { location: { contains: q, mode: "insensitive" } },
      ],
    });
  if (isStage(p.stage)) filters.push({ stage: p.stage });
  // Dashboard status groups: "progress" = contacted → negotiation, "won" = won + maintenance.
  if (p.status === "progress") filters.push({ stage: { in: ["CONTACTED", "MEETING_BOOKED", "PROPOSAL_SENT", "NEGOTIATION"] } });
  if (p.status === "won") filters.push({ stage: { in: ["WON", "MAINTENANCE"] } });
  if (isPriority(p.priority)) filters.push({ priority: p.priority });
  const segments = listParam(p.segment);
  if (segments.length) {
    const named = segments.filter((x) => x !== "none");
    filters.push({ OR: [...(named.length ? [{ segment: { in: named } }] : []), ...(segments.includes("none") ? [{ segment: null }] : [])] });
  }
  if (isSource(p.source)) filters.push({ source: p.source });
  if (user.role !== "REP" && p.owner) filters.push({ ownerId: p.owner === "none" ? null : p.owner });
  return { AND: filters };
}

// Every visible lead's id + detected country, read once per request. Country isn't a column: it's worked out
// from location, industry notes, phone and Thai place names (countryOfLead), so the filter and the flags agree.
const countryIndex = cache(async (userId: string, role: string, teamId: string | null) => {
  const rows = await db.lead.findMany({
    where: leadScope({ id: userId, role, teamId }),
    select: { id: true, location: true, industry: true, phone: true, company: true },
  });
  return rows.map((r) => ({ id: r.id, country: countryOfLead(r) }));
});

/** leadWhere plus the multi-country filter (?country=United States,Germany). */
export async function leadWhereWithCountry(user: Viewer, p: LeadFilterParams): Promise<Prisma.LeadWhereInput> {
  const base = leadWhere(user, p);
  const countries = listParam(p.country);
  if (!countries.length) return base;
  const index = await countryIndex(user.id, String(user.role), user.teamId);
  const ids = index.filter((r) => r.country && countries.includes(r.country.name)).map((r) => r.id);
  return { AND: [base, { id: { in: ids } }] };
}

export type Facets = { countries: { name: string; flag: string; count: number }[]; industries: { name: string; count: number }[] };

/** Country and industry options (with counts) for the filter menus, over the leads this viewer can see. */
export async function leadFacets(user: Viewer): Promise<Facets> {
  const [index, segs] = await Promise.all([
    countryIndex(user.id, String(user.role), user.teamId),
    db.lead.groupBy({ by: ["segment"], where: leadScope(user), _count: { _all: true } }),
  ]);
  const countries = new Map<string, { name: string; flag: string; count: number }>();
  for (const r of index) {
    if (!r.country) continue;
    const cur = countries.get(r.country.name) ?? { name: r.country.name, flag: r.country.flag, count: 0 };
    cur.count++;
    countries.set(r.country.name, cur);
  }
  return {
    countries: [...countries.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    industries: segs
      .map((s) => ({ name: s.segment ?? "none", count: s._count._all }))
      .sort((a, b) => (a.name === "none" ? 1 : b.name === "none" ? -1 : b.count - a.count)),
  };
}
