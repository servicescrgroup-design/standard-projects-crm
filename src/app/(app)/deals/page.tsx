import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { leadWhere, type LeadFilterParams } from "@/lib/server/leadFilters";
import { canAssignTo } from "@/lib/access";
import { CLOSED_STAGES, DAY_MS, STAGES, STAGE_LABELS, STAGE_PILL, formatMoney, isStage, type Stage } from "@/lib/domain";
import { DealBoard, type DealCardData } from "@/components/deals/DealBoard";
import { DealsToolbar } from "@/components/deals/DealsToolbar";

export const dynamic = "force-dynamic";

type Search = LeadFilterParams & { view?: string; sort?: string; group?: string };

const ORDER: Record<string, Prisma.LeadOrderByWithRelationInput[]> = {
  board: [{ boardPosition: { sort: "asc", nulls: "last" } }, { priority: { sort: "asc", nulls: "last" } }, { nextFollowUpAt: { sort: "asc", nulls: "last" } }],
  priority: [{ priority: { sort: "asc", nulls: "last" } }, { company: "asc" }],
  value: [{ value: "desc" }, { monthlyValue: "desc" }],
  due: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }],
  updated: [{ updatedAt: "desc" }],
  company: [{ company: "asc" }],
};

export default async function DealsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;
  const view = params.view === "list" || params.view === "timeline" ? params.view : "kanban";
  const sort = params.sort && ORDER[params.sort] ? params.sort : "board";
  const now = new Date();

  const [leads, everyone] = await Promise.all([
    db.lead.findMany({
      where: leadWhere(user, params),
      select: {
        id: true, company: true, stage: true, priority: true, segment: true, serviceInterest: true, needs: true, whyFit: true,
        value: true, monthlyValue: true, nextFollowUpAt: true, createdAt: true, stageChangedAt: true, boardPosition: true,
        contactName: true, owner: { select: { name: true } },
      },
      orderBy: ORDER[sort],
      take: 3000,
    }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, teamId: true } }),
  ]);
  const people = everyone.filter((p) => canAssignTo(user, p)).map((p) => ({ id: p.id, name: p.name }));
  const canAssign = user.role !== "REP";
  const firstYear = (l: (typeof leads)[number]) => l.value + l.monthlyValue * 12;

  const stages: Stage[] = isStage(params.stage) ? [params.stage] : [...STAGES];
  const cards: DealCardData[] = leads.map((l) => ({
    id: l.id,
    company: l.company,
    stage: (isStage(l.stage) ? l.stage : "NEW") as Stage,
    priority: l.priority,
    tag: l.serviceInterest ?? l.segment,
    note: l.needs ?? l.whyFit,
    value: firstYear(l),
    due: l.nextFollowUpAt?.toISOString() ?? null,
    overdue: !!l.nextFollowUpAt && l.nextFollowUpAt < now && !CLOSED_STAGES.includes(l.stage as Stage),
    owner: l.owner?.name ?? null,
    position: l.boardPosition,
  }));

  return (
    <div className="space-y-5">
      <DealsToolbar people={people} canAssign={canAssign} isOwner={user.role === "OWNER"} views={["kanban", "list", "timeline"]} />
      <p className="text-xs text-ink-3">
        {leads.length.toLocaleString("en-GB")} deal{leads.length === 1 ? "" : "s"}
        {view === "kanban" && " · drag a card to change its stage"}
      </p>
      {view === "kanban" && <DealBoard stages={stages} deals={cards} />}
      {view === "list" && <DealList leads={leads} group={params.group ?? "stage"} canAssign={canAssign} />}
      {view === "timeline" && <DealTimeline leads={leads} now={now} />}
    </div>
  );
}

type Row = {
  id: string; company: string; stage: string; priority: string | null; segment: string | null; contactName: string | null;
  value: number; monthlyValue: number; nextFollowUpAt: Date | null; createdAt: Date; stageChangedAt: Date; owner: { name: string } | null;
};

function DealList({ leads, group, canAssign }: { leads: Row[]; group: string; canAssign: boolean }) {
  const keyOf = (l: Row) =>
    group === "owner" ? l.owner?.name ?? "Unassigned" : group === "segment" ? l.segment ?? "No segment" : group === "none" ? "All deals" : STAGE_LABELS[l.stage as Stage] ?? l.stage;
  const groups = new Map<string, Row[]>();
  for (const l of leads) groups.set(keyOf(l), [...(groups.get(keyOf(l)) ?? []), l]);
  const ordered = group === "stage" ? STAGES.map((s) => STAGE_LABELS[s]).filter((k) => groups.has(k)) : [...groups.keys()].sort();

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-medium text-ink-2">
            <th className="px-4 py-2.5 font-medium">Deal</th>
            <th className="px-3 py-2.5 font-medium">Stage</th>
            <th className="px-3 py-2.5 font-medium">Priority</th>
            <th className="px-3 py-2.5 text-right font-medium">Value</th>
            <th className="px-3 py-2.5 font-medium">Next follow-up</th>
            {canAssign && <th className="px-3 py-2.5 font-medium">Owner</th>}
          </tr>
        </thead>
        {ordered.map((k) => (
          <tbody key={k}>
            <tr className="bg-canvas">
              <th colSpan={canAssign ? 6 : 5} className="px-4 py-1.5 text-left text-xs font-semibold text-ink-2">
                {k} <span className="font-normal text-ink-3">· {groups.get(k)!.length}</span>
              </th>
            </tr>
            {groups.get(k)!.slice(0, 200).map((l) => (
              <tr key={l.id} className="border-t border-line-soft transition-colors hover:bg-hover">
                <td className="px-4 py-2.5">
                  <Link href={`/leads/${l.id}`} className="font-medium hover:text-brand-700">{l.company}</Link>
                  {l.contactName && <div className="text-xs text-ink-3">{l.contactName}</div>}
                </td>
                <td className="px-3 py-2.5"><span className={`pill ${STAGE_PILL[l.stage as Stage] ?? ""}`}>{STAGE_LABELS[l.stage as Stage] ?? l.stage}</span></td>
                <td className="px-3 py-2.5 text-ink-2">{l.priority ?? "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{l.value + l.monthlyValue ? formatMoney(l.value + l.monthlyValue * 12) : "—"}</td>
                <td className="px-3 py-2.5 text-ink-2">{l.nextFollowUpAt ? l.nextFollowUpAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}</td>
                {canAssign && <td className="px-3 py-2.5 text-ink-2">{l.owner?.name ?? "Unassigned"}</td>}
              </tr>
            ))}
            {groups.get(k)!.length > 200 && (
              <tr><td colSpan={6} className="px-4 py-2 text-xs text-ink-3">Showing 200 of {groups.get(k)!.length}. Narrow with filters or search.</td></tr>
            )}
          </tbody>
        ))}
      </table>
      {leads.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-3">No deals match.</p>}
    </div>
  );
}

/** Each deal as a bar from when it was added to its next follow-up (or when it closed). */
function DealTimeline({ leads, now }: { leads: Row[]; now: Date }) {
  const start = new Date(now.getTime() - 60 * DAY_MS);
  const end = new Date(now.getTime() + 30 * DAY_MS);
  const span = end.getTime() - start.getTime();
  const pct = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - start.getTime()) / span) * 100));
  const rows = leads
    .filter((l) => !CLOSED_STAGES.includes(l.stage as Stage) || l.stageChangedAt >= start)
    .slice(0, 120);
  const weeks = Array.from({ length: 13 }, (_, i) => new Date(start.getTime() + i * 7 * DAY_MS));

  return (
    <div className="card overflow-x-auto">
      <div className="min-w-[860px]">
        <div className="relative ml-56 h-8 border-b border-line text-[11px] text-ink-3">
          {weeks.map((w) => (
            <span key={w.toISOString()} className="absolute top-2 -translate-x-1/2" style={{ left: `${pct(w)}%` }}>
              {w.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          ))}
        </div>
        <ul className="relative">
          <div className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-rose-400" style={{ left: `calc(14rem + (100% - 14rem) * ${pct(now) / 100})` }} aria-hidden />
          {rows.map((l) => {
            const closed = CLOSED_STAGES.includes(l.stage as Stage);
            const barEnd = closed ? l.stageChangedAt : l.nextFollowUpAt && l.nextFollowUpAt > now ? l.nextFollowUpAt : now;
            const left = pct(l.createdAt < start ? start : l.createdAt);
            const width = Math.max(1.2, pct(barEnd) - left);
            return (
              <li key={l.id} className="flex items-center border-b border-line-soft hover:bg-hover">
                <Link href={`/leads/${l.id}`} className="w-56 shrink-0 truncate px-4 py-2 text-sm font-medium hover:text-brand-700">{l.company}</Link>
                <div className="relative h-9 flex-1">
                  <div className={`absolute top-2.5 h-4 rounded-md ${STAGE_PILL[l.stage as Stage] ?? ""}`} style={{ left: `${left}%`, width: `${width}%` }} title={`${STAGE_LABELS[l.stage as Stage]} · added ${l.createdAt.toLocaleDateString("en-GB")}`} />
                  {!closed && l.nextFollowUpAt && l.nextFollowUpAt >= start && l.nextFollowUpAt <= end && (
                    <span className="absolute top-2 h-5 w-1 rounded bg-brand-700" style={{ left: `${pct(l.nextFollowUpAt)}%` }} title={`Follow up ${l.nextFollowUpAt.toLocaleDateString("en-GB")}`} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-3">No deals in this window.</p>}
        <p className="px-4 py-2 text-[11px] text-ink-3">Last 60 days to the next 30. Bars run from when a deal was added to its next follow-up (dark tick) or when it closed. Red line = today.</p>
      </div>
    </div>
  );
}
