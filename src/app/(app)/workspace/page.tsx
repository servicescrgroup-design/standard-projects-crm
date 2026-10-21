import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { teamScope } from "@/lib/access";
import { DAY_MS, GOAL_LABELS, OPEN_STAGES, SOURCE_LABELS, STAGE_LABELS, startOfMonth, startOfWeek, type GoalMetric, type Source, type Stage } from "@/lib/domain";
import { QUEUE_SELECT, buildQueue, isAwaitingOurReply } from "@/lib/queue";
import { computeRepStats, progressPct } from "@/lib/goals";
import { dueState, interestOf, taskFor } from "@/lib/workspace";
import { WorkspaceBoard, type WorkspaceData } from "@/components/workspace/WorkspaceBoard";

export const dynamic = "force-dynamic";

/** A sales agent's personal workspace: today's schedule, pipeline numbers, new leads, today's tasks and goals. */
export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const user = await requireUser();
  const { agent: agentParam } = await searchParams;

  // Owners and team leads can open any teammate's workspace; reps see their own.
  const people = user.role === "REP" ? [] : await db.user.findMany({ where: teamScope(user), orderBy: { name: "asc" }, select: { id: true, name: true, role: true } });
  const agent = (agentParam && people.find((p) => p.id === agentParam)) || { id: user.id, name: user.name, role: user.role };
  const isSelf = agent.id === user.id;

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const monthStart = startOfMonth(now);
  const lastMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const weekStart = startOfWeek(now);

  const [meetings, openDeals, newDealsWeek, wonMonth, wonLastMonth, lostMonth, lostLastMonth, ownNew, openLeads, goals, weekActs, monthActs, wonForGoals, todayActs] = await Promise.all([
    db.activity.findMany({
      where: { userId: agent.id, type: { in: ["MEETING", "VISIT"] }, occurredAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { occurredAt: "asc" },
      select: { id: true, occurredAt: true, summary: true, lead: { select: { id: true, company: true, contactName: true } } },
    }),
    db.lead.count({ where: { ownerId: agent.id, stage: { in: OPEN_STAGES } } }),
    db.lead.count({ where: { ownerId: agent.id, createdAt: { gte: weekAgo } } }),
    db.lead.count({ where: { ownerId: agent.id, stage: { in: ["WON", "MAINTENANCE"] }, stageChangedAt: { gte: monthStart } } }),
    db.lead.count({ where: { ownerId: agent.id, stage: { in: ["WON", "MAINTENANCE"] }, stageChangedAt: { gte: lastMonthStart, lt: monthStart } } }),
    db.lead.count({ where: { ownerId: agent.id, stage: "LOST", stageChangedAt: { gte: monthStart } } }),
    db.lead.count({ where: { ownerId: agent.id, stage: "LOST", stageChangedAt: { gte: lastMonthStart, lt: monthStart } } }),
    db.lead.findMany({
      where: { ownerId: agent.id, stage: "NEW" },
      orderBy: [{ createdAt: "desc" }],
      take: 24,
      select: { id: true, company: true, contactName: true, industry: true, segment: true, location: true, source: true, priority: true, email: true, phone: true, createdAt: true },
    }),
    db.lead.findMany({
      where: { ownerId: agent.id, stage: { in: OPEN_STAGES } },
      select: { ...QUEUE_SELECT, company: true, contactName: true, industry: true, phone: true, email: true },
    }),
    db.goal.findMany({ where: { userId: agent.id } }),
    db.activity.findMany({ where: { userId: agent.id, occurredAt: { gte: weekStart } }, select: { userId: true, type: true } }),
    db.activity.findMany({ where: { userId: agent.id, occurredAt: { gte: monthStart } }, select: { userId: true, type: true } }),
    db.lead.findMany({ where: { ownerId: agent.id, stage: { in: ["WON", "MAINTENANCE"] }, stageChangedAt: { gte: monthStart } }, select: { ownerId: true, value: true, monthlyValue: true, stageChangedAt: true } }),
    db.activity.findMany({ where: { userId: agent.id, occurredAt: { gte: dayStart, lt: dayEnd } }, select: { type: true } }),
  ]);

  // Managers with no new leads of their own see the unassigned pool, so the section is useful to them.
  const showPool = ownNew.length === 0 && agent.role !== "REP";
  const newLeads = showPool
    ? await db.lead.findMany({
        where: { ownerId: null, stage: "NEW" },
        orderBy: [{ priority: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        take: 24,
        select: { id: true, company: true, contactName: true, industry: true, segment: true, location: true, source: true, priority: true, email: true, phone: true, createdAt: true },
      })
    : ownNew;

  const queue = buildQueue(openLeads, now).filter((q) => !q.needsDecision).slice(0, 18);
  const weekStats = computeRepStats([agent.id], weekActs, wonForGoals.filter((l) => l.stageChangedAt >= weekStart)).get(agent.id)!;
  const monthStats = computeRepStats([agent.id], monthActs, wonForGoals).get(agent.id)!;

  const data: WorkspaceData = {
    agent: { id: agent.id, name: agent.name, isSelf },
    people: people.map((p) => ({ id: p.id, name: p.name })),
    today: now.toISOString(),
    meetings: meetings.map((m) => ({
      id: m.id,
      start: m.occurredAt.toISOString(),
      company: m.lead.company,
      contact: m.lead.contactName,
      leadId: m.lead.id,
      summary: m.summary,
    })),
    stats: {
      deals: openDeals,
      dealsDelta: newDealsWeek,
      won: wonMonth,
      wonDelta: wonMonth - wonLastMonth,
      lost: lostMonth,
      lostDelta: lostMonth - lostLastMonth,
    },
    newLeadsFromPool: showPool,
    leads: newLeads.map((l) => {
      const interest = interestOf(l.priority);
      return {
        id: l.id,
        name: l.contactName ?? l.company,
        subtitle: l.contactName ? `${l.industry ?? "Contact"} at ${l.company}` : [l.industry ?? l.segment, l.location].filter(Boolean).join(" · ") || "New lead",
        sources: [SOURCE_LABELS[l.source as Source] ?? l.source, l.segment].filter((s): s is string => !!s).slice(0, 2),
        interest: interest.level,
        dots: interest.dots,
        email: l.email,
        phone: l.phone,
      };
    }),
    tasks: queue.map((q) => {
      const awaiting = isAwaitingOurReply(q.lead);
      const task = taskFor(q.lead.stage, awaiting);
      return {
        id: q.lead.id,
        contact: q.lead.contactName ?? q.lead.company,
        company: q.lead.contactName ? q.lead.company : q.lead.industry ?? "",
        title: task.title,
        kind: task.kind,
        amount: q.lead.value + q.lead.monthlyValue * 12,
        due: q.lead.nextFollowUpAt?.toISOString() ?? null,
        dueState: awaiting ? "today" : dueState(q.lead.nextFollowUpAt, now),
        hot: q.lead.priority === "A",
        replied: awaiting,
        stage: q.lead.stage,
        stageLabel: STAGE_LABELS[q.lead.stage as Stage] ?? q.lead.stage,
        reasons: q.reasons,
        phone: q.lead.phone,
        email: q.lead.email,
      };
    }),
    goals: goals.map((g) => {
      const stats = g.period === "WEEK" ? weekStats : monthStats;
      const actual = stats[g.metric as GoalMetric] ?? 0;
      return { label: `${GOAL_LABELS[g.metric as GoalMetric] ?? g.metric} this ${g.period === "WEEK" ? "week" : "month"}`, actual, target: g.target, pct: progressPct(actual, g.target) };
    }),
    todayCounts: {
      calls: todayActs.filter((a) => a.type === "CALL").length,
      emails: todayActs.filter((a) => a.type === "EMAIL_OUT" || a.type === "PROPOSAL").length,
      meetings: todayActs.filter((a) => a.type === "MEETING" || a.type === "VISIT").length,
    },
    leadOptions: openLeads
      .slice()
      .sort((a, b) => a.company.localeCompare(b.company))
      .slice(0, 300)
      .map((l) => ({ id: l.id, label: l.contactName ? `${l.company} · ${l.contactName}` : l.company })),
    stages: OPEN_STAGES.map((s) => ({ id: s, label: STAGE_LABELS[s] })).concat([{ id: "WON", label: STAGE_LABELS.WON }, { id: "LOST", label: STAGE_LABELS.LOST }]),
  };

  return <WorkspaceBoard data={data} />;
}
