import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/server/session";
import { demoByToken } from "@/lib/server/demos";
import { formatMoney } from "@/lib/domain";
import { quoteTotals, sanitizeItems } from "@/lib/quotes";
import { DemoFrame, GoAhead } from "./DemoClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your demo website · Standard Projects", robots: { index: false, follow: false } };

/** What the client gets: the demo of their new website, the offer, and "I'd like to go ahead". No sign-in. */
export default async function PublicDemo({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { token } = await params;
  const { preview } = await searchParams;
  const d = await demoByToken(token);
  if (!d) notFound();
  const internal = preview === "1" && !!(await getCurrentUser());
  const first = (d.lead.contactName ?? "").split(/\s+/)[0];
  const items = d.quote ? sanitizeItems(d.quote.items) : [];
  const t = d.quote ? quoteTotals(items, d.quote.discount) : null;

  return (
    <main className="min-h-screen bg-[#f4f6f8] px-4 py-8">
      {internal && <p className="mx-auto mb-3 max-w-5xl rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">Preview: this is what the client sees. Your visit isn&rsquo;t counted.</p>}
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl bg-[#0b2a3a] px-6 py-7 text-white sm:px-8">
          <p className="text-sm font-semibold tracking-tight text-[#cdf464]">Standard Projects</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{first ? `Hi ${first}, here` : "Here"}&rsquo;s a first look at a new website for {d.lead.company}</h1>
          <p className="mt-2 max-w-2xl text-white/75">We built this demo before you&rsquo;ve paid anything, so you can see exactly what you&rsquo;d get. Everything can still be changed: text, photos, colours and pages.</p>
        </header>

        <DemoFrame url={d.demoUrl!} />

        <div className={`grid gap-6 ${d.quote ? "lg:grid-cols-2" : ""}`}>
          {d.quote && t && (
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-widest text-slate-500">Our offer</p>
              <h2 className="mt-1 text-xl font-semibold">{d.quote.title}</h2>
              <ul className="mt-4 divide-y divide-slate-100 text-sm">
                {items.map((i, n) => (
                  <li key={n} className="flex justify-between gap-4 py-2">
                    <span>{i.qty > 1 ? `${i.qty} × ` : ""}{i.name}</span>
                    <span className="shrink-0 font-medium">{formatMoney(i.unitPrice * i.qty)}{i.monthly ? "/month" : ""}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-slate-200 pt-3 text-right">
                <p className="text-2xl font-bold">{formatMoney(t.oneOff)}</p>
                {t.monthly > 0 && <p className="text-sm text-slate-600">+ {formatMoney(t.monthly)} per month</p>}
              </div>
              <a href={`/q/${d.quote.token}`} className="mt-4 inline-flex w-full justify-center rounded-xl border border-[#0b2a3a] px-4 py-2.5 text-sm font-semibold text-[#0b2a3a] hover:bg-slate-50">See the full offer and accept it online</a>
            </section>
          )}
          <section className="space-y-4">
            <GoAhead token={token} done={!!d.interestedAt} record={!internal} />
            {d.lead.owner && (
              <p className="text-center text-sm text-slate-600">
                Questions? {d.lead.owner.name} · <a className="underline" href={`mailto:${d.lead.owner.email}`}>{d.lead.owner.email}</a>
              </p>
            )}
          </section>
        </div>
        <p className="text-center text-xs text-slate-400">Standard Projects · standardprojects.org</p>
      </div>
    </main>
  );
}
