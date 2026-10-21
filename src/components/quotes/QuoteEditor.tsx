"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Eye, Mail, Plus, Save, Trash2, XCircle } from "lucide-react";
import { deleteQuoteAction, saveQuoteAction, sendQuoteAction } from "@/app/outreachActions";
import { formatMoney } from "@/lib/domain";
import { QUOTE_STATUS_LABELS, quoteTotals, type QuoteItem } from "@/lib/quotes";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toaster";

type Price = { id: string; name: string; description: string | null; price: number; monthly: boolean };
type QuoteView = {
  id: string; number: string; status: string; title: string; items: QuoteItem[]; discount: number; notes: string; validUntil: string; token: string;
  company: string; contactName: string | null; leadEmail: string | null; sentAt: string | null; viewedAt: string | null; viewCount: number;
  acceptedAt: string | null; acceptedName: string | null; declinedAt: string | null; declineReason: string | null;
};

const baht = (minor: number) => (minor ? String(minor / 100) : "");
const toMinor = (v: string) => Math.max(0, Math.round((Number(v.replace(/[^\d.]/g, "")) || 0) * 100));
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

/** Build a quote from the price list or custom lines, then share the link or email it. */
export function QuoteEditor({ quote, prices, canSendDirect, isOwner, publicLink }: { quote: QuoteView; prices: Price[]; canSendDirect: boolean; isOwner: boolean; publicLink: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(quote.title);
  const [items, setItems] = useState<QuoteItem[]>(quote.items);
  const [discount, setDiscount] = useState(baht(quote.discount));
  const [notes, setNotes] = useState(quote.notes);
  const [validUntil, setValidUntil] = useState(quote.validUntil);
  const [message, setMessage] = useState(`Hi ${quote.contactName ?? "there"},\n\nThank you for your time. Here is your quote from Standard Projects:`);
  const [pick, setPick] = useState("");
  const [pending, start] = useTransition();
  const locked = quote.status === "ACCEPTED";
  const totals = useMemo(() => quoteTotals(items, toMinor(discount)), [items, discount]);
  const link = publicLink;

  const payload = () => ({ title, items, discount: toMinor(discount), notes, validUntil });
  const save = (then?: () => void) =>
    start(async () => {
      const r = await saveQuoteAction(quote.id, payload());
      if (r.error) return toast(r.error, "error");
      if (then) then();
      else toast(r.message ?? "Saved", "ok");
      router.refresh();
    });
  const send = (email: boolean) =>
    start(async () => {
      const saved = await saveQuoteAction(quote.id, payload());
      if (saved.error) return toast(saved.error, "error");
      const r = await sendQuoteAction(quote.id, { email, message });
      if (r.error) return toast(r.error, "error");
      if (!email && r.link) await navigator.clipboard.writeText(r.link).catch(() => null);
      toast(r.message ?? "Sent", "ok");
      router.refresh();
    });
  const update = (i: number, patch: Partial<QuoteItem>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addFromList = (id: string) => {
    const p = prices.find((x) => x.id === id);
    if (p) setItems([...items, { name: p.name, description: p.description ?? undefined, qty: 1, unitPrice: p.price, monthly: p.monthly }]);
    setPick("");
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-3">Quote {quote.number} · {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}</p>
            <h1 className="text-xl font-semibold">{quote.company}</h1>
          </div>
          <a href={`/q/${quote.token}?preview=1`} target="_blank" rel="noreferrer" className="btn-ghost"><Eye className="h-4 w-4" /> Preview what they see</a>
        </div>

        <label className="block"><span className="label">Title</span><input className="input" value={title} disabled={locked} onChange={(e) => setTitle(e.target.value)} /></label>

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-canvas text-left text-xs text-ink-2">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="w-20 px-2 py-2 font-medium">Qty</th>
                <th className="w-32 px-2 py-2 font-medium">Price (฿)</th>
                <th className="w-28 px-2 py-2 font-medium">Billing</th>
                <th className="w-28 px-2 py-2 text-right font-medium">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-line-soft align-top">
                  <td className="px-3 py-2">
                    <input className="input" value={it.name} disabled={locked} onChange={(e) => update(i, { name: e.target.value })} aria-label="Item name" />
                    <input className="input mt-1 text-xs" value={it.description ?? ""} disabled={locked} onChange={(e) => update(i, { description: e.target.value })} placeholder="Description (optional)" aria-label="Item description" />
                  </td>
                  <td className="px-2 py-2"><input className="input" type="number" min={1} value={it.qty} disabled={locked} onChange={(e) => update(i, { qty: Math.max(1, Number(e.target.value) || 1) })} aria-label="Quantity" /></td>
                  <td className="px-2 py-2"><input className={`input ${it.unitPrice === 0 ? "border-amber-400" : ""}`} inputMode="decimal" value={baht(it.unitPrice)} disabled={locked} onChange={(e) => update(i, { unitPrice: toMinor(e.target.value) })} placeholder="0" aria-label="Unit price" /></td>
                  <td className="px-2 py-2">
                    <Select ariaLabel="Billing" disabled={locked} value={it.monthly ? "m" : "o"} onChange={(v) => update(i, { monthly: v === "m" })} options={[{ value: "o", label: "One-off" }, { value: "m", label: "Monthly" }]} />
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{formatMoney(it.qty * it.unitPrice)}{it.monthly ? "/mo" : ""}</td>
                  <td className="px-1 py-2">{!locked && <button type="button" aria-label="Remove line" className="btn px-1.5 text-rose-600 hover:bg-rose-50" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-3">Add items from your price list or a custom line.</td></tr>}
            </tbody>
          </table>
        </div>

        {!locked && (
          <div className="flex flex-wrap items-center gap-2">
            {prices.length > 0 ? (
              <div className="min-w-64"><Select ariaLabel="Add from price list" value={pick} placeholder="Add from price list…" onChange={addFromList} options={prices.map((p) => ({ value: p.id, label: p.name, hint: p.price ? `${formatMoney(p.price)}${p.monthly ? "/mo" : ""}` : "no price" }))} /></div>
            ) : (
              <p className="text-sm text-ink-3">{isOwner ? <>Your price list is empty. <a href="/settings#prices" className="text-brand-700 underline">Add your packages and prices</a> to quote faster.</> : "Ask the owner to fill in the price list in Settings."}</p>
            )}
            <button type="button" className="btn-ghost" onClick={() => setItems([...items, { name: "", qty: 1, unitPrice: 0, monthly: false }])}><Plus className="h-4 w-4" /> Custom line</button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">Discount on one-off total (฿)</span><input className="input" inputMode="decimal" value={discount} disabled={locked} onChange={(e) => setDiscount(e.target.value)} placeholder="0" /></label>
          <label><span className="label">Valid until</span><input className="input" type="date" value={validUntil} disabled={locked} onChange={(e) => setValidUntil(e.target.value)} /></label>
        </div>
        <label className="block"><span className="label">Notes and terms shown on the quote</span><textarea className="input min-h-28" value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 50% deposit to start, 50% on launch. Includes 2 rounds of changes." /></label>

        {!locked && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" disabled={pending} onClick={() => save()}><Save className="h-4 w-4" /> Save</button>
            {quote.status === "DRAFT" && (
              <button type="button" className="btn text-rose-600 hover:bg-rose-50" disabled={pending} onClick={() => confirm("Delete this draft?") && start(async () => { const r = await deleteQuoteAction(quote.id); toast(r.error ?? r.message ?? "Deleted", r.error ? "error" : "ok"); if (!r.error) router.back(); })}>
                <Trash2 className="h-4 w-4" /> Delete draft
              </button>
            )}
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <section className="card space-y-2 p-5">
          <h2 className="font-semibold">Total</h2>
          <div className="flex justify-between text-sm"><span className="text-ink-2">One-off</span><span className="tabular-nums">{formatMoney(totals.oneOffGross)}</span></div>
          {totals.discount > 0 && <div className="flex justify-between text-sm"><span className="text-ink-2">Discount</span><span className="tabular-nums text-emerald-700">−{formatMoney(totals.discount)}</span></div>}
          <div className="flex justify-between border-t border-line-soft pt-2 font-semibold"><span>To pay up front</span><span className="tabular-nums">{formatMoney(totals.oneOff)}</span></div>
          {totals.monthly > 0 && <div className="flex justify-between text-sm"><span className="text-ink-2">Then monthly</span><span className="tabular-nums">{formatMoney(totals.monthly)}/mo</span></div>}
          <p className="text-xs text-ink-3">First-year value {formatMoney(totals.firstYear)} (shown on the deal).</p>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Send</h2>
          {quote.status === "ACCEPTED" ? (
            <p className="flex items-start gap-2 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Accepted by {quote.acceptedName} on {when(quote.acceptedAt)}. The deal is marked Won.</p>
          ) : (
            <>
              {quote.status === "DECLINED" && <p className="flex items-start gap-2 text-sm text-rose-700"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /> Declined {when(quote.declinedAt)}{quote.declineReason ? `: “${quote.declineReason}”` : ""}</p>}
              <label className="block"><span className="label">Message</span><textarea className="input min-h-24 text-sm" value={message} onChange={(e) => setMessage(e.target.value)} /></label>
              <button type="button" className="btn-primary w-full" disabled={pending || !quote.leadEmail} title={quote.leadEmail ? undefined : "This lead has no email address"} onClick={() => send(true)}>
                <Mail className="h-4 w-4" /> {canSendDirect ? "Email quote to customer" : "Email quote (for approval)"}
              </button>
              <button type="button" className="btn-ghost w-full" disabled={pending} onClick={() => send(false)}><Copy className="h-4 w-4" /> Mark as sent &amp; copy link</button>
              <p className="text-xs text-ink-3">Sending logs a Proposal on the lead (stage → Proposal sent, follow-ups on day 2, 5 and 10) and sets the deal value. Copy the link to send it on LINE or WhatsApp.</p>
            </>
          )}
        </section>

        <section className="card space-y-1 p-5 text-sm">
          <h2 className="mb-1 font-semibold">History</h2>
          <p className="text-ink-2">Sent: {quote.sentAt ? when(quote.sentAt) : "not yet"}</p>
          <p className="text-ink-2">Opened: {quote.viewCount > 0 ? `${quote.viewCount}× (first ${when(quote.viewedAt)})` : "not yet"}</p>
          {quote.status !== "DRAFT" && (
            <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline" onClick={() => navigator.clipboard.writeText(link).then(() => toast("Link copied", "ok"))}>
              <Copy className="h-3 w-3" /> Copy customer link
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}
