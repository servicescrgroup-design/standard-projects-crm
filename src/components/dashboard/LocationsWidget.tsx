import Link from "next/link";
import { MapPin } from "lucide-react";

export type LocationRow = { area: string; count: number; pct: number };

/** Ranked areas from the "Area" field on leads (customers are mostly in Chiang Mai, so areas beat countries). */
export function LocationsWidget({ rows, missing }: { rows: LocationRow[]; missing: number }) {
  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold">Top Customer Locations</h2>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-ink-3">No areas recorded on leads yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rows.map((r, i) => (
            <li key={r.area}>
              <Link href={`/companies?q=${encodeURIComponent(r.area)}`} className="group block">
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-4 text-xs text-ink-3">{i + 1}</span>
                  <MapPin className="h-3.5 w-3.5 text-brand-600" />
                  <span className="flex-1 truncate group-hover:text-brand-700">{r.area}</span>
                  <span className="text-xs font-semibold tabular-nums">{r.pct}%</span>
                </div>
                <div className="ml-6 mt-1 h-1.5 rounded-full bg-line-soft">
                  <div className="h-1.5 rounded-full bg-brand-600 transition-[width] duration-300" style={{ width: `${r.pct}%` }} />
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {missing > 0 && <p className="mt-4 text-[11px] text-ink-3">{missing.toLocaleString("en-GB")} leads have no area recorded.</p>}
    </div>
  );
}
