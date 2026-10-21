"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Columns3, Filter, GanttChart, Group, List, Plus, Search, X } from "lucide-react";
import { Dropdown, menuItemClass } from "@/components/ui/Dropdown";
import { MultiSelect, Select } from "@/components/ui/Select";
import { createLead } from "@/app/actions";
import { PRIORITIES, SEGMENTS, SOURCES, SOURCE_LABELS, STAGES, STAGE_LABELS } from "@/lib/domain";

export type Person = { id: string; name: string };
export type ToolbarFacets = { countries: { name: string; flag: string; count: number }[]; industries: { name: string; count: number }[] };

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

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
export function DealsToolbar({ people, canAssign, isOwner, views = ["list", "kanban", "timeline"], placeholder = "Search deals…", groupable = true, facets }: { people: Person[]; canAssign: boolean; isOwner: boolean; views?: ("list" | "kanban" | "timeline" | "gallery")[]; placeholder?: string; groupable?: boolean; facets?: ToolbarFacets }) {
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
  const activeFilters = ["owner", "segment", "country", "priority", "stage", "status", "source"].filter((k) => params.get(k));
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
          <div className="w-72 space-y-3 p-2">
            {facets && (
              <>
                <div>
                  <span className="label">Country</span>
                  <MultiSelect
                    ariaLabel="Countries"
                    placeholder="All countries"
                    values={list(params.get("country"))}
                    onChange={(v) => set({ country: v.join(",") || null })}
                    options={facets.countries.map((c) => ({ value: c.name, label: `${c.flag} ${c.name}`, hint: c.count.toLocaleString("en-GB") }))}
                  />
                </div>
                <div>
                  <span className="label">Industry</span>
                  <MultiSelect
                    ariaLabel="Industries"
                    placeholder="All industries"
                    values={list(params.get("segment"))}
                    onChange={(v) => set({ segment: v.join(",") || null })}
                    options={facets.industries.map((i) => ({ value: i.name, label: i.name === "none" ? "No industry set" : i.name, hint: i.count.toLocaleString("en-GB") }))}
                  />
                </div>
              </>
            )}
            <div>
              <span className="label">Stage</span>
              <Select
                ariaLabel="Stage"
                value={params.get("stage") ?? ""}
                onChange={(v) => set({ stage: v || null, status: null })}
                options={[{ value: "", label: "All stages" }, ...STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))]}
              />
            </div>
            <div>
              <span className="label">Priority</span>
              <Select
                ariaLabel="Priority"
                value={params.get("priority") ?? ""}
                onChange={(v) => set({ priority: v || null })}
                options={[{ value: "", label: "Any priority" }, ...PRIORITIES.map((p) => ({ value: p, label: `Priority ${p}` }))]}
              />
            </div>
            {!facets && (
              <div>
                <span className="label">Industry</span>
                <Select
                  ariaLabel="Industry"
                  value={params.get("segment") ?? ""}
                  onChange={(v) => set({ segment: v || null })}
                  options={[{ value: "", label: "All industries" }, ...SEGMENTS.map((s) => ({ value: s, label: s }))]}
                />
              </div>
            )}
            <div>
              <span className="label">Source</span>
              <Select
                ariaLabel="Source"
                value={params.get("source") ?? ""}
                onChange={(v) => set({ source: v || null })}
                options={[{ value: "", label: "All sources" }, ...SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))]}
              />
            </div>
            {canAssign && (
              <div>
                <span className="label">Owner</span>
                <Select
                  ariaLabel="Owner"
                  value={params.get("owner") ?? ""}
                  onChange={(v) => set({ owner: v || null })}
                  options={[{ value: "", label: "Everyone" }, { value: "none", label: "Unassigned" }, ...people.map((p) => ({ value: p.id, label: p.name }))]}
                />
              </div>
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
              <div><span className="label">Industry</span><Select name="segment" ariaLabel="Industry" defaultValue="" options={[{ value: "", label: "—" }, ...SEGMENTS.map((s) => ({ value: s, label: s }))]} /></div>
              <div><span className="label">Priority</span><Select name="priority" ariaLabel="Priority" defaultValue="B" options={PRIORITIES.map((p) => ({ value: p, label: p }))} /></div>
              {canAssign && (
                <div className="sm:col-span-2"><span className="label">Owner</span><Select name="ownerId" ariaLabel="Owner" defaultValue="self" options={[{ value: "self", label: "Me" }, { value: "", label: "Unassigned" }, ...people.map((p) => ({ value: p.id, label: p.name }))]} /></div>
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
