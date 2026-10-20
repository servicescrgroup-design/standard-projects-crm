import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { leadScope } from "@/lib/access";
import { DAY_MS, SOURCE_LABELS, WON_STAGES, type Source } from "@/lib/domain";
import { pctChange, sanitizeLayout, type WidgetId } from "@/lib/analytics";
import { KPICard } from "@/components/dashboard/KPICard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { CalendarWidget } from "@/components/dashboard/CalendarWidget";
import { LeadsWidget, type Segment } from "@/components/dashboard/LeadsWidget";
import { RetentionWidget } from "@/components/dashboard/RetentionWidget";
import { LocationsWidget } from "@/components/dashboard/LocationsWidget";
import { CustomizeWidgets } from "@/components/dashboard/CustomizeWidgets";

export const dynamic = "force-dynamic";

const STATUS_COLORS = { open: "#98a2b3", progress: "#34b0ee", lost: "#f97066", won: "#12b76a" };
const PALETTE = ["#147cab", "#34b0ee", "#06486b", "#f79009", "#12b76a", "#98a2b3", "#7a5af8", "#f97066"];

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const scope = leadScope(user);
  const within = (from: Date, to: Date): Prisma.DateTimeFilter => ({ gte: from, lt: to });
  const ago = (d: number) => new Date(now.getTime() - d * DAY_MS);
  const and = (extra: Prisma.LeadWhereInput): Prisma.LeadWhereInput => ({ AND: [scope, extra] });

  const [
    newThisWeek, newLastWeek,
    won30, lost30, wonPrev30, lostPrev30,
    wonForTiming, wonAll, meetings, stageGroups, sourceGroups, priorityGroups, locationGroups,
  ] = await Promise.all([
    db.lead.count({ where: and({ createdAt: within(ago(7), now) }) }),
    db.lead.count({ where: and({ createdAt: within(ago(14), ago(7)) }) }),
    db.lead.count({ where: and({ stage: { in: WON_STAGES }, stageChangedAt: within(ago(30), now) }) }),
    db.lead.count({ where: and({ stage: "LOST", stageChangedAt: within(ago(30), now) }) }),
    db.lead.count({ where: and({ stage: { in: WON_STAGES }, stageChangedAt: within(ago(60), ago(30)) }) }),
    db.lead.count({ where: and({ stage: "LOST", stageChangedAt: within(ago(60), ago(30)) }) }),
    db.lead.findMany({ where: and({ stage: { in: WON_STAGES }, stageChangedAt: { gte: ago(180) } }), select: { createdAt: true, stageChangedAt: true } }),
    db.lead.findMany({ where: and({ stage: { in: WON_STAGES } }), select: { stageChangedAt: true, value: true, monthlyValue: true } }),
    db.activity.findMany({
      where: { type: "MEETING", lead: scope, occurredAt: { gte: ago(90), lte: new Date(now.getTime() + 90 * DAY_MS) } },
      select: { id: true, leadId: true, occurredAt: true, summary: true, user: { select: { name: true } }, lead: { select: { company: true, contactName: true } } },
      orderBy: { occurredAt: "asc" },
      take: 500,
    }),
    db.lead.groupBy({ by: ["stage"], where: scope, _count: true }),
    db.lead.groupBy({ by: ["source"], where: scope, _count: true }),
    db.lead.groupBy({ by: ["priority"], where: scope, _count: true }),
    db.lead.groupBy({ by: ["location"], where: scope, _count: true }),
  ]);

  // KPI: conversion = won / (won + lost) among deals closed in the window.
  const conv = won30 + lost30 ? Math.round((won30 / (won30 + lost30)) * 100) : null;
  const convPrev = wonPrev30 + lostPrev30 ? Math.round((wonPrev30 / (wonPrev30 + lostPrev30)) * 100) : null;
  // KPI: average days from lead created to won, last 90 days vs the 90 before.
  const avgDays = (rows: typeof wonForTiming) =>
    rows.length ? Math.round(rows.reduce((s, r) => s + (r.stageChangedAt.getTime() - r.createdAt.getTime()) / DAY_MS, 0) / rows.length) : null;
  const t90 = avgDays(wonForTiming.filter((r) => r.stageChangedAt >= ago(90)));
  const tPrev = avgDays(wonForTiming.filter((r) => r.stageChangedAt < ago(90)));

  const count = (stages: string[]) => stageGroups.filter((g) => stages.includes(g.stage)).reduce((s, g) => s + g._count, 0);
  const leadsData: Record<"status" | "sources" | "qualification", Segment[]> = {
    status: [
      { key: "open", label: "Open", count: count(["NEW"]), color: STATUS_COLORS.open, href: "/deals?stage=NEW" },
      { key: "progress", label: "In Progress", count: count(["CONTACTED", "MEETING_BOOKED", "PROPOSAL_SENT", "NEGOTIATION"]), color: STATUS_COLORS.progress, href: "/deals?status=progress" },
      { key: "lost", label: "Lost", count: count(["LOST"]), color: STATUS_COLORS.lost, href: "/deals?stage=LOST" },
      { key: "won", label: "Won", count: count(["WON", "MAINTENANCE"]), color: STATUS_COLORS.won, href: "/deals?status=won" },
    ],
    sources: sourceGroups
      .sort((a, b) => b._count - a._count)
      .map((g, i) => ({ key: g.source, label: SOURCE_LABELS[g.source as Source] ?? g.source, count: g._count, color: PALETTE[i % PALETTE.length], href: `/companies?source=${g.source}` })),
    qualification: (["A", "B", "C", null] as const).map((p, i) => ({
      key: p ?? "none",
      label: p ? `Priority ${p}` : "Not rated",
      count: priorityGroups.find((g) => g.priority === p)?._count ?? 0,
      color: ["#06486b", "#147cab", "#34b0ee", "#d0d5dd"][i],
      href: p ? `/companies?priority=${p}` : "/companies",
    })),
  };

  // Care-plan retention and new customers per month (last 7 months).
  const carePlan = wonAll.filter((w) => w.monthlyValue > 0).length;
  const months = Array.from({ length: 7 }, (_, i) => {
    const s = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1);
    const e = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const inMonth = wonAll.filter((w) => w.stageChangedAt >= s && w.stageChangedAt < e);
    return { label: s.toLocaleDateString("en-GB", { month: "short" }), carePlan: inMonth.filter((w) => w.monthlyValue > 0).length, oneOff: inMonth.filter((w) => w.monthlyValue === 0).length };
  });

  const located = locationGroups.filter((g) => g.location);
  const locatedTotal = located.reduce((s, g) => s + g._count, 0);
  const locations = located
    .sort((a, b) => b._count - a._count)
    .slice(0, 5)
    .map((g) => ({ area: g.location!, count: g._count, pct: Math.round((g._count / locatedTotal) * 100) }));

  const layout = sanitizeLayout((user.preferences as Record<string, unknown> | null)?.dashboard);
  const visible = layout.order.filter((w) => !layout.hidden.includes(w));

  const widgets: Record<WidgetId, React.ReactNode> = {
    kpis: (
      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard label="Leads" value={newThisWeek.toLocaleString("en-GB")} comparison={`${newThisWeek - newLastWeek >= 0 ? "+" : ""}${newThisWeek - newLastWeek} vs last week`} pct={pctChange(newThisWeek, newLastWeek)} help="New leads added in the last 7 days, compared with the 7 days before." />
        <KPICard label="Conversion Rate" value={conv === null ? "—" : `${conv}%`} comparison={conv === null || convPrev === null ? "No closed deals to compare" : `${conv - convPrev >= 0 ? "+" : ""}${conv - convPrev} pts vs last month`} pct={conv === null || convPrev === null ? null : conv - convPrev} help="Won ÷ (won + lost) for deals closed in the last 30 days, compared with the 30 days before." />
        <KPICard label="Time to Win" value={t90 === null ? "—" : `${t90}d`} comparison={t90 === null || tPrev === null ? "Not enough won deals yet" : `${t90 - tPrev >= 0 ? "+" : ""}${t90 - tPrev}d vs previous 90 days`} pct={t90 === null || tPrev === null ? null : pctChange(t90, tPrev)} invert help="Average days from a lead being added to being won, for deals won in the last 90 days." />
      </div>
    ),
    revenue: (
      <RevenueChart
        nowIso={now.toISOString()}
        points={wonAll.filter((w) => w.value + w.monthlyValue > 0).map((w) => ({ at: w.stageChangedAt.toISOString(), amount: w.value + w.monthlyValue * 12 }))}
      />
    ),
    calendar: (
      <CalendarWidget
        todayIso={now.toISOString()}
        meetings={meetings.map((m) => ({ id: m.id, leadId: m.leadId, company: m.lead.company, start: m.occurredAt.toISOString(), summary: m.summary, by: m.user?.name ?? null, contact: m.lead.contactName }))}
      />
    ),
    leads: <LeadsWidget data={leadsData} />,
    retention: <RetentionWidget pct={wonAll.length ? Math.round((carePlan / wonAll.length) * 100) : null} carePlanCount={carePlan} wonCount={wonAll.length} months={months} />,
    locations: <LocationsWidget rows={locations} missing={locationGroups.find((g) => !g.location)?._count ?? 0} />,
  };
  const span: Record<WidgetId, string> = {
    kpis: "lg:col-span-8",
    revenue: "lg:col-span-8",
    calendar: "lg:col-span-4 lg:row-span-2",
    leads: "lg:col-span-4",
    retention: "lg:col-span-4",
    locations: "lg:col-span-4",
  };

  const hour = now.getHours();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          {hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, {user.name.split(" ")[0]}. Here&apos;s how sales are going.
        </p>
        <CustomizeWidgets layout={layout} />
      </div>
      {visible.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-2">All widgets are hidden. Use Customize Widget to show some.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-flow-dense lg:grid-cols-12">
          {visible.map((w) => (
            <div key={w} className={span[w]}>
              {widgets[w]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
