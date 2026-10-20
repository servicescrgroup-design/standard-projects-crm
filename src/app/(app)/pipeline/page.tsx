import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { leadScope, teamScope } from "@/lib/access";
import { SEGMENTS, STAGES, STAGE_LABELS, WON_STAGES, formatMoney, type Stage } from "@/lib/domain";

export const dynamic = "force-dynamic";

const CARDS_PER_COLUMN = 25;

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ owner?: string; segment?: string }> }) {
  const user = await requireUser();
  const { owner = "", segment = "" } = await searchParams;
  const isManager = user.role !== "REP";

  const filters: Prisma.LeadWhereInput[] = [leadScope(user)];
  if (isManager && owner) filters.push({ ownerId: owner === "none" ? null : owner });
  if ((SEGMENTS as readonly string[]).includes(segment)) filters.push({ segment });
  const where: Prisma.LeadWhereInput = { AND: filters };

  // One query for the whole board (sorted in the database), grouped here. Ten parallel queries
  // queued behind a single pooled connection used to time out.
  const [leads, people] = await Promise.all([
    db.lead.findMany({
      where,
      select: {
        id: true,
        company: true,
        stage: true,
        priority: true,
        segment: true,
        value: true,
        monthlyValue: true,
        owner: { select: { name: true } },
      },
      orderBy: [{ priority: { sort: "asc", nulls: "last" } }, { nextFollowUpAt: { sort: "asc", nulls: "last" } }],
    }),
    db.user.findMany({ where: teamScope(user), orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const byStage = new Map<string, typeof leads>(STAGES.map((s) => [s, []]));
  for (const l of leads) byStage.get(l.stage)?.push(l);
  const columns = STAGES.map((s) => (byStage.get(s) ?? []).slice(0, CARDS_PER_COLUMN));
  const totalFor = (s: Stage) => {
    const all = byStage.get(s) ?? [];
    return { count: all.length, value: all.reduce((t, l) => t + l.value + l.monthlyValue * 12, 0) };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Pipeline</h1>
          <p className="text-sm text-slate-500">Every deal by stage. Strongest prospects at the top of each column.</p>
        </div>
        <form className="flex flex-wrap gap-2">
          <select name="segment" defaultValue={segment} className="input w-auto" aria-label="Segment">
            <option value="">All segments</option>
            {SEGMENTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {isManager && (
            <select name="owner" defaultValue={owner} className="input w-auto" aria-label="Owner">
              <option value="">Everyone</option>
              <option value="none">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn-ghost">Filter</button>
        </form>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
        <div className="flex gap-3" style={{ minWidth: `${STAGES.length * 236}px` }}>
          {STAGES.map((stage, i) => {
            const { count, value } = totalFor(stage);
            const cards = columns[i];
            const qs = new URLSearchParams({ stage, ...(owner ? { owner } : {}), ...(segment ? { segment } : {}) });
            return (
              <section key={stage} className="card flex w-56 shrink-0 flex-col">
                <header className="border-b border-slate-100 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className={`text-sm font-semibold ${WON_STAGES.includes(stage) ? "text-green-700" : stage === "LOST" ? "text-slate-500" : ""}`}>
                      {STAGE_LABELS[stage]}
                    </h2>
                    <span className="chip">{count.toLocaleString("en-GB")}</span>
                  </div>
                  <div className="mt-0.5 text-xs tabular-nums text-slate-500">{value ? formatMoney(value) : "—"}</div>
                </header>
                <ul className="flex-1 space-y-2 p-2">
                  {cards.map((l) => (
                    <li key={l.id}>
                      <Link href={`/leads/${l.id}`} className="block rounded-xl bg-white/80 p-2.5 text-sm shadow-sm ring-1 ring-slate-900/5 hover:ring-green-500/40">
                        <div className="flex items-start gap-1.5">
                          {l.priority && (
                            <span className={`mt-0.5 rounded px-1 text-[10px] font-bold ${l.priority === "A" ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                              {l.priority}
                            </span>
                          )}
                          <span className="line-clamp-2 font-medium">{l.company}</span>
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-500">
                          {[l.segment, l.owner?.name ?? (isManager ? "Unassigned" : null)].filter(Boolean).join(" · ")}
                        </div>
                      </Link>
                    </li>
                  ))}
                  {count === 0 && <li className="px-1 py-4 text-center text-xs text-slate-400">Empty</li>}
                </ul>
                {count > cards.length && (
                  <Link href={`/leads?${qs.toString()}`} className="border-t border-slate-100 px-3 py-2 text-xs font-medium text-green-700 hover:underline">
                    See all {count.toLocaleString("en-GB")} →
                  </Link>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
