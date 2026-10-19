import type { Prisma } from "@prisma/client";
import type { Role } from "./domain";

export type Viewer = { id: string; role: Role | string; teamId: string | null };
type LeadOwnerInfo = { ownerId: string | null; owner?: { teamId: string | null } | null };

/**
 * Who sees which leads:
 *  - OWNER sees everything.
 *  - TEAM_LEAD sees leads owned by their team, plus unassigned leads (so they can hand them out).
 *  - REP sees only leads they own.
 */
export function leadScope(viewer: Viewer): Prisma.LeadWhereInput {
  if (viewer.role === "OWNER") return {};
  if (viewer.role === "TEAM_LEAD") {
    if (!viewer.teamId) return { OR: [{ ownerId: viewer.id }, { ownerId: null }] };
    return { OR: [{ owner: { teamId: viewer.teamId } }, { ownerId: null }] };
  }
  return { ownerId: viewer.id };
}

export function canSeeLead(viewer: Viewer, lead: LeadOwnerInfo): boolean {
  if (viewer.role === "OWNER") return true;
  if (lead.ownerId === viewer.id) return true;
  if (viewer.role === "TEAM_LEAD") {
    if (lead.ownerId === null) return true;
    return !!viewer.teamId && lead.owner?.teamId === viewer.teamId;
  }
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
