import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/server/session";
import { quoteByToken } from "@/lib/server/quotes";
import { formatMoney } from "@/lib/domain";
import { isExpired, quoteTotals, sanitizeItems } from "@/lib/quotes";
import { QuoteAnswer } from "./QuoteAnswer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your quote · Standard Projects", robots: { index: false, follow: false } };

const day = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

/** The customer's quote: a private link they can view, print, accept or decline. No sign-in. */
export default async function PublicQuote({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { token } = await params;
  const { preview } = await searchParams;
  const q = await quoteByToken(token);
  if (!q) notFound();
  // Team members previewing don't count as the customer opening it.
  const internal = preview === "1" && !!(await getCurrentUser());
  if (q.status === "DRAFT" && !internal) notFound();

  const items = sanitizeItems(q.items);
  const t = quoteTotals(items, q.discount);
  const expired = q.status !== "ACCEPTED" && q.status !== "DECLINED" && isExpired(q.validUntil);

  return (
    <main className="min-h-screen bg-[#f4f6f8] px-4 py-8 print:bg-white print:p-0">
      {internal && <p className="mx-auto mb-3 max-w-3xl rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 print:hidden">Preview: this is what the customer sees. Your visit isn&rsquo;t counted as them opening it.</p>}
      <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-sm print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 bg-[#0b2a3a] px-8 py-7 text-white">
          <div>
            <p className="text-lg font-semibold tracking-tight">Standard Projects</p>
            <p className="text-sm text-white/70">Websites, systems &amp; automation · Chiang Mai</p>
            <p className="text-sm text-white/70">standardprojects.org</p>
          </div>
          <div className="text-right">
            <p className="text-sm uppercase tracking-widest text-white/60">Quote</p>
            <p className="text-xl font-semibold">{q.number}</p>
            <p className="text-sm text-white/70">{day(q.sentAt ?? q.createdAt)}</p>
          </div>
        </header>

        <div className="space-y-6 px-8 py-7">
          <div className="flex flex-wrap justify-between gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#667085]">Prepared for</p>
              <p className="font-semibold">{q.lead.company}</p>
              {q.lead.contactName && <p className="text-[#475467]">{q.lead.contactName}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-[#667085]">Valid until</p>
              <p className={`font-semibold ${expired ? "text-rose-600" : ""}`}>{q.validUntil ? day(q.validUntil) : "—"}{expired ? " (expired)" : ""}</p>
              {q.lead.owner && <p className="text-[#475467]">Your contact: {q.lead.owner.name}</p>}
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-[#101828]">{q.title}</h1>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#101828] text-left text-xs uppercase tracking-wide text-[#667085]">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Price</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-[#eaecf0] align-top">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-[#101828]">{it.name}</p>
                    {it.description && <p className="text-[#667085]">{it.description}</p>}
                  </td>
                  <td className="py-3 text-right tabular-nums">{it.qty}</td>
                  <td className="py-3 text-right tabular-nums">{formatMoney(it.unitPrice)}{it.monthly ? "/mo" : ""}</td>
                  <td className="py-3 text-right font-medium tabular-nums">{formatMoney(it.qty * it.unitPrice)}{it.monthly ? "/mo" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
            {t.discount > 0 && (
              <>
                <div className="flex justify-between"><span className="text-[#667085]">Subtotal</span><span className="tabular-nums">{formatMoney(t.oneOffGross)}</span></div>
                <div className="flex justify-between"><span className="text-[#667085]">Discount</span><span className="tabular-nums text-emerald-700">−{formatMoney(t.discount)}</span></div>
              </>
            )}
            <div className="flex justify-between border-t-2 border-[#101828] pt-2 text-base font-semibold"><span>Total</span><span className="tabular-nums">{formatMoney(t.oneOff)}</span></div>
            {t.monthly > 0 && <div className="flex justify-between text-[#475467]"><span>Then monthly</span><span className="tabular-nums">{formatMoney(t.monthly)}/month</span></div>}
            <p className="text-xs text-[#98a2b3]">Prices in Thai baht.</p>
          </div>

          {q.notes && (
            <div className="rounded-xl bg-[#f9fafb] p-4 text-sm">
              <p className="mb-1 text-xs uppercase tracking-wide text-[#667085]">Notes &amp; terms</p>
              <p className="whitespace-pre-line text-[#344054]">{q.notes}</p>
            </div>
          )}

          <QuoteAnswer
            token={token}
            status={q.status}
            expired={expired}
            preview={internal}
            acceptedName={q.acceptedName}
            acceptedAt={q.acceptedAt ? day(q.acceptedAt) : null}
            contactEmail={q.lead.owner?.email ?? null}
          />
        </div>
      </article>
    </main>
  );
}
