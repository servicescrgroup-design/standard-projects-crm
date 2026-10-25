import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { callCounts, callQueue, type CallMode } from "@/lib/server/callList";
import { toE164 } from "@/lib/phone";
import { CallList, type CallLead } from "@/components/calls/CallList";

export const dynamic = "force-dynamic";

/** Call list: one lead at a time, call, click what happened, next. */
export default async function CallsPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const user = await requireUser();
  const { mode: raw } = await searchParams;
  const canSeeUnassigned = user.role !== "REP";
  const mode: CallMode = raw === "unassigned" && canSeeUnassigned ? "unassigned" : "mine";
  const [queue, otherQueue, callsToday, twilio] = await Promise.all([
    callQueue(user, mode),
    canSeeUnassigned ? callQueue(user, mode === "mine" ? "unassigned" : "mine") : Promise.resolve([]),
    callCounts(user),
    db.twilioConnection.count({ where: { userId: user.id } }),
  ]);

  const leads: CallLead[] = queue.map((l) => ({
    id: l.id,
    company: l.company,
    contactName: l.contactName,
    phone: l.phone!,
    e164: toE164(l.phone, l.country?.code ?? "TH"),
    country: l.country ? `${l.country.flag} ${l.country.name}` : null,
    industry: l.segment ?? l.industry,
    priority: l.priority,
    whyFit: l.whyFit,
    notes: l.notes,
    website: l.website,
    stage: l.stage,
    openNow: l.openNow,
    localTime: l.localTime,
    due: !!l.nextFollowUpAt,
    last: l.activities[0] ? { type: l.activities[0].type, outcome: l.activities[0].outcome, summary: l.activities[0].summary, at: l.activities[0].occurredAt.toISOString() } : null,
  }));
  const counts = { mine: mode === "mine" ? queue.length : otherQueue.length, unassigned: mode === "unassigned" ? queue.length : otherQueue.length };

  return <CallList leads={leads} mode={mode} counts={counts} canSeeUnassigned={canSeeUnassigned} callsToday={callsToday} hasTwilio={twilio > 0} />;
}
