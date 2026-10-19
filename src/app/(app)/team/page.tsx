import Link from "next/link";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { canManageGoals, leadScope, teamScope } from "@/lib/access";
import { computeRepStats, leaderboardScore, progressPct, type RepStats } from "@/lib/goals";
import {
  DAY_MS,
  GOAL_LABELS,
  OPEN_STAGES,
  STAGES,
  STAGE_LABELS,
  STALLED_AFTER_DAYS,
  formatMoney,
  startOfMonth,
  startOfWeek,
  type GoalMetric,
  type Stage,
} from "@/lib/domain";
import { setGoal } from "../../actions";

export const dynamic = "force-dynamic";

// The goals every rep gets a row for, so managers can set them without hunting for options.
const STANDARD_GOALS: { metric: GoalMetric; period: "WEEK" | "MONTH" }[] = [
  { metric: "CALLS", period: "WEEK" },
  { metric: "EMAILS", period: "WEEK" },
  { metric: "MEETINGS", period: "WEEK" },
  { metric: "REVENUE_WON", period: "MONTH" },
];

function Bar({ pct }: { pct: number }) {
  const colour = pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : pct >= 30 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div className={`h-1.5 rounded-full ${colour}`} style={{ width: `${Math.max(pct, 2)}%` }} />
    </div>
  );
}

export default async function TeamPage() {
  const user = await requireUser();
  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const stalledBefore = new Date(now.getTime() - STALLED_AFTER_DAYS * DAY_MS);
  const periodStart = weekStart < monthStart ? weekStart : monthStart;

  const people = await db.user.findMany({ where: teamScope(user), include: { goals: true }, orderBy: { name: "asc" } });
  const ids = people.map((p) => p.id);

  const [activities, wonLeads, openLeads, scopedLeads] = await Promise.all([
    db.activity.findMany({
      where: { userId: { in: ids }, occurredAt: { gte: periodStart, lte: now } },
      select: { userId: true, type: true, occurredAt: true },
    }),
    db.lead.findMany({
      where: { ownerId: { in: ids }, stage: "WON", stageChangedAt: { gte: periodStart } },
      select: { ownerId: true, value: true, monthlyValue: true, stageChangedAt: true },
    }),
    db.lead.findMany({
      where: { ownerId: { in: ids }, stage: { in: OPEN_STAGES } },
      select: { ownerId: true, value: true, monthlyValue: true, nextFollowUpAt: true },
    }),
    db.lead.findMany({ where: leadScope(user), include: { owner: true } }),
  ]);

  const weekStats = computeRepStats(
    ids,
    activities.filter((a) => a.occurredAt >= weekStart),
    wonLeads.filter((l) => l.stageChangedAt >= weekStart),
  );
  const monthStats = computeRepStats(
    ids,
    activities.filter((a) => a.occurredAt >= monthStart),
    wonLeads.filter((l) => l.stageChangedAt >= monthStart),
  );

  // Owners only appear as a rep if they actually carry leads or goals.
  const sellers = people.filter(
    (p) => p.role !== "OWNER" || p.goals.length > 0 || openLeads.some((l) => l.ownerId === p.id),
  );
  const rows = sellers.map((p) => {
    const week = weekStats.get(p.id) as RepStats;
    const month = monthStats.get(p.id) as RepStats;
    const goals = p.goals.map((g) => {
      const actual = (g.period === "MONTH" ? month : week)[g.metric as GoalMetric];
      return { ...g, actual, pct: progressPct(actual, g.target) };
    });
    const mine = openLeads.filter((l) => l.ownerId === p.id);
    return {
      person: p,
      week,
      month,
      goals,
      score: goals.length
        ? Math.round(goals.reduce((s, g) => s + g.pct, 0) / goals.length)
        : leaderboardScore(week, []),
      hasGoals: goals.length > 0,
      open: mine.length,
      overdue: mine.filter((l) => l.nextFollowUpAt && l.nextFollowUpAt < todayStart).length,
      pipeline: mine.reduce((s, l) => s + l.value + l.monthlyValue * 12, 0),
    };
  });
  const leaderboard = [...rows].sort((a, b) => b.score - a.score);

  const open = scopedLeads.filter((l) => OPEN_STAGES.includes(l.stage as Stage));
  const stalled = open
    .filter((l) => (l.lastContactAt ?? l.createdAt) < stalledBefore)
    .sort((a, b) => (a.lastContactAt ?? a.createdAt).getTime() - (b.lastContactAt ?? b.createdAt).getTime());
  const unassigned = open.filter((l) => !l.ownerId).length;
  const byStage = STAGES.map((s) => {
    const inStage = scopedLeads.filter((l) => l.stage === s);
    return { stage: s, count: inStage.length, value: inStage.reduce((t, l) => t + l.value + l.monthlyValue * 12, 0) };
  });
  const maxCount = Math.max(1, ...byStage.map((s) => s.count));
  const totals = rows.reduce(
    (t, r) => ({
      calls: t.calls + r.week.CALLS,
      emails: t.emails + r.week.EMAILS,
      meetings: t.meetings + r.week.MEETINGS,
      won: t.won + r.month.REVENUE_WON,
    }),
    { calls: 0, emails: 0, meetings: 0, won: 0 },
  );
  const isRep = user.role === "REP";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{isRep ? "My performance" : "Team"}</h1>
        <p className="text-sm text-slate-500">
          This week from {weekStart.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}.
          Emails and meetings are counted automatically from Gmail and Calendar once connected.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Calls this week", totals.calls],
          ["Emails this week", totals.emails],
          ["Meetings this week", totals.meetings],
          ["Won this month", `฿${totals.won.toLocaleString("en-GB")}`],
          ...(isRep ? [] : [["Unassigned leads", unassigned] as [string, number]]),
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <div className="text-xs text-slate-500">{k}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      {!isRep && rows.length === 0 && (
        <section className="card p-6 text-center">
          <p className="font-medium">No salespeople yet</p>
          <p className="mt-1 text-sm text-slate-500">
            {user.role === "OWNER" ? (
              <>
                Create a team and add your reps in <Link href="/settings" className="text-blue-700 hover:underline">Settings</Link>.
              </>
            ) : (
              "Ask the owner to add people to your team."
            )}
          </p>
        </section>
      )}

      {!isRep && rows.length > 0 && (
        <section className="card">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">Leaderboard</h2>
          <ol className="divide-y divide-slate-100">
            {leaderboard.map((r, i) => (
              <li key={r.person.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`w-6 text-center font-bold ${i === 0 ? "text-amber-500" : "text-slate-400"}`}>{i + 1}</span>
                <span className="flex-1 font-medium">{r.person.name}</span>
                <span className="hidden text-sm text-slate-500 sm:inline">
                  {r.week.CALLS} calls · {r.week.EMAILS} emails · {r.week.MEETINGS} meetings
                </span>
                <span className="w-32 whitespace-nowrap text-right font-semibold tabular-nums">
                  {r.hasGoals ? `${r.score}% of goals` : `${r.score} pts`}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => {
          const editable = canManageGoals(user, r.person);
          return (
            <div key={r.person.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{r.person.name}</div>
                <div className="flex gap-2 text-xs">
                  <span className="chip">{r.open} open</span>
                  {r.overdue > 0 && <span className="chip bg-amber-50 text-amber-700">{r.overdue} overdue</span>}
                  <span className="chip">{formatMoney(r.pipeline)} pipeline</span>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {STANDARD_GOALS.map(({ metric, period }) => {
                  const g = r.goals.find((x) => x.metric === metric && x.period === period);
                  const actual = (period === "MONTH" ? r.month : r.week)[metric];
                  return (
                    <div key={metric + period}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-slate-600">
                          {GOAL_LABELS[metric]} <span className="text-slate-400">/ {period === "WEEK" ? "week" : "month"}</span>
                        </span>
                        {editable ? (
                          <form action={setGoal} className="flex items-center gap-1">
                            <input type="hidden" name="userId" value={r.person.id} />
                            <input type="hidden" name="metric" value={metric} />
                            <input type="hidden" name="period" value={period} />
                            <span className="tabular-nums">{actual.toLocaleString("en-GB")} /</span>
                            <input
                              name="target"
                              defaultValue={g?.target ?? ""}
                              placeholder="goal"
                              inputMode="numeric"
                              className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-right tabular-nums"
                              aria-label={`${GOAL_LABELS[metric]} goal for ${r.person.name}`}
                            />
                            <button className="text-xs text-blue-700 hover:underline">Set</button>
                          </form>
                        ) : (
                          <span className="tabular-nums">
                            {actual.toLocaleString("en-GB")}
                            {g ? ` / ${g.target.toLocaleString("en-GB")}` : ""}
                          </span>
                        )}
                      </div>
                      {g && <Bar pct={progressPct(actual, g.target)} />}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">Pipeline</h2>
          <ul className="space-y-3 p-4">
            {byStage.map((s) => (
              <li key={s.stage} className="grid grid-cols-[120px_1fr_40px_80px] items-center gap-3 text-sm">
                <span>{STAGE_LABELS[s.stage]}</span>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full ${s.stage === "WON" ? "bg-emerald-500" : s.stage === "LOST" ? "bg-slate-400" : "bg-blue-500"}`}
                    style={{ width: `${(s.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-right font-semibold tabular-nums">{s.count}</span>
                <span className="text-right tabular-nums text-slate-500">{formatMoney(s.value)}</span>
              </li>
            ))}
          </ul>
          <p className="px-4 pb-3 text-xs text-slate-400">Value = one-off + 12 × monthly.</p>
        </section>

        <section className="card">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">
            Stalled deals <span className="font-normal text-slate-500">· no contact in {STALLED_AFTER_DAYS}+ days</span>
          </h2>
          <ul className="divide-y divide-slate-100">
            {stalled.slice(0, 10).map((l) => {
              const days = Math.floor((now.getTime() - (l.lastContactAt ?? l.createdAt).getTime()) / DAY_MS);
              return (
                <li key={l.id}>
                  <Link href={`/leads/${l.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
                    <span className="flex-1 truncate font-medium">{l.company}</span>
                    <span className="chip">{STAGE_LABELS[l.stage as Stage]}</span>
                    <span className="w-24 truncate text-right text-slate-500">{l.owner?.name ?? "Unassigned"}</span>
                    <span className="w-14 text-right font-medium text-rose-600">{days}d</span>
                  </Link>
                </li>
              );
            })}
            {stalled.length === 0 && <li className="px-4 py-6 text-sm text-slate-500">Nothing stalled. Nice.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
