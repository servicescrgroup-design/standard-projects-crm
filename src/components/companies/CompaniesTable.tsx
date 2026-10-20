"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { assignLeads } from "@/app/actions";
import { toast } from "@/components/ui/Toaster";

export type CompanyRow = {
  id: string;
  company: string;
  area: string | null;
  link: { href: string; label: string } | null;
  stageLabel: string;
  stagePill: string;
  contact: string | null;
  phone: string | null;
  position: string | null; // segment / industry (no job titles are recorded)
  owner: string | null;
  priority: string | null;
};

const initials = (s: string) => s.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function Assign() {
  const { pending } = useFormStatus();
  return <button className="btn-dark py-1.5" disabled={pending}>{pending ? "Assigning…" : "Assign"}</button>;
}

/** Companies list/gallery with selection and bulk assignment. Sorting and paging are links (URL state). */
export function CompaniesTable({ rows, view, canAssign, people, sortHref, sort, dir }: { rows: CompanyRow[]; view: "list" | "gallery"; canAssign: boolean; people: { id: string; name: string }[]; sortHref: Record<string, string>; sort: string; dir: "asc" | "desc" }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action] = useActionState(assignLeads, {});
  useEffect(() => {
    if (state.message) {
      toast(state.message);
      setSelected(new Set());
    }
    if (state.error) toast(state.error, "error");
  }, [state]);
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const Th = ({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) => (
    <th className={`border-r border-line-soft px-3 py-2.5 text-left text-[13px] font-medium text-ink-2 last:border-r-0 ${className}`} aria-sort={id && sort === id ? (dir === "asc" ? "ascending" : "descending") : undefined}>
      {id ? (
        <Link href={sortHref[id]} className="inline-flex items-center gap-1 hover:text-ink">
          {children}
          {sort === id && (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </Link>
      ) : children}
    </th>
  );

  const bulk = canAssign && selected.size > 0 && (
    <form action={action} className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-50/60 px-4 py-2 text-sm">
      {[...selected].map((id) => <input key={id} type="hidden" name="leadIds" value={id} />)}
      <span className="font-medium">{selected.size} selected</span>
      <span className="text-ink-2">→ assign to</span>
      <select name="ownerId" className="input w-auto py-1.5" defaultValue="" aria-label="Assign to">
        <option value="">Unassigned</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <Assign />
      <button type="button" className="btn text-ink-2 hover:bg-hover" onClick={() => setSelected(new Set())}>Clear</button>
    </form>
  );

  if (view === "gallery") {
    return (
      <div>
        {bulk}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((r) => (
            <div key={r.id} className={`card relative p-4 transition-shadow hover:shadow-[0_4px_12px_rgba(16,24,40,.08)] ${selected.has(r.id) ? "ring-2 ring-brand-500" : ""}`}>
              {canAssign && <input type="checkbox" className="absolute right-3 top-3 h-4 w-4 accent-brand-600" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.company}`} />}
              <Link href={`/leads/${r.id}`} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700">{initials(r.company)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold hover:text-brand-700">{r.company}</span>
                  <span className="block truncate text-xs text-ink-3">{r.area ?? "No area"}</span>
                </span>
              </Link>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className={`pill ${r.stagePill}`}>{r.stageLabel}</span>
                {r.priority && <span className="chip">Priority {r.priority}</span>}
                {r.position && <span className="chip max-w-full truncate">{r.position}</span>}
              </div>
              <div className="mt-3 border-t border-line-soft pt-3 text-xs text-ink-2">
                {r.contact ?? "No contact yet"}{r.phone && ` · ${r.phone}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {bulk}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-line">
            <tr>
              {canAssign && (
                <th className="w-10 border-r border-line-soft px-3 py-2.5">
                  <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all on this page" />
                </th>
              )}
              <Th id="company">Company</Th>
              <Th>LinkedIn / Online</Th>
              <Th id="stage">Stage</Th>
              <Th id="contact">Contacts</Th>
              <Th id="segment">Position</Th>
              {canAssign && <Th id="owner">Owner</Th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-b border-line-soft transition-colors last:border-b-0 hover:bg-hover ${selected.has(r.id) ? "bg-brand-50/50" : ""}`}>
                {canAssign && (
                  <td className="border-r border-line-soft px-3 py-2">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.company}`} />
                  </td>
                )}
                <td className="border-r border-line-soft px-3 py-2">
                  <Link href={`/leads/${r.id}`} className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-bold text-brand-700">{initials(r.company)}</span>
                    <span className="min-w-0"><span className="block max-w-[240px] truncate font-medium hover:text-brand-700">{r.company}</span>{r.area && <span className="block max-w-[240px] truncate text-xs text-ink-3">{r.area}</span>}</span>
                  </Link>
                </td>
                <td className="border-r border-line-soft px-3 py-2">
                  {r.link ? (
                    <a href={r.link.href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[200px] items-center gap-1 truncate text-brand-700 hover:underline">
                      {r.link.label} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : <span className="text-ink-3">—</span>}
                </td>
                <td className="border-r border-line-soft px-3 py-2"><span className={`pill ${r.stagePill}`}>{r.stageLabel}</span></td>
                <td className="border-r border-line-soft px-3 py-2">
                  {r.contact ? (
                    <span className="flex items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-line-soft text-[10px] font-semibold text-ink-2">{initials(r.contact)}</span><span className="max-w-[160px] truncate">{r.contact}</span></span>
                  ) : <span className="text-ink-3">{r.phone ?? "—"}</span>}
                </td>
                <td className="border-r border-line-soft px-3 py-2"><span className="block max-w-[200px] truncate text-ink-2" title={r.position ?? ""}>{r.position ?? "—"}</span></td>
                {canAssign && <td className="px-3 py-2 text-ink-2">{r.owner ?? <span className="font-medium text-amber-700">Unassigned</span>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-3">No companies match.</p>}
    </div>
  );
}
