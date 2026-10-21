"use client";

import { Select } from "@/components/ui/Select";
import { useActionState, useEffect, useState } from "react";
import { ChevronDown, History, SlidersHorizontal, TrendingDown, X } from "lucide-react";
import { saveSpend } from "@/app/actions";
import { toast } from "@/components/ui/Toaster";
import { SOURCES, SOURCE_LABELS, type Source } from "@/lib/domain";
import type { ChannelCAC } from "@/lib/acquisition";

const baht = (minor: number) => `฿${Math.round(minor / 100).toLocaleString("en-GB")}`;
const COLORS = ["#147cab", "#34b0ee", "#06486b", "#f79009", "#12b76a", "#7a5af8", "#98a2b3", "#f97066"];

export type SpendEntry = { source: string; month: string; amount: number };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div role="dialog" aria-label={title} className="w-full max-w-lg rounded-2xl border border-line bg-white shadow-[var(--shadow-menu)]" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="btn px-2 text-ink-2 hover:bg-hover" aria-label="Close"><X className="h-5 w-5" /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

/** Cost per new customer by lead source over the last 3 months, from recorded spend and won deals. */
export function AcquisitionWidget({ average, channels, months, hasSpend, newCustomers, history, isOwner }: { average: number | null; channels: ChannelCAC[]; months: string[]; hasSpend: boolean; newCustomers: number; history: SpendEntry[]; isOwner: boolean }) {
  const [open, setOpen] = useState(true);
  const [modal, setModal] = useState<"history" | "spend" | null>(null);
  const [state, action] = useActionState(saveSpend, {});
  useEffect(() => {
    if (state.message) toast(state.message);
    if (state.error) toast(state.error, "error");
  }, [state]);

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-2 text-left" aria-label={open ? "Collapse" : "Expand"}>
          <ChevronDown className={`h-4 w-4 text-ink-3 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
          <span className="text-sm font-semibold">Cust. Acquisition Cost</span>
        </button>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold tracking-tight">{average === null ? "—" : baht(average)}</span>
          <span className="text-xs text-ink-3">{average === null ? (hasSpend ? "no customers won from paid sources yet" : "add spend to calculate") : "average"}</span>
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setModal("history")} className="btn-ghost"><History className="h-4 w-4" /> History</button>
          {isOwner && <button type="button" onClick={() => setModal("spend")} className="btn-dark"><SlidersHorizontal className="h-4 w-4" /> Adjust Spend</button>}
        </div>
      </div>
      {open && (
        <div className="border-t border-line-soft">
          {channels.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-3">No customers won in the last 3 months yet. Cost per customer appears once deals are won.</p>
          ) : (
            <div className="grid divide-y divide-line-soft sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
              {channels.slice(0, 8).map((c, i) => (
                <div key={c.source} className="relative px-5 py-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {SOURCE_LABELS[c.source as Source] ?? c.source}
                    {c.mostEffective && <span className="rounded-md bg-[#d5f5e8] px-1.5 py-0.5 text-[11px] font-semibold text-[#146c4b]">Most Effective</span>}
                  </div>
                  <div className="mt-1 text-xs text-ink-3">
                    Brought {c.share}% of new customers ({c.customers})
                  </div>
                  <div className="mt-2 text-lg font-semibold tabular-nums">{c.cac !== null && c.spend > 0 ? baht(c.cac) : c.spend > 0 ? `${baht(c.spend)} spent` : "No spend"}</div>
                  <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                </div>
              ))}
            </div>
          )}
          <p className="flex items-center gap-1.5 border-t border-line-soft px-5 py-2 text-[11px] text-ink-3">
            <TrendingDown className="h-3 w-3" /> {months[0]} to {months[months.length - 1]} · {newCustomers} new customers · cost = spend ÷ customers won from that source
          </p>
        </div>
      )}

      {modal === "history" && (
        <Modal title="Spend history" onClose={() => setModal(null)}>
          <div className="max-h-96 overflow-y-auto px-5 py-3">
            {history.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-3">No spend recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-ink-2"><th className="py-2 font-medium">Month</th><th className="font-medium">Source</th><th className="text-right font-medium">Spend</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={`${h.source}-${h.month}`} className="border-t border-line-soft"><td className="py-2">{h.month}</td><td>{SOURCE_LABELS[h.source as Source] ?? h.source}</td><td className="text-right tabular-nums">{baht(h.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      )}
      {modal === "spend" && isOwner && (
        <Modal title="Adjust spend" onClose={() => setModal(null)}>
          <form action={action} className="grid gap-3 p-5 sm:grid-cols-3">
            <div><span className="label">Source</span><Select name="source" ariaLabel="Source" defaultValue="FACEBOOK" options={SOURCES.filter((s) => s !== "MANUAL").map((s) => ({ value: s, label: SOURCE_LABELS[s] }))} /></div>
            <label><span className="label">Month</span><input name="month" type="month" required defaultValue={months[months.length - 1]} className="input" /></label>
            <label><span className="label">Spend (฿)</span><input name="amount" inputMode="decimal" placeholder="0 removes it" className="input" /></label>
            <p className="text-xs text-ink-3 sm:col-span-3">One total per source per month; saving again replaces it.</p>
            <div className="flex justify-end gap-2 sm:col-span-3">
              <button type="button" onClick={() => setModal(null)} className="btn-ghost">Close</button>
              <button className="btn-dark">Save spend</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
