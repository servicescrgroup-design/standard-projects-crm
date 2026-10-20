"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { RANGES, niceMax, revenueSeries, smoothPath, type Range } from "@/lib/analytics";

const H = 260;
const PAD = { top: 16, right: 12, bottom: 28, left: 56 };

const baht = (minor: number) => `฿${Math.round(minor / 100).toLocaleString("en-GB")}`;
const shortBaht = (minor: number) => {
  const v = minor / 100;
  if (v >= 1_000_000) return `฿${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1000) return `฿${Math.round(v / 1000)}k`;
  return `฿${Math.round(v)}`;
};

export function TrendPill({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return null;
  const good = invert ? pct <= 0 : pct >= 0;
  const Icon = pct >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${good ? "bg-[#d5f5e8] text-[#146c4b]" : "bg-[#ffdada] text-[#a93f42]"}`}>
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {Math.abs(pct)}%
    </span>
  );
}

/** Won-deal revenue over time. Points are real won deals: when they were won and their first-year value. */
export function RevenueChart({ points, nowIso }: { points: { at: string; amount: number }[]; nowIso: string }) {
  const [range, setRange] = useState<Range>("1Y");
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(720);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const series = useMemo(
    () => revenueSeries(points.map((p) => ({ at: new Date(p.at), amount: p.amount })), range, new Date(nowIso)),
    [points, range, nowIso],
  );
  const { buckets } = series;
  const max = niceMax(Math.max(...buckets.map((b) => b.value)));
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (buckets.length === 1 ? innerW / 2 : (i / (buckets.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const pts = buckets.map((b, i) => ({ x: Math.round(x(i) * 10) / 10, y: Math.round(y(b.value) * 10) / 10 }));
  const line = smoothPath(pts);
  const area = pts.length ? `${line} L${pts[pts.length - 1].x},${PAD.top + innerH} L${pts[0].x},${PAD.top + innerH} Z` : "";
  const labelEvery = Math.ceil(buckets.length / Math.max(2, Math.floor(innerW / 64)));
  const empty = series.total === 0 && series.previousTotal === 0;

  function pick(clientX: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rel = clientX - rect.left - PAD.left;
    const i = Math.round((rel / innerW) * (buckets.length - 1));
    setHover(Math.min(buckets.length - 1, Math.max(0, i)));
  }

  const h = hover !== null ? buckets[hover] : null;
  const tipLeft = hover !== null ? Math.min(Math.max(pts[hover].x, 70), width - 70) : 0;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink-2">Revenue</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-semibold tracking-tight">{baht(series.total)}</span>
            <TrendPill pct={series.changePct} />
          </div>
          <div className="mt-0.5 text-xs text-ink-3">
            {range === "ALL" ? "All won deals (first-year value)" : `vs ${baht(series.previousTotal)} the period before`}
          </div>
        </div>
        <div className="flex rounded-lg bg-line-soft p-0.5" role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              onClick={() => (setRange(r), setHover(null))}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${range === r ? "bg-white text-ink shadow-sm" : "text-ink-2 hover:text-ink"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative mt-4 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg"
        tabIndex={0}
        role="img"
        aria-label={`Revenue chart, ${range}. Total ${baht(series.total)}. Use left and right arrow keys to read each period.`}
        onMouseMove={(e) => pick(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => pick(e.touches[0].clientX)}
        onTouchMove={(e) => pick(e.touches[0].clientX)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((v) => Math.min(buckets.length - 1, (v ?? -1) + 1));
          if (e.key === "ArrowLeft") setHover((v) => Math.max(0, (v ?? buckets.length) - 1));
          if (e.key === "Escape") setHover(null);
        }}
        onBlur={() => setHover(null)}
      >
        <svg width={width} height={H} className="block max-w-full" aria-hidden>
          <defs>
            <linearGradient id="rev-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#147cab" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#147cab" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(max * t)} y2={y(max * t)} stroke="#e6e8ec" strokeDasharray="4 4" />
              <text x={PAD.left - 10} y={y(max * t) + 4} textAnchor="end" className="fill-ink-3 text-[11px]">
                {shortBaht(max * t)}
              </text>
            </g>
          ))}
          {buckets.map((b, i) =>
            i % labelEvery === 0 || i === buckets.length - 1 ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-ink-3 text-[11px]">
                {b.label}
              </text>
            ) : null,
          )}
          {!empty && (
            <>
              <path d={area} fill="url(#rev-fill)" className="transition-[d] duration-300" />
              <path d={line} fill="none" stroke="#147cab" strokeWidth={2.25} strokeLinecap="round" className="transition-[d] duration-300" />
            </>
          )}
          {h && hover !== null && (
            <g>
              <line x1={pts[hover].x} x2={pts[hover].x} y1={PAD.top} y2={PAD.top + innerH} stroke="#06486b" strokeDasharray="4 4" strokeOpacity="0.5" />
              <circle cx={pts[hover].x} cy={pts[hover].y} r={5} fill="#fff" stroke="#147cab" strokeWidth={2.5} />
            </g>
          )}
        </svg>
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 rounded-lg bg-[#0b1f33] px-3 py-2 text-white shadow-lg transition-[left,top] duration-150"
            style={{ left: tipLeft, top: Math.max(0, pts[hover].y - 64) }}
          >
            <div className="text-[11px] text-white/70">{h.tooltip}</div>
            <div className="text-sm font-semibold">{baht(h.value)}</div>
          </div>
        )}
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-3">
            No won deals in this period yet.
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>Revenue by period</caption>
        <tbody>
          {buckets.map((b, i) => (
            <tr key={i}>
              <th>{b.tooltip}</th>
              <td>{baht(b.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
