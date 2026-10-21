import "server-only";
import { db } from "./db";
import { notify } from "./notifications";
import { DEFAULT_ASSIGNMENT, pickAssignee, sanitizeAssignment, type AssignmentSettings } from "../assignment";
import { countryOfLead } from "../countries";
import { SOURCE_LABELS, type Source } from "../domain";

const KEY = "assignment";
const POINTER = "assignment.pointer";

export type StoredAssignment = AssignmentSettings & { since: string | null };

export async function getAssignment(): Promise<StoredAssignment> {
  const [row, users] = await Promise.all([db.appSetting.findUnique({ where: { key: KEY } }), db.user.findMany({ select: { id: true } })]);
  const v = (row?.value ?? {}) as Record<string, unknown>;
  return { ...sanitizeAssignment(row ? v : DEFAULT_ASSIGNMENT, users.map((u) => u.id)), since: typeof v.since === "string" ? v.since : null };
}

/** Saves the rules. Turning assignment on stamps "since", so only enquiries from then on are handed out. */
export async function saveAssignment(next: AssignmentSettings) {
  const current = await getAssignment();
  const since = next.mode === "ROUND_ROBIN" ? (current.mode === "ROUND_ROBIN" && current.since ? current.since : new Date().toISOString()) : null;
  const value = { ...next, since };
  await db.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

/**
 * Hands out new, unassigned enquiries (website form, quote form …) by the rules, notifying each new owner.
 * Safe to call often: it only touches unassigned leads created since assignment was switched on.
 */
export async function assignInboundLeads(limit = 50): Promise<number> {
  const s = await getAssignment();
  if (s.mode === "OFF" || !s.since) return 0;
  const leads = await db.lead.findMany({
    where: { ownerId: null, stage: "NEW", source: { in: s.sources }, createdAt: { gte: new Date(s.since) } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, company: true, location: true, industry: true, phone: true, segment: true, source: true },
  });
  if (!leads.length) return 0;

  const pointerRow = await db.appSetting.findUnique({ where: { key: POINTER } });
  let pointer = typeof pointerRow?.value === "number" ? pointerRow.value : 0;
  let assigned = 0;
  for (const l of leads) {
    const pick = pickAssignee({ country: countryOfLead(l)?.name ?? null, industry: l.segment }, s, pointer);
    if (!pick) break;
    // Only claim it if it's still unassigned (another request may have got there first).
    const { count } = await db.lead.updateMany({ where: { id: l.id, ownerId: null }, data: { ownerId: pick.userId, assignedAt: new Date() } });
    if (count === 0) continue;
    pointer = pick.pointer;
    assigned++;
    await notify(pick.userId, {
      type: "LEAD_ASSIGNED",
      title: `New enquiry: ${l.company}`,
      body: `${SOURCE_LABELS[l.source as Source] ?? l.source} · assigned to you (${pick.reason}). Reply fast: the first to respond usually wins.`,
      href: `/leads/${l.id}`,
    });
  }
  await db.appSetting.upsert({ where: { key: POINTER }, create: { key: POINTER, value: pointer }, update: { value: pointer } });
  return assigned;
}
