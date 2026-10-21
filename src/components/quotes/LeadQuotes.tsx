import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { createQuoteAction } from "@/app/outreachActions";
import { formatMoney } from "@/lib/domain";
import { QUOTE_STATUS_LABELS, isExpired, quoteTotals, sanitizeItems } from "@/lib/quotes";

type Q = { id: string; number: string; status: string; items: unknown; discount: number; viewCount: number; viewedAt: Date | null; sentAt: Date | null; validUntil: Date | null; createdAt: Date };

const TONE: Record<string, string> = {
  DRAFT: "bg-line-soft text-ink-2",
  SENT: "bg-brand-50 text-brand-700",
  VIEWED: "bg-amber-50 text-amber-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  DECLINED: "bg-rose-50 text-rose-700",
};

/** Quotes on a lead: status, value, whether the customer opened it, and a New quote button. */
export function LeadQuotes({ leadId, quotes }: { leadId: string; quotes: Q[] }) {
  const day = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");
  return (
    <section id="quotes" className="card scroll-mt-24">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-brand-600" /> Quotes</h2>
        <form action={createQuoteAction.bind(null, leadId)}>
          <button className="btn-ghost py-1.5"><Plus className="h-4 w-4" /> New quote</button>
        </form>
      </div>
      <ul className="divide-y divide-line-soft">
        {quotes.map((q) => {
          const t = quoteTotals(sanitizeItems(q.items), q.discount);
          const expired = q.status !== "ACCEPTED" && q.status !== "DECLINED" && isExpired(q.validUntil);
          return (
            <li key={q.id}>
              <Link href={`/quotes/${q.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-hover">
                <span className="font-medium">{q.number}</span>
                <span className={`pill ${TONE[q.status] ?? ""}`}>{expired ? "Expired" : QUOTE_STATUS_LABELS[q.status] ?? q.status}</span>
                <span className="tabular-nums">{formatMoney(t.oneOff)}{t.monthly ? ` + ${formatMoney(t.monthly)}/mo` : ""}</span>
                <span className="ml-auto text-xs text-ink-3">
                  {q.viewCount > 0 ? `Opened ${q.viewCount}× · last ${day(q.viewedAt)}` : q.sentAt ? `Sent ${day(q.sentAt)} · not opened yet` : `Created ${day(q.createdAt)}`}
                </span>
              </Link>
            </li>
          );
        })}
        {quotes.length === 0 && <li className="px-4 py-4 text-sm text-ink-3">No quotes yet. Create one from your price list; the customer gets a link to view and accept it.</li>}
      </ul>
    </section>
  );
}
