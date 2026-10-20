import "server-only";
import { db } from "./db";
import { leadScope, type Viewer } from "../access";
import { ACTIVITY_LABELS, OUTCOME_LABELS, PRIORITY_LABELS, SOURCE_LABELS, STAGE_LABELS, type ActivityType, type Outcome, type Priority, type Source, type Stage } from "../domain";
import { domainOf, runReport, sanitizeConfig, type ReportRow } from "../reports";

const month = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : null);

/** Rows for the report engine, limited to what this viewer can see, in display units (baht, labels). */
async function rowsFor(user: Viewer, source: "leads" | "activities"): Promise<ReportRow[]> {
  if (source === "activities") {
    const acts = await db.activity.findMany({
      where: { lead: leadScope(user) },
      select: { type: true, outcome: true, source: true, occurredAt: true, user: { select: { name: true } }, lead: { select: { company: true } } },
      take: 50000,
    });
    return acts.map((a) => ({
      type: ACTIVITY_LABELS[a.type as ActivityType] ?? a.type,
      outcome: a.outcome ? (OUTCOME_LABELS[a.outcome as Outcome] ?? a.outcome) : null,
      by: a.user?.name ?? "Automatic",
      month: month(a.occurredAt),
      company: a.lead.company,
      channel: a.source === "MANUAL" ? "Logged by hand" : a.source,
    }));
  }
  const leads = await db.lead.findMany({
    where: leadScope(user),
    select: {
      website: true, stage: true, segment: true, priority: true, source: true, industry: true, location: true, serviceInterest: true,
      createdAt: true, stageChangedAt: true, value: true, monthlyValue: true, googleReviews: true, googleRating: true, owner: { select: { name: true } },
    },
    take: 50000,
  });
  return leads.map((l) => ({
    domain: domainOf(l.website),
    stage: STAGE_LABELS[l.stage as Stage] ?? l.stage,
    segment: l.segment,
    priority: l.priority ? PRIORITY_LABELS[l.priority as Priority] ?? l.priority : null,
    source: SOURCE_LABELS[l.source as Source] ?? l.source,
    industry: l.industry,
    location: l.location,
    owner: l.owner?.name ?? "Unassigned",
    serviceInterest: l.serviceInterest,
    createdMonth: month(l.createdAt),
    wonMonth: l.stage === "WON" || l.stage === "MAINTENANCE" ? month(l.stageChangedAt) : null,
    firstYear: (l.value + l.monthlyValue * 12) / 100,
    value: l.value / 100,
    monthly: l.monthlyValue / 100,
    googleReviews: l.googleReviews,
    googleRating: l.googleRating,
  }));
}

export async function runReportFor(user: Viewer, rawConfig: unknown) {
  const config = sanitizeConfig(rawConfig);
  const rows = await rowsFor(user, config.source);
  return { config, result: runReport(rows, config) };
}
