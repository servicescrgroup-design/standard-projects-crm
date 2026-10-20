import Link from "next/link";

const TOPICS = [
  { t: "Start your day on Today", d: "Your follow-ups, most important first: replies waiting on you, then priority A, deal size and how overdue.", href: "/today" },
  { t: "Log anything in a few taps", d: "Quick log works on your phone: pick the lead, what happened, the outcome and when to follow up. Stages update themselves.", href: "/log" },
  { t: "Move deals on the board", d: "Drag a card between stages on Deals. Won, Maintenance and Lost clear the follow-up date.", href: "/deals" },
  { t: "Find and hand out companies", d: "Companies: search, filter, sort and assign selected leads to a teammate.", href: "/companies" },
  { t: "Ask AI", d: "Questions about your leads and activity. It only sees what you're allowed to see.", href: "/dashboard" },
  { t: "Export", d: "The Exports button downloads leads (with your current filters) or activity as CSV.", href: "/companies" },
];

export default function HelpPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">Quick guides to the CRM. Forgot your password? Ask the owner for a reset link (Settings → Reset link).</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((x) => (
          <Link key={x.t} href={x.href} className="card p-5 transition-shadow hover:shadow-[0_4px_12px_rgba(16,24,40,.08)]">
            <h2 className="text-sm font-semibold">{x.t}</h2>
            <p className="mt-1 text-sm text-ink-2">{x.d}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
