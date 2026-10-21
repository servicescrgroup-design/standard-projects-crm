"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, BarChart3, Building2, Database, Download, FileSpreadsheet, Plus, Trash2, X } from "lucide-react";
import { deleteReport, saveReport } from "@/app/actions";
import { toast } from "@/components/ui/Toaster";
import { Select } from "@/components/ui/Select";
import { toCsv } from "@/lib/csv";
import {
  CHARTS, CHART_NAMES, DATA_SOURCES, DEFAULT_CONFIG, DIMENSIONS, MEASURES, OPS, OP_NAMES, SOURCE_NAMES, TOTAL,
  type DataSource, type Op, type ReportConfig, type ReportResult,
} from "@/lib/reports";
import { ReportChart, SERIES_COLORS, fmtNum } from "./ReportChart";

export type SavedReport = { id: string; title: string; config: ReportConfig; shared: boolean; mine: boolean; owner: string };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function Field({ label, icon: Icon, children }: { label: string; icon?: typeof Database; children: React.ReactNode }) {
  return (
    <div>
      <div className="label flex items-center gap-1.5">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</div>
      {children}
    </div>
  );
}

/** Report builder: preview (chart + table) on the left, Insights configuration on the right. */
export function ReportEditor({ reports, initial }: { reports: SavedReport[]; initial: { result: ReportResult; config: ReportConfig } }) {
  const router = useRouter();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const current = reports.find((r) => r.id === currentId) ?? null;
  const [saved, setSaved] = useState<{ title: string; config: ReportConfig; shared: boolean }>({ title: "Calculated Value", config: initial.config, shared: false });
  const [title, setTitle] = useState(saved.title);
  const [config, setConfig] = useState<ReportConfig>(initial.config);
  const [shared, setShared] = useState(false);
  const [result, setResult] = useState<ReportResult>(initial.result);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<{ col: number; dir: 1 | -1 }>({ col: -1, dir: -1 });
  const [pending, start] = useTransition();
  const [panelOpen, setPanelOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dirty = !same({ title, config, shared }, saved);

  // Re-run whenever the configuration changes (debounced).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/reports/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ config }) });
        const data = await res.json();
        if (!cancelled) {
          if (!res.ok) toast(data.error ?? "Couldn't run the report", "error");
          else setResult(data.result);
        }
      } catch {
        if (!cancelled) toast("Network error while running the report", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [config]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const set = (patch: Partial<ReportConfig>) => setConfig((c) => ({ ...c, ...patch }));
  const dims = DIMENSIONS[config.source];
  const measures = MEASURES[config.source];

  function open(id: string | null) {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    const r = reports.find((x) => x.id === id);
    const next = r ? { title: r.title, config: r.config, shared: r.shared } : { title: "Untitled report", config: DEFAULT_CONFIG, shared: false };
    setCurrentId(r?.id ?? null);
    setSaved(next);
    setTitle(next.title);
    setConfig(next.config);
    setShared(next.shared);
    setHidden(new Set());
  }

  function discard() {
    setTitle(saved.title);
    setConfig(saved.config);
    setShared(saved.shared);
  }

  function save(asCopy = false) {
    start(async () => {
      const res = await saveReport({ id: asCopy ? null : current?.mine ? currentId : null, title, config, shared });
      if (res.error) return toast(res.error, "error");
      toast(res.message ?? "Saved");
      setSaved({ title, config, shared });
      setCurrentId(res.id ?? null);
      router.refresh();
    });
  }

  function remove() {
    if (!current?.mine || !confirm(`Delete “${current.title}”?`)) return;
    start(async () => {
      const res = await deleteReport(current.id);
      if (res.error) return toast(res.error, "error");
      toast("Report deleted");
      setCurrentId(null);
      router.refresh();
    });
  }

  const visibleSegs = result.segments.filter((s) => !hidden.has(s));
  const tableRows = useMemo(() => {
    const rows = result.groups.map((g, i) => ({ g, total: result.groupTotals[i], vals: result.segments.map((_, s) => result.values[i][s]) }));
    if (sortCol.col === -1) return rows;
    return [...rows].sort((a, b) => {
      const av = sortCol.col === 0 ? a.total : a.vals[sortCol.col - 1];
      const bv = sortCol.col === 0 ? b.total : b.vals[sortCol.col - 1];
      return (av - bv) * sortCol.dir;
    });
  }, [result, sortCol]);
  const groupLabel = config.groupBy ? dims[config.groupBy] : "All";
  const metricLabel = config.op === "count" ? "Count" : `${OP_NAMES[config.op]} of ${measures[config.measure ?? ""] ?? ""}`;
  const multiSeries = result.segments.length > 1 || result.segments[0] !== TOTAL;

  function downloadCsv() {
    const header = [groupLabel, config.op === "count" ? "Sum" : metricLabel, ...(multiSeries ? result.segments : [])];
    const csv = toCsv(header, tableRows.map((r) => [r.g, r.total, ...(multiSeries ? r.vals : [])]));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${title || "report"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadPng() {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = svg.width.baseVal.value * scale;
      canvas.height = svg.height.baseVal.value * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${title || "report"}.png`;
      a.click();
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  }

  const panel = (
    <aside className="card flex h-fit flex-col lg:sticky lg:top-20">
      <header className="flex items-center gap-2 border-b border-line px-5 py-4">
        <h2 className="flex-1 font-semibold">Insights</h2>
        <button type="button" onClick={discard} disabled={!dirty} className="btn text-ink-2 hover:bg-hover">Discard Changes</button>
        <button type="button" onClick={() => save()} disabled={pending || (!dirty && !!currentId)} className="btn-dark">{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setPanelOpen(false)} className="btn px-2 text-ink-2 hover:bg-hover lg:hidden" aria-label="Close"><X className="h-5 w-5" /></button>
      </header>
      <div className="space-y-4 p-5">
        <Field label="Report name">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
        </Field>
        <Field label="Data Source" icon={Database}>
          <Select
            ariaLabel="Data source"
            value={config.source}
            onChange={(v) => {
              const source = v as DataSource;
              const d = Object.keys(DIMENSIONS[source]);
              setConfig({ ...config, source, op: "count", measure: null, groupBy: d[0], segmentBy: null, segmentValues: null });
            }}
            options={DATA_SOURCES.map((s) => ({ value: s, label: SOURCE_NAMES[s] }))}
          />
        </Field>
        <Field label="Metric" icon={BarChart3}>
          <div className="flex gap-2">
            <Select
              ariaLabel="Metric"
              value={config.op}
              onChange={(v) => {
                const op = v as Op;
                set({ op, measure: op === "count" ? null : config.measure ?? Object.keys(measures)[0] ?? null });
              }}
              options={OPS.filter((o) => o === "count" || Object.keys(measures).length > 0).map((o) => ({ value: o, label: OP_NAMES[o] }))}
            />
            {config.op !== "count" && (
              <Select ariaLabel="Measure" value={config.measure ?? ""} onChange={(v) => set({ measure: v })} options={Object.entries(measures).map(([k, v]) => ({ value: k, label: v }))} />
            )}
          </div>
        </Field>
        <Field label="Grouped By" icon={Building2}>
          <div className="flex gap-2">
            <Select
              ariaLabel="Grouped by"
              value={config.groupBy ?? ""}
              onChange={(v) => set({ groupBy: v || null, segmentBy: config.segmentBy === v ? null : config.segmentBy })}
              options={[{ value: "", label: "No grouping" }, ...Object.entries(dims).map(([k, v]) => ({ value: k, label: v }))]}
            />
            {config.groupBy && <button type="button" onClick={() => set({ groupBy: null })} className="btn-ghost px-2" aria-label="Remove grouping"><X className="h-4 w-4" /></button>}
          </div>
          {config.groupBy && (
            <label className="mt-2 flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={config.includeEmpty} onChange={(e) => set({ includeEmpty: e.target.checked })} /> Include empty values
            </label>
          )}
        </Field>
        <Field label="Segmented By">
          <div className="flex gap-2">
            <Select
              ariaLabel="Segmented by"
              value={config.segmentBy ?? ""}
              onChange={(v) => set({ segmentBy: v || null, segmentValues: null })}
              options={[{ value: "", label: "No segmentation" }, ...Object.entries(dims).filter(([k]) => k !== config.groupBy).map(([k, v]) => ({ value: k, label: v }))]}
            />
            {config.segmentBy && <button type="button" onClick={() => set({ segmentBy: null, segmentValues: null })} className="btn-ghost px-2" aria-label="Remove segmentation"><X className="h-4 w-4" /></button>}
          </div>
          {config.segmentBy && result.allSegments.length > 0 && (
            <details className="mt-2 rounded-lg border border-line">
              <summary className="cursor-pointer px-3 py-2 text-sm text-ink-2">Include values: {config.segmentValues?.length ? `${config.segmentValues.length} selected` : "All"}</summary>
              <div className="max-h-48 space-y-1 overflow-y-auto border-t border-line-soft px-3 py-2">
                <button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => set({ segmentValues: null })}>Select all</button>
                {result.allSegments.map((v) => {
                  const on = !config.segmentValues?.length || config.segmentValues.includes(v);
                  return (
                    <label key={v} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={on} onChange={() => {
                        const cur = config.segmentValues?.length ? config.segmentValues : result.allSegments;
                        const next = on ? cur.filter((x) => x !== v) : [...cur, v];
                        set({ segmentValues: next.length === result.allSegments.length ? null : next });
                      }} /> {v}
                    </label>
                  );
                })}
              </div>
            </details>
          )}
        </Field>
        <Field label="Visualization">
          <Select ariaLabel="Visualization" value={config.chart} onChange={(v) => set({ chart: v as ReportConfig["chart"] })} options={CHARTS.map((c) => ({ value: c, label: CHART_NAMES[c] }))} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Share with the team (each person still only sees their own data)
        </label>
        {current && !current.mine && <p className="text-xs text-ink-3">Shared by {current.owner}. Saving creates your own copy.</p>}
        {current?.mine && (
          <div className="flex gap-2">
            <button type="button" onClick={() => save(true)} className="btn-ghost flex-1">Save as copy</button>
            <button type="button" onClick={remove} className="btn text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /> Delete</button>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          ariaLabel="Saved reports"
          className="w-auto min-w-52"
          menuWidth={280}
          value={currentId ?? ""}
          onChange={(v) => open(v || null)}
          options={[{ value: "", label: reports.length ? "Unsaved report" : "No saved reports yet" }, ...reports.map((r) => ({ value: r.id, label: r.mine ? r.title : `${r.title} · shared by ${r.owner}` }))]}
        />
        <button type="button" onClick={() => open(null)} className="btn-ghost"><Plus className="h-4 w-4" /> New report</button>
        {dirty && <span className="text-xs font-medium text-amber-700">Unsaved changes</span>}
        <button type="button" onClick={() => setPanelOpen(true)} className="btn-dark ml-auto lg:hidden">Configure</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{title || "Untitled report"}</h2>
                <p className="text-xs text-ink-3">{metricLabel} by {groupLabel.toLowerCase()} · {result.rowCount.toLocaleString("en-GB")} records{loading && " · updating…"}</p>
              </div>
              <button type="button" onClick={downloadPng} className="btn-ghost"><Download className="h-4 w-4" /> Download</button>
            </div>
            {multiSeries && config.chart !== "pie" && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {result.segments.map((s, i) => (
                  <button key={s} type="button" onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(s)) n.delete(s); else n.add(s); return n; })} className={`flex items-center gap-1.5 text-xs transition-opacity ${hidden.has(s) ? "opacity-40" : ""}`} aria-pressed={!hidden.has(s)}>
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} /> {s}
                  </button>
                ))}
              </div>
            )}
            <div className={`mt-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
              {config.chart === "table" ? <p className="py-6 text-center text-sm text-ink-3">Table view: see the results below.</p> : <ReportChart result={result} chart={config.chart} hidden={hidden} svgRef={svgRef} />}
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h3 className="text-sm font-semibold">Results</h3>
              <button type="button" onClick={downloadCsv} className="btn-ghost py-1.5"><FileSpreadsheet className="h-4 w-4" /> Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[13px] text-ink-2">
                    <th className="border-r border-line-soft px-4 py-2.5 font-medium">{groupLabel}</th>
                    {[config.op === "count" ? "Sum" : metricLabel, ...(multiSeries ? visibleSegs : [])].map((h, k) => {
                      const col = k === 0 ? 0 : result.segments.indexOf(h) + 1;
                      return (
                        <th key={h} className="border-r border-line-soft px-3 py-2.5 text-right font-medium last:border-0">
                          <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSortCol((s) => ({ col, dir: s.col === col && s.dir === -1 ? 1 : -1 }))}>
                            {h}{sortCol.col === col && (sortCol.dir === -1 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr key={r.g} className="border-b border-line-soft last:border-0 hover:bg-hover">
                      <td className="border-r border-line-soft px-4 py-2">{r.g}</td>
                      <td className="border-r border-line-soft px-3 py-2 text-right font-semibold tabular-nums">{fmtNum(r.total)}</td>
                      {multiSeries && visibleSegs.map((s) => <td key={s} className="border-r border-line-soft px-3 py-2 text-right tabular-nums last:border-0">{fmtNum(r.vals[result.segments.indexOf(s)])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {tableRows.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-3">No results.</p>}
            </div>
          </section>
        </div>

        <div className="hidden lg:block">{panel}</div>
      </div>

      {panelOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/30 p-3 lg:hidden" onClick={() => setPanelOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}>{panel}</div>
        </div>
      )}
    </div>
  );
}
