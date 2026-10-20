"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, LayoutGrid, X } from "lucide-react";
import { saveDashboardLayout } from "@/app/actions";
import { DEFAULT_LAYOUT, WIDGET_LABELS, type DashboardLayout, type WidgetId } from "@/lib/analytics";

/** Show/hide and reorder dashboard widgets; saved per user. */
export function CustomizeWidgets({ layout }: { layout: DashboardLayout }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(layout);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const move = (id: WidgetId, dir: -1 | 1) =>
    setDraft((d) => {
      const order = [...d.order];
      const i = order.indexOf(id);
      const j = i + dir;
      if (j < 0 || j >= order.length) return d;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...d, order };
    });
  const toggle = (id: WidgetId) =>
    setDraft((d) => ({ ...d, hidden: d.hidden.includes(id) ? d.hidden.filter((h) => h !== id) : [...d.hidden, id] }));

  const save = (l: DashboardLayout) =>
    start(async () => {
      const res = await saveDashboardLayout(l);
      if (res.error) setError(res.error);
      else setOpen(false);
    });

  return (
    <>
      <button type="button" onClick={() => (setDraft(layout), setError(""), setOpen(true))} className="btn-ghost">
        <LayoutGrid className="h-4 w-4" /> Customize Widget
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="Customize dashboard" className="w-full max-w-md rounded-2xl border border-line bg-white shadow-[var(--shadow-menu)]" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-semibold">Customize dashboard</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn px-2 text-ink-2 hover:bg-hover" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </header>
            <ul className="divide-y divide-line-soft px-5">
              {draft.order.map((id, i) => (
                <li key={id} className="flex items-center gap-3 py-2.5">
                  <label className="flex flex-1 items-center gap-2.5 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!draft.hidden.includes(id)} onChange={() => toggle(id)} />
                    {WIDGET_LABELS[id]}
                  </label>
                  <button type="button" onClick={() => move(id, -1)} disabled={i === 0} className="btn px-1.5 py-1 text-ink-2 hover:bg-hover" aria-label={`Move ${WIDGET_LABELS[id]} up`}>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => move(id, 1)} disabled={i === draft.order.length - 1} className="btn px-1.5 py-1 text-ink-2 hover:bg-hover" aria-label={`Move ${WIDGET_LABELS[id]} down`}>
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            {error && <p className="px-5 text-sm text-rose-600">{error}</p>}
            <footer className="flex items-center justify-between gap-2 border-t border-line px-5 py-4">
              <button type="button" onClick={() => save(DEFAULT_LAYOUT)} disabled={pending} className="btn text-ink-2 hover:bg-hover">
                Reset to default
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
                <button type="button" onClick={() => save(draft)} disabled={pending} className="btn-primary">
                  {pending ? "Saving…" : "Save layout"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
