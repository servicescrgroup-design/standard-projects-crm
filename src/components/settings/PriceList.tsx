"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deletePriceItem, savePriceItem, type ActionResult } from "@/app/outreachActions";
import { formatMoney } from "@/lib/domain";
import { toast } from "@/components/ui/Toaster";

type Item = { id: string; name: string; description: string | null; price: number; monthly: boolean };

/** Owner: packages and add-ons the quote builder picks from. */
export function PriceList({ items }: { items: Item[] }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(savePriceItem, {});
  const [editing, setEditing] = useState<Item | null>(null);
  const [busy, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.error) toast(state.error, "error");
    if (state.ok) {
      toast(state.message ?? "Saved", "ok");
      form.current?.reset();
      setEditing(null);
    }
  }, [state]);

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line-soft rounded-xl border border-line">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{i.name}</p>
              {i.description && <p className="truncate text-xs text-ink-3">{i.description}</p>}
            </div>
            <span className={`tabular-nums ${i.price ? "" : "text-amber-700"}`}>{i.price ? `${formatMoney(i.price)}${i.monthly ? "/mo" : ""}` : "No price"}</span>
            <button type="button" aria-label={`Edit ${i.name}`} className="btn px-1.5 hover:bg-hover" onClick={() => setEditing(i)}><Pencil className="h-4 w-4" /></button>
            <button type="button" aria-label={`Remove ${i.name}`} className="btn px-1.5 text-rose-600 hover:bg-rose-50" disabled={busy} onClick={() => confirm(`Remove ${i.name} from the price list?`) && start(async () => { const r = await deletePriceItem(i.id); toast(r.error ?? r.message ?? "Removed", r.error ? "error" : "ok"); })}><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
        {items.length === 0 && <li className="px-3 py-4 text-sm text-ink-3">No items yet. Add your packages (e.g. Starter / Business / Growth website), add-ons and monthly care plans.</li>}
      </ul>
      <form ref={form} key={editing?.id ?? "new"} action={action} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1fr_140px_auto_auto] sm:items-end">
        <input type="hidden" name="id" value={editing?.id ?? ""} />
        <label><span className="label">{editing ? "Edit item" : "Add an item"}</span><input name="name" required className="input" defaultValue={editing?.name} placeholder="e.g. Business website" /></label>
        <label><span className="label">Description</span><input name="description" className="input" defaultValue={editing?.description ?? ""} placeholder="What's included" /></label>
        <label><span className="label">Price (฿)</span><input name="price" inputMode="decimal" className="input" defaultValue={editing?.price ? String(editing.price / 100) : ""} placeholder="0" /></label>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="monthly" defaultChecked={editing?.monthly} className="h-4 w-4 accent-brand-600" /> Monthly</label>
        <div className="flex gap-2">
          <button className="btn-primary" disabled={pending}>{editing ? "Save" : "Add"}</button>
          {editing && <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>}
        </div>
      </form>
    </div>
  );
}
