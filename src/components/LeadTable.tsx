"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { assignLeads } from "@/app/actions";

export type LeadRow = {
  id: string;
  company: string;
  subtitle: string;
  stageLabel: string;
  priority: string | null;
  sourceLabel: string | null;
  valueLabel: string;
  ownerName: string | null;
  phone: string | null;
};

const PRIORITY_STYLE: Record<string, string> = {
  A: "bg-brand-600 text-white",
  B: "bg-brand-100 text-brand-800",
  C: "bg-line-soft text-ink-2",
};

function AssignButton() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Assigning…" : "Assign"}</button>;
}

/** Lead list with optional bulk-assign for owners and team leads. */
export function LeadTable({
  rows,
  canAssign,
  people,
}: {
  rows: LeadRow[];
  canAssign: boolean;
  people: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action] = useActionState(assignLeads, {});
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      {canAssign && (
        <form
          action={async (fd) => {
            await action(fd);
            setSelected(new Set());
          }}
          className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-2"
        >
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="leadIds" value={id} />
          ))}
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={allOnPage}
              onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))}
              aria-label="Select all leads on this page"
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all on page"}
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-sm text-ink-3">→ assign to</span>
              <select name="ownerId" className="input w-auto py-1.5" defaultValue="" aria-label="Assign to">
                <option value="">Unassigned</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <AssignButton />
            </>
          )}
          {state.message && <span className="text-sm font-medium text-brand-700">{state.message}</span>}
          {state.error && <span className="text-sm text-rose-600">{state.error}</span>}
        </form>
      )}
      <ul className="divide-y divide-line-soft">
        {rows.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white">
            {canAssign && (
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-brand-600"
                checked={selected.has(l.id)}
                onChange={() => toggle(l.id)}
                aria-label={`Select ${l.company}`}
              />
            )}
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                l.priority ? PRIORITY_STYLE[l.priority] : "text-ink-3"
              }`}
              title={l.priority ? `Priority ${l.priority}` : "No priority"}
            >
              {l.priority ?? "·"}
            </span>
            <Link href={`/leads/${l.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {l.company}
                  {l.sourceLabel && <span className="chip ml-2 bg-indigo-50 text-indigo-700">{l.sourceLabel}</span>}
                </div>
                <div className="truncate text-sm text-ink-3">{l.subtitle}</div>
              </div>
              <span className="chip">{l.stageLabel}</span>
              <span className="hidden w-24 text-right text-sm tabular-nums text-ink-2 sm:block">{l.valueLabel}</span>
              {canAssign && (
                <span className={`hidden w-28 truncate text-right text-sm sm:block ${l.ownerName ? "text-ink-2" : "font-medium text-amber-700"}`}>
                  {l.ownerName ?? "Unassigned"}
                </span>
              )}
            </Link>
            {l.phone && (
              <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs" aria-label={`Call ${l.company}`}>
                Call
              </a>
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-3">No leads match.</li>}
      </ul>
    </div>
  );
}
