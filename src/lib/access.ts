import type { Prisma } from "@prisma/client";
import type { Role } from "./domain";

export type Viewer = {
  id: string;
  role: Role | string;
  teamId: string | null;
  /** Territory the owner assigned: ISO country codes and company names. */
  allowedCountries?: string[];
  allowedCompanies?: string[];
};
type LeadOwnerInfo = { ownerId: string | null; owner?: { teamId: string | null } | null; country?: string | null; company?: string | null };

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Who sees which leads:
 *  - OWNER sees everything.
 *  - TEAM_LEAD and REP see only leads the owner gave them as a territory (their assigned countries or
 *    companies) plus leads they own. With no territory assigned they see only their own leads.
 */
export function leadScope(viewer: Viewer): Prisma.LeadWhereInput {
  if (viewer.role === "OWNER") return {};
  const or: Prisma.LeadWhereInput[] = [{ ownerId: viewer.id }];
  const countries = viewer.allowedCountries ?? [];
  const companies = viewer.allowedCompanies ?? [];
  if (countries.length) or.push({ country: { in: countries } });
  for (const c of companies) or.push({ company: { equals: c.trim(), mode: "insensitive" } });
  return or.length === 1 ? or[0] : { OR: or };
}

export function canSeeLead(viewer: Viewer, lead: LeadOwnerInfo): boolean {
  if (viewer.role === "OWNER") return true;
  if (lead.ownerId === viewer.id) return true;
  if (lead.country && (viewer.allowedCountries ?? []).includes(lead.country)) return true;
  if (lead.company && (viewer.allowedCompanies ?? []).some((c) => sameName(c, lead.company!))) return true;
  return false;
}

/** Owners can assign to anyone; team leads only to people in their team (or themselves); reps can't reassign. */
export function canAssignTo(viewer: Viewer, assignee: { id: string; teamId: string | null } | null): boolean {
  if (viewer.role === "OWNER") return true;
  if (viewer.role !== "TEAM_LEAD") return false;
  if (assignee === null) return true;
  return assignee.id === viewer.id || (!!viewer.teamId && assignee.teamId === viewer.teamId);
}

/** Which users' performance this viewer may see on the team dashboard. */
export function teamScope(viewer: Viewer): Prisma.UserWhereInput {
  if (viewer.role === "OWNER") return {};
  if (viewer.role === "TEAM_LEAD" && viewer.teamId) return { teamId: viewer.teamId };
  return { id: viewer.id };
}

export function canManageGoals(viewer: Viewer, target: { id: string; teamId: string | null }): boolean {
  if (viewer.role === "OWNER") return true;
  return viewer.role === "TEAM_LEAD" && !!viewer.teamId && target.teamId === viewer.teamId;
}

/** Only owners manage people and teams. */
export function canManagePeople(viewer: Viewer): boolean {
  return viewer.role === "OWNER";
}

/**
 * Email from the CRM: everyone can draft and view emails on leads they can see; only owners and
 * team leads (admins/managers) can approve, send or delete them.
 */
export function canSendEmail(viewer: Viewer): boolean {
  return viewer.role === "OWNER" || viewer.role === "TEAM_LEAD";
}

/**
 * True if removing `targetId`, or changing their role to `newRole`, would leave no owner.
 * Pass newRole = null for removal.
 */
export function wouldLeaveNoOwner(
  users: { id: string; role: string }[],
  targetId: string,
  newRole: string | null,
): boolean {
  const target = users.find((u) => u.id === targetId);
  if (!target || target.role !== "OWNER" || newRole === "OWNER") return false;
  return users.filter((u) => u.role === "OWNER").length <= 1;
}
