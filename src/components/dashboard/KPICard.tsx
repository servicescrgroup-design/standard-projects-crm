import { Info } from "lucide-react";
import { TrendPill } from "./RevenueChart";

/** Headline metric with a comparison line and trend pill. `invert` = lower is better. */
export function KPICard({ label, value, comparison, pct, invert = false, help }: { label: string; value: string; comparison: string; pct: number | null; invert?: boolean; help: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-1.5 text-sm font-medium text-ink-2">
        {label}
        <span title={help} className="cursor-help text-ink-3" aria-label={help}>
          <Info className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-xs text-ink-3">
        <TrendPill pct={pct} invert={invert} />
        <span>{comparison}</span>
      </div>
    </div>
  );
}
