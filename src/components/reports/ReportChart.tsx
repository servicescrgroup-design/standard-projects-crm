"use client";

import { useEffect, useRef, useState } from "react";
import { niceMax, smoothPath } from "@/lib/analytics";
import type { Chart, ReportResult } from "@/lib/reports";

export const SERIES_COLORS = ["#147cab", "#34b0ee", "#06486b", "#f5b83d", "#f79009", "#7cc0e0", "#d0d5dd", "#12b76a", "#7a5af8", "#f97066"];
const H = 320;
const PAD = { top: 16, right: 12, bottom: 56, left: 52 };

export const fmtNum = (n: number) => (Math.abs(n) >= 1000 ? n.toLocaleString("en-GB", { maximumFractionDigits: 0 }) : n.toLocaleString("en-GB", { maximumFractionDigits: 2 }));

/** Renders a report result as bar / stacked / line / area / donut. Hidden series are excluded. */
export function ReportChart({ result, chart, hidden, svgRef }: { result: ReportResult; chart: Chart; hidden: Set<string>; svgRef: React.RefObject<SVGSVGElement | null> }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [tip, setTip] = useState<{ x: number; y: number; title: string; lines: string[] } | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const segIdx = result.segments.map((s, i) => ({ s, i, color: SERIES_COLORS[i % SERIES_COLORS.length] })).filter((x) => !hidden.has(x.s));
  const { groups, values } = result;
  if (groups.length === 0) return <div ref={wrap} className="flex h-64 items-center justify-center text-sm text-ink-3">No data for this configuration.</div>;

  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const stacked = chart === "stacked" || chart === "area";
  const groupSum = (g: number) => segIdx.reduce((t, x) => t + values[g][x.i], 0);
  const max = niceMax(Math.max(1, ...groups.map((_, g) => (stacked ? groupSum(g) : Math.max(0, ...segIdx.map((x) => values[g][x.i]))))));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const band = innerW / groups.length;
  const cx = (g: number) => PAD.left + band * g + band / 2;
  const show = (e: React.MouseEvent, title: string, lines: string[]) => {
    const r = wrap.current!.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, title, lines });
  };

  let body: React.ReactNode = null;
  if (chart === "pie") {
    const totals = groups.map((_, g) => groupSum(g));
    const total = totals.reduce((a, b) => a + b, 0) || 1;
    const R = Math.min(innerH, innerW) / 2;
    const c = { x: width / 2, y: PAD.top + innerH / 2 + 10 };
    let a0 = -Math.PI / 2;
    body = totals.map((t, g) => {
      const a1 = a0 + (t / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a: number, r: number) => `${c.x + r * Math.cos(a)},${c.y + r * Math.sin(a)}`;
      const d = `M${p(a0, R)} A${R},${R} 0 ${large} 1 ${p(a1, R)} L${p(a1, R * 0.58)} A${R * 0.58},${R * 0.58} 0 ${large} 0 ${p(a0, R * 0.58)} Z`;
      a0 = a1;
      return <path key={g} d={d} fill={SERIES_COLORS[g % SERIES_COLORS.length]} stroke="#fff" strokeWidth={2} onMouseMove={(e) => show(e, groups[g], [`${fmtNum(t)} (${Math.round((t / total) * 100)}%)`])} onMouseLeave={() => setTip(null)} />;
    });
  } else if (chart === "line" || chart === "area") {
    let base = groups.map(() => 0);
    body = segIdx.map((x) => {
      const top = groups.map((_, g) => (chart === "area" ? base[g] + values[g][x.i] : values[g][x.i]));
      const pts = top.map((v, g) => ({ x: cx(g), y: y(v) }));
      const line = smoothPath(pts);
      const lower = chart === "area" ? base.map((v, g) => ({ x: cx(g), y: y(v) })).reverse() : [];
      const area = chart === "area" ? `${line} L${lower.map((p) => `${p.x},${p.y}`).join(" L")} Z` : "";
      if (chart === "area") base = top;
      return (
        <g key={x.s}>
          {chart === "area" && <path d={area} fill={x.color} fillOpacity={0.35} />}
          <path d={line} fill="none" stroke={x.color} strokeWidth={2} />
          {pts.map((p, g) => (
            <circle key={g} cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={x.color} strokeWidth={2} onMouseMove={(e) => show(e, groups[g], [`${x.s}: ${fmtNum(values[g][x.i])}`])} onMouseLeave={() => setTip(null)} />
          ))}
        </g>
      );
    });
  } else {
    const barW = Math.min(44, band * 0.62);
    body = groups.map((grp, g) => {
      if (chart === "stacked") {
        let acc = 0;
        return segIdx.map((x) => {
          const v = values[g][x.i];
          const y1 = y(acc + v);
          const h = y(acc) - y1;
          acc += v;
          return v > 0 ? <rect key={`${g}-${x.s}`} x={cx(g) - barW / 2} y={y1} width={barW} height={Math.max(0, h)} fill={x.color} onMouseMove={(e) => show(e, grp, [`${x.s}: ${fmtNum(v)}`, `Total: ${fmtNum(groupSum(g))}`])} onMouseLeave={() => setTip(null)} /> : null;
        });
      }
      const w = barW / Math.max(1, segIdx.length);
      return segIdx.map((x, k) => {
        const v = values[g][x.i];
        return <rect key={`${g}-${x.s}`} x={cx(g) - barW / 2 + k * w} y={y(v)} width={Math.max(1, w - 1)} height={Math.max(0, y(0) - y(v))} rx={2} fill={x.color} onMouseMove={(e) => show(e, grp, [`${x.s}: ${fmtNum(v)}`])} onMouseLeave={() => setTip(null)} />;
      });
    });
  }

  return (
    <div ref={wrap} className="relative">
      <svg ref={svgRef} width={width} height={H} xmlns="http://www.w3.org/2000/svg" className="block max-w-full" style={{ fontFamily: "Inter, sans-serif" }}>
        <rect width={width} height={H} fill="#fff" />
        {chart !== "pie" && (
          <>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(max * t)} y2={y(max * t)} stroke="#eef0f3" />
                <text x={PAD.left - 8} y={y(max * t) + 4} textAnchor="end" fontSize={11} fill="#98a2b3">{fmtNum(max * t)}</text>
              </g>
            ))}
            {groups.map((g, i) => (
              <text key={g} x={cx(i)} y={H - PAD.bottom + 16} textAnchor="end" fontSize={11} fill="#667085" transform={`rotate(-30 ${cx(i)} ${H - PAD.bottom + 16})`}>
                {g.length > 18 ? `${g.slice(0, 17)}…` : g}
              </text>
            ))}
          </>
        )}
        {body}
      </svg>
      {tip && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-[#0b1f33] px-2.5 py-1.5 text-xs text-white shadow-lg" style={{ left: tip.x, top: tip.y - 10 }}>
          <div className="font-semibold">{tip.title}</div>
          {tip.lines.map((l) => <div key={l} className="text-white/80">{l}</div>)}
        </div>
      )}
    </div>
  );
}
