import "server-only";
import { db } from "./db";

export type NotifyInput = { type: string; title: string; body?: string | null; href?: string | null };

/** Adds an alert to someone's bell. Never throws: an alert failing must not break the action behind it. */
export async function notify(userIds: string | (string | null | undefined)[], n: NotifyInput) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter((x): x is string => !!x))];
  if (!ids.length) return;
  try {
    await db.notification.createMany({ data: ids.map((userId) => ({ userId, type: n.type, title: n.title.slice(0, 200), body: n.body?.slice(0, 500) ?? null, href: n.href ?? null })) });
  } catch {
    /* ignore */
  }
}

/** Owners and team leads (for approvals and quote updates on unassigned leads). */
export async function managersFor(teamId: string | null) {
  const rows = await db.user.findMany({
    where: { OR: [{ role: "OWNER" }, ...(teamId ? [{ role: "TEAM_LEAD", teamId }] : [])] },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
