"use client";

import Link from "next/link";
import { useState } from "react";

export type Segment = { key: string; label: string; count: number; color: string; href: string };
type Tab = "status" | "sources" | "qualification";
const TABS: { id: Tab; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "sources", label: "Sources" },
  { id: "qualification", label: "Qualification" },
];

/** Distribution of leads by status, source or qualification; each segment links to those leads. */
export function LeadsWidget({ data }: { data: Record<Tab, Segment[]> }) {
  const [tab, setTab] = useState<Tab>("status");
  const segments = data[tab];
  const total = segments.reduce((s, x) => s + x.count, 0);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Leads Management</h2>
        <div className="flex rounded-lg bg-line-soft p-0.5" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${tab === t.id ? "bg-white text-ink shadow-sm" : "text-ink-2 hover:text-ink"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full bg-line-soft" aria-hidden>
        {total > 0 &&
          segments.filter((s) => s.count > 0).map((s) => (
            <div key={s.key} className="h-full transition-[width] duration-300" style={{ width: `${(s.count / total) * 100}%`, background: s.color }} />
          ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {segments.map((s) => (
          <Link key={s.key} href={s.href} className="rounded-xl border border-line p-3 transition-colors duration-150 hover:bg-hover">
            <div className="flex items-center gap-1.5 text-xs text-ink-2">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-semibold tabular-nums">{s.count.toLocaleString("en-GB")}</span>
              <span className="text-xs text-ink-3">leads</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
