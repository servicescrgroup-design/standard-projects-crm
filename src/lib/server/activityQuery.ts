import "server-only";
import { db } from "./db";
import { leadScope, type Viewer } from "../access";

/** Activities of the given types on leads this viewer can see, newest first, with optional search. */
export function scopedActivities(user: Viewer, types: string[], q?: string, take = 100) {
  const search = q?.trim();
  return db.activity.findMany({
    where: {
      type: { in: types },
      lead: leadScope(user),
      ...(search ? { OR: [{ summary: { contains: search, mode: "insensitive" } }, { subject: { contains: search, mode: "insensitive" } }, { lead: { company: { contains: search, mode: "insensitive" } } }] } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take,
    select: { id: true, type: true, outcome: true, summary: true, subject: true, webLink: true, source: true, occurredAt: true, lead: { select: { id: true, company: true } }, user: { select: { name: true } } },
  });
}
