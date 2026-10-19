import type { GoalMetric } from "./domain";

export type StatActivity = { userId: string | null; type: string; source?: string };
export type StatWonLead = { ownerId: string | null; value: number; monthlyValue: number };
export type RepStats = Record<GoalMetric, number>;

const empty = (): RepStats => ({ CALLS: 0, EMAILS: 0, MEETINGS: 0, DEALS_WON: 0, REVENUE_WON: 0 });

/**
 * Per-rep totals for a period. Revenue counts first-year value (one-off + 12 × monthly), in pounds.
 * Activities and won leads must already be filtered to the period.
 */
export function computeRepStats(
  userIds: string[],
  activities: StatActivity[],
  wonLeads: StatWonLead[],
): Map<string, RepStats> {
  const stats = new Map(userIds.map((id) => [id, empty()]));
  for (const a of activities) {
    const s = a.userId ? stats.get(a.userId) : undefined;
    if (!s) continue;
    if (a.type === "CALL") s.CALLS++;
    else if (a.type === "EMAIL_OUT" || a.type === "PROPOSAL") s.EMAILS++;
    else if (a.type === "MEETING" || a.type === "VISIT") s.MEETINGS++;
  }
  for (const l of wonLeads) {
    const s = l.ownerId ? stats.get(l.ownerId) : undefined;
    if (!s) continue;
    s.DEALS_WON++;
    s.REVENUE_WON += Math.round((l.value + l.monthlyValue * 12) / 100);
  }
  return stats;
}

export function progressPct(actual: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((actual / target) * 100));
}

/**
 * Leaderboard ranking: average goal attainment across a rep's goals, falling back to raw
 * activity volume when nobody has goals set, so the board is still useful from day one.
 */
export function leaderboardScore(stats: RepStats, goals: { metric: GoalMetric; target: number }[]): number {
  if (goals.length === 0) return stats.CALLS + stats.EMAILS + stats.MEETINGS * 3 + stats.DEALS_WON * 10;
  const total = goals.reduce((sum, g) => sum + progressPct(stats[g.metric], g.target), 0);
  return Math.round(total / goals.length);
}
