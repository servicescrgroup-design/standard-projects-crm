import Link from "next/link";
import { ACTIVITY_LABELS, OUTCOME_LABELS, type ActivityType, type Outcome } from "@/lib/domain";

export type FeedItem = {
  id: string;
  type: string;
  outcome: string | null;
  summary: string | null;
  subject?: string | null;
  webLink?: string | null;
  source: string;
  occurredAt: Date;
  lead: { id: string; company: string };
  user: { name: string } | null;
};

const SOURCE: Record<string, string> = { GMAIL: "Gmail", OUTLOOK: "Outlook", CALENDAR: "Calendar", WEBSITE: "Website", QUOTE: "Quote form", BOT: "Bot" };

/** Shared list of logged activities (notes, emails, meetings), each linking to its lead. */
export function ActivityFeed({ items, empty }: { items: FeedItem[]; empty: string }) {
  if (items.length === 0) return <div className="card px-5 py-10 text-center text-sm text-ink-3">{empty}</div>;
  return (
    <ul className="card divide-y divide-line-soft">
      {items.map((a) => (
        <li key={a.id} className="flex gap-4 px-5 py-3.5 transition-colors hover:bg-hover">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link href={`/leads/${a.lead.id}`} className="font-semibold hover:text-brand-700">{a.lead.company}</Link>
              <span className="chip">{ACTIVITY_LABELS[a.type as ActivityType] ?? a.type}</span>
              {a.outcome && <span className="chip">{OUTCOME_LABELS[a.outcome as Outcome] ?? a.outcome}</span>}
              {SOURCE[a.source] && <span className="chip bg-brand-50 text-brand-700">Auto · {SOURCE[a.source]}</span>}
            </div>
            {a.subject && <p className="mt-1 text-sm font-medium">{a.subject}</p>}
            {a.summary && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-ink-2">{a.summary}</p>}
            {a.webLink && (
              <a href={a.webLink} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand-700 hover:underline">
                Open in {a.source === "OUTLOOK" ? "Outlook" : "Gmail"}
              </a>
            )}
          </div>
          <div className="shrink-0 text-right text-xs text-ink-3">
            <div>{a.occurredAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
            <div>{a.user?.name ?? "automatic"}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
