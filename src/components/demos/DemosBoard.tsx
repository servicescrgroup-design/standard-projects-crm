"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Eye, MonitorPlay } from "lucide-react";
import { updateDemoAction } from "@/app/demoActions";
import { BOARD_STATUSES, demoStatusInfo, taskProgress } from "@/lib/demos";
import { toast } from "@/components/ui/Toaster";
import { DemoEditor, type DemoView } from "./DemoEditor";

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/** Kanban of demos: drag a card to change its status, click it to open the brief and checklist. */
export function DemosBoard({ demos, team, me, openId }: { demos: DemoView[]; team: { id: string; name: string }[]; me: { id: string; name: string }; openId: string | null }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [mine, setMine] = useState(false);
  const [open, setOpen] = useState<string | null>(openId);
  const [over, setOver] = useState<string | null>(null);
  const shown = demos.filter((d) => !mine || d.assignedToId === me.id);
  const closed = shown.filter((d) => d.status === "WON" || d.status === "LOST");
  const current = demos.find((d) => d.id === open) ?? null;
  const now = Date.now();

  const move = (id: string, status: string) =>
    start(async () => {
      const r = await updateDemoAction(id, { status });
      if (r.error) toast(r.error, "error");
      router.refresh();
    });

  const card = (d: DemoView) => {
    const p = taskProgress(d.tasks);
    const late = d.dueAt && new Date(d.dueAt).getTime() < now && ["TODO", "BUILDING", "READY"].includes(d.status);
    return (
      <button key={d.id} type="button" draggable onDragStart={(e) => e.dataTransfer.setData("text/demo", d.id)} onClick={() => setOpen(d.id)}
        className={`w-full rounded-xl border bg-white p-3 text-left shadow-sm hover:border-brand-300 ${open === d.id ? "border-brand-500" : "border-line"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium">{d.company}</div>
            <div className="truncate text-xs text-ink-3">{d.name}</div>
          </div>
          {d.assignedToName && <span title={d.assignedToName} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-700">{initials(d.assignedToName)}</span>}
        </div>
        {p.total > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(p.done / p.total) * 100}%` }} /></div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          {p.total > 0 && <span>{p.done}/{p.total}</span>}
          {d.dueAt && <span className={`inline-flex items-center gap-1 ${late ? "font-medium text-rose-600" : ""}`}><CalendarClock className="h-3.5 w-3.5" />{new Date(d.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
          {d.viewCount > 0 && <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{d.viewCount}</span>}
          {!d.demoUrl && d.status !== "TODO" && <span className="text-amber-700">No link yet</span>}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><MonitorPlay className="h-6 w-6 text-brand-600" /> Demos</h1>
          <p className="max-w-2xl text-sm text-ink-3">Demo websites your team builds for leads before they&rsquo;ve paid. Drag a card to move it along. Start one from any lead with &ldquo;Create demo project&rdquo;.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only mine to build</label>
      </div>

      {demos.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-semibold">No demos yet</p>
          <p className="mt-1 text-sm text-ink-3">Open a lead and press <b>Create demo project</b> in the Demo project section. <Link href="/deals" className="text-brand-700 hover:underline">Go to deals</Link></p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {BOARD_STATUSES.map((s) => {
              const items = shown.filter((d) => d.status === s);
              return (
                <div key={s} onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver(null)}
                  onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/demo"); if (id) move(id, s); }}
                  className={`min-w-[168px] flex-1 rounded-2xl p-2 ${over === s ? "bg-brand-50" : "bg-canvas"}`}>
                  <div className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
                    <span>{demoStatusInfo(s).label}</span><span className="text-xs text-ink-3">{items.length}</span>
                  </div>
                  <div className="space-y-2">{items.map(card)}</div>
                </div>
              );
            })}
          </div>
          {current && (
            <aside className="card w-full p-4 lg:w-[460px]"><DemoEditor key={current.id} demo={current} team={team} me={me.name} onClose={() => setOpen(null)} /></aside>
          )}
        </div>
      )}

      {closed.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Won and not going ahead · {closed.length}</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{closed.map(card)}</div>
        </details>
      )}
    </div>
  );
}
