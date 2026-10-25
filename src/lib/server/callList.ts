import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { leadScope, type Viewer } from "../access";
import { countryOfLead } from "../countries";
import { localTimeLabel, timeZoneFor } from "../timezones";
import { openForCalls, sortQueue } from "../callList";

export type CallMode = "mine" | "unassigned";

/** Leads to phone: open early-stage deals with a phone number whose follow-up is due (or never set). */
export async function callQueue(user: Viewer, mode: CallMode) {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const who: Prisma.LeadWhereInput = mode === "unassigned" && user.role !== "REP" ? { ownerId: null } : { ownerId: user.id };
  const rows = await db.lead.findMany({
    where: {
      AND: [
        leadScope(user),
        who,
        { phone: { not: null } },
        { NOT: { phone: "" } },
        { stage: { in: ["NEW", "CONTACTED"] } },
        { OR: [{ nextFollowUpAt: null }, { nextFollowUpAt: { lte: endOfToday } }] },
      ],
    },
    select: {
      id: true, company: true, contactName: true, phone: true, email: true, location: true, industry: true, segment: true, priority: true,
      whyFit: true, notes: true, stage: true, lastContactAt: true, nextFollowUpAt: true, website: true,
      activities: { orderBy: { occurredAt: "desc" }, take: 1, select: { type: true, outcome: true, summary: true, occurredAt: true } },
    },
    take: 600,
  });
  const leads = rows.map((l) => {
    const country = countryOfLead(l);
    const zone = timeZoneFor(country?.name ?? null, l.location);
    return { ...l, country, zone, openNow: openForCalls(zone, now), localTime: localTimeLabel(zone, now) };
  });
  return sortQueue(leads, now).slice(0, 150);
}

export async function callCounts(user: Viewer) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  return db.activity.count({ where: { userId: user.id, type: "CALL", occurredAt: { gte: dayStart } } });
}
