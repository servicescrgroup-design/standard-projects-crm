import "server-only";
import type { Prisma } from "@prisma/client";
import { leadScope, type Viewer } from "../access";
import { SEGMENTS, isPriority, isSource, isStage } from "../domain";

export type LeadFilterParams = { q?: string; stage?: string; status?: string; owner?: string; priority?: string; segment?: string; source?: string };

/** The lead filters shared by the Leads, Companies and Deals pages and their exports. Always includes the viewer's scope. */
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
  if (p.segment && (SEGMENTS as readonly string[]).includes(p.segment)) filters.push({ segment: p.segment });
  if (isSource(p.source)) filters.push({ source: p.source });
  if (user.role !== "REP" && p.owner) filters.push({ ownerId: p.owner === "none" ? null : p.owner });
  return { AND: filters };
}
