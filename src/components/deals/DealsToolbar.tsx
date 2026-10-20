"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Columns3, Filter, GanttChart, Group, List, Plus, Search, X } from "lucide-react";
import { Dropdown, menuItemClass } from "@/components/ui/Dropdown";
import { createLead } from "@/app/actions";
import { PRIORITIES, SEGMENTS, SOURCES, SOURCE_LABELS, STAGES, STAGE_LABELS } from "@/lib/domain";

export type Person = { id: string; name: string };

const SORTS = [
  { v: "board", l: "Board order" },
  { v: "priority", l: "Priority" },
  { v: "value", l: "Value (high → low)" },
  { v: "due", l: "Next follow-up" },
  { v: "updated", l: "Recently updated" },
  { v: "company", l: "Company A–Z" },
];
const GROUPS = [
  { v: "stage", l: "Stage" },
  { v: "owner", l: "Owner" },
  { v: "segment", l: "Segment" },
  { v: "none", l: "No grouping" },
];

/** Search, filter, sort, group, view switcher and Add New for the Deals page. All state lives in the URL. */
export function DealsToolbar({ people, canAssign, isOwner, views = ["list", "kanban", "timeline"], placeholder = "Search deals…", groupable = true }: { people: Person[]; canAssign: boolean; isOwner: boolean; views?: ("list" | "kanban" | "timeline" | "gallery")[]; placeholder?: string; groupable?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [newOpen, setNewOpen] = useState(false);
  const first = useRef(true);

  const set = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page");
    router.replace(`${path}?${sp.toString()}`, { scroll: false });
  };

  // Debounced search.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => set({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const view = params.get("view") ?? views[0];
  const activeFilters = ["owner", "segment", "priority", "stage", "status", "source"].filter((k) => params.get(k));
  const VIEW_ICON = { list: List, kanban: Columns3, timeline: GanttChart, gallery: Columns3 } as const;
  const VIEW_LABEL = { list: "List", kanban: "Kanban", timeline: "Timeline", gallery: "Gallery" } as const;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-48 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="input pl-9" aria-label="Search" />
      </label>

      <Dropdown
        label="Filter"
        align="left"
        trigger={({ toggle, open }) => (
          <button type="button" onClick={toggle} aria-expanded={open} className="btn-ghost">
            <Filter className="h-4 w-4" /> Filter
            {activeFilters.length > 0 && <span className="rounded-md bg-brand-600 px-1.5 text-xs text-white">{activeFilters.length}</span>}
          </button>
        )}
      >
        {() => (
          <div className="w-64 space-y-3 p-2">
            <label className="block">
              <span className="label">Stage</span>
              <select className="input" value={params.get("stage") ?? ""} onChange={(e) => set({ stage: e.target.value || null, status: null })}>
                <option value="">All stages</option>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Priority</span>
              <select className="input" value={params.get("priority") ?? ""} onChange={(e) => set({ priority: e.target.value || null })}>
                <option value="">Any</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>Priority {p}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Segment</span>
              <select className="input" value={params.get("segment") ?? ""} onChange={(e) => set({ segment: e.target.value || null })}>
                <option value="">All segments</option>
                {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Source</span>
              <select className="input" value={params.get("source") ?? ""} onChange={(e) => set({ source: e.target.value || null })}>
                <option value="">All sources</option>
                {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
              </select>
            </label>
            {canAssign && (
              <label className="block">
                <span className="label">Owner</span>
                <select className="input" value={params.get("owner") ?? ""} onChange={(e) => set({ owner: e.target.value || null })}>
                  <option value="">Everyone</option>
                  <option value="none">Unassigned</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
            {activeFilters.length > 0 && (
              <button type="button" className="btn w-full text-ink-2 hover:bg-hover" onClick={() => set(Object.fromEntries(activeFilters.map((k) => [k, null])))}>
                <X className="h-4 w-4" /> Clear filters
              </button>
            )}
          </div>
        )}
      </Dropdown>

      <Dropdown
        label="Sort"
        align="left"
        trigger={({ toggle, open }) => (
          <button type="button" onClick={toggle} aria-expanded={open} className="btn-ghost">
            <ArrowUpDown className="h-4 w-4" /> Sort
          </button>
        )}
      >
        {(close) =>
          SORTS.map((s) => (
            <button key={s.v} role="menuitem" type="button" className={`${menuItemClass} ${(params.get("sort") ?? "board") === s.v ? "font-semibold text-brand-700" : ""}`} onClick={() => (set({ sort: s.v === "board" ? null : s.v }), close())}>
              {s.l}
            </button>
          ))
        }
      </Dropdown>

      {groupable && view === "list" && (
        <Dropdown
          label="Group"
          align="left"
          trigger={({ toggle, open }) => (
            <button type="button" onClick={toggle} aria-expanded={open} className="btn-ghost">
              <Group className="h-4 w-4" /> Group
            </button>
          )}
        >
          {(close) =>
            GROUPS.map((g) => (
              <button key={g.v} role="menuitem" type="button" className={`${menuItemClass} ${(params.get("group") ?? "stage") === g.v ? "font-semibold text-brand-700" : ""}`} onClick={() => (set({ group: g.v === "stage" ? null : g.v }), close())}>
                {g.l}
              </button>
            ))
          }
        </Dropdown>
      )}

      <div className="ml-auto flex items-center gap-2">
        <div className="flex rounded-lg bg-line-soft p-0.5" role="tablist" aria-label="View">
          {views.map((v) => {
            const Icon = VIEW_ICON[v];
            return (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => set({ view: v === views[0] ? null : v })} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${view === v ? "bg-white text-ink shadow-sm" : "text-ink-2 hover:text-ink"}`}>
                <Icon className="h-3.5 w-3.5" /> {VIEW_LABEL[v]}
              </button>
            );
          })}
        </div>
        <Dropdown
          label="Add new"
          trigger={({ toggle, open }) => (
            <button type="button" onClick={toggle} aria-expanded={open} className="btn-dark">
              <Plus className="h-4 w-4" /> Add New
            </button>
          )}
        >
          {(close) => (
            <>
              <button role="menuitem" type="button" className={menuItemClass} onClick={() => (setNewOpen(true), close())}>New deal / lead</button>
              <Link role="menuitem" href="/log" className={menuItemClass} onClick={close}>Log an activity</Link>
              {isOwner && <Link role="menuitem" href="/settings#import" className={menuItemClass} onClick={close}>Import from Notion</Link>}
            </>
          )}
        </Dropdown>
      </div>

      {newOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={() => setNewOpen(false)}>
          <form action={createLead} role="dialog" aria-label="New deal" className="w-full max-w-lg rounded-2xl border border-line bg-white shadow-[var(--shadow-menu)]" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-semibold">New deal</h2>
              <button type="button" onClick={() => setNewOpen(false)} className="btn px-2 text-ink-2 hover:bg-hover" aria-label="Close"><X className="h-5 w-5" /></button>
            </header>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="label">Company name *</span><input name="company" required className="input" autoFocus /></label>
              <label><span className="label">Contact</span><input name="contactName" className="input" /></label>
              <label><span className="label">Phone or LINE ID</span><input name="phone" className="input" /></label>
              <label><span className="label">One-off value (฿)</span><input name="value" inputMode="decimal" className="input" /></label>
              <label><span className="label">Monthly care plan (฿)</span><input name="monthlyValue" inputMode="decimal" className="input" /></label>
              <label><span className="label">Segment</span><select name="segment" className="input" defaultValue=""><option value="">—</option>{SEGMENTS.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label><span className="label">Priority</span><select name="priority" className="input" defaultValue="B">{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></label>
              {canAssign && (
                <label className="sm:col-span-2"><span className="label">Owner</span><select name="ownerId" className="input" defaultValue="self"><option value="self">Me</option><option value="">Unassigned</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              )}
            </div>
            <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
              <button type="button" onClick={() => setNewOpen(false)} className="btn-ghost">Cancel</button>
              <button className="btn-dark">Create deal</button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
