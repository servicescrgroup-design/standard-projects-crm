"use client";

import { useState } from "react";
import { niceMax } from "@/lib/analytics";

export type RetentionMonth = { label: string; carePlan: number; oneOff: number };

/**
 * Share of won customers on a monthly care plan (the recurring relationship), and new customers per
 * month split by whether they took one. Real counts from won deals.
 */
export function RetentionWidget({ pct, carePlanCount, wonCount, months }: { pct: number | null; carePlanCount: number; wonCount: number; months: RetentionMonth[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...months.map((m) => Math.max(m.carePlan, m.oneOff))));

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold">Care-plan retention</h2>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">{pct === null ? "—" : `${pct}%`}</span>
        <span className="text-xs text-ink-3">
          {wonCount ? `${carePlanCount} of ${wonCount} won customers on a care plan` : "No won customers yet"}
        </span>
      </div>
      <div className="mt-3 flex gap-3 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#34b0ee]" />With care plan</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#06486b]" />One-off</span>
      </div>
      <div className="relative mt-3 flex h-36 items-end gap-2" onMouseLeave={() => setHover(null)}>
        {months.map((m, i) => (
          <div key={m.label} className="flex flex-1 flex-col items-center gap-1" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}>
            <div className="flex h-28 w-full items-end justify-center gap-0.5">
              <div className="w-1/3 rounded-t bg-[#34b0ee] transition-[height] duration-300" style={{ height: `${(m.carePlan / max) * 100}%` }} />
              <div className="w-1/3 rounded-t bg-[#06486b] transition-[height] duration-300" style={{ height: `${(m.oneOff / max) * 100}%` }} />
            </div>
            <span className="text-[11px] text-ink-3">{m.label}</span>
            {hover === i && (
              <div className="pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-lg bg-[#0b1f33] px-2.5 py-1.5 text-xs text-white shadow-lg">
                <div className="text-white/70">{m.label}</div>
                {m.carePlan} with care plan · {m.oneOff} one-off
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
