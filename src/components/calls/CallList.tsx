"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, ExternalLink, Phone, PhoneCall, SkipForward } from "lucide-react";
import { logCallOutcome } from "@/app/callActions";
import { CALL_OUTCOMES, type CallOutcomeId } from "@/lib/callList";
import { LeadComms } from "@/components/voice/LeadComms";
import { toast } from "@/components/ui/Toaster";

export type CallLead = {
  id: string; company: string; contactName: string | null; phone: string; e164: string | null; country: string | null; industry: string | null;
  priority: string | null; whyFit: string | null; notes: string | null; website: string | null; stage: string; openNow: boolean; localTime: string;
  due: boolean; last: { type: string; outcome: string | null; summary: string | null; at: string } | null;
};

const TONE: Record<CallOutcomeId, string> = {
  no_answer: "bg-white hover:bg-hover",
  voicemail: "bg-white hover:bg-hover",
  callback: "bg-white hover:bg-hover",
  interested: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  meeting: "bg-emerald-600 text-white hover:bg-emerald-700",
  not_interested: "bg-rose-50 text-rose-700 hover:bg-rose-100",
  wrong_number: "bg-white text-ink-2 hover:bg-hover",
};

function tomorrowAt10(): string {
  const d = new Date(Date.now() + 86_400_000);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
}

/** One lead at a time: call, click what happened (or press its key), and the next lead appears. */
export function CallList({ leads, mode, counts, canSeeUnassigned, callsToday, hasTwilio }: {
  leads: CallLead[]; mode: "mine" | "unassigned"; counts: { mine: number; unassigned: number }; canSeeUnassigned: boolean; callsToday: number; hasTwilio: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [openOnly, setOpenOnly] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [asking, setAsking] = useState<CallOutcomeId | null>(null);
  const [date, setDate] = useState(tomorrowAt10());
  const [note, setNote] = useState("");

  const visible = useMemo(() => leads.filter((l) => !skipped.has(l.id) && (!openOnly || l.openNow)), [leads, skipped, openOnly]);
  const current = visible.find((l) => l.id === picked) ?? visible[0] ?? null;
  const upNext = visible.filter((l) => l.id !== current?.id).slice(0, 8);

  const reset = () => { setAsking(null); setNote(""); setDate(tomorrowAt10()); setPicked(null); };
  const submit = (outcome: CallOutcomeId, withDate?: string) => {
    if (!current) return;
    const spec = CALL_OUTCOMES.find((o) => o.id === outcome)!;
    if (spec.needsDate && !withDate) return setAsking(outcome);
    start(async () => {
      const r = await logCallOutcome(current.id, outcome, { date: withDate ? new Date(withDate).toISOString() : undefined, note });
      toast(r.error ?? r.message ?? "Saved", r.error ? "error" : "ok");
      if (!r.error) { reset(); router.refresh(); }
    });
  };
  const skip = () => { if (current) { setSkipped(new Set(skipped).add(current.id)); reset(); } };

  // Keyboard: N no answer, V voicemail, C call back, I interested, M meeting, X not interested, W wrong number, S skip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (pending || e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, select, button[aria-haspopup], [contenteditable], [role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (k === "s") return skip();
      const o = CALL_OUTCOMES.find((x) => x.key === k);
      if (o) { e.preventDefault(); submit(o.id); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><PhoneCall className="h-6 w-6 text-brand-600" /> Call list</h1>
          <p className="text-sm text-ink-3">Call, click what happened, and the next lead comes up. Follow-ups are set for you. {callsToday > 0 && <b className="text-ink-2">{callsToday} call{callsToday === 1 ? "" : "s"} logged today.</b>}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canSeeUnassigned && (
            <div className="flex rounded-lg border border-line p-0.5 text-sm">
              <Link href="/calls" className={`rounded-md px-3 py-1.5 ${mode === "mine" ? "bg-brand-600 text-white" : "text-ink-2 hover:bg-hover"}`}>My leads · {counts.mine >= 150 ? "150+" : counts.mine}</Link>
              <Link href="/calls?mode=unassigned" className={`rounded-md px-3 py-1.5 ${mode === "unassigned" ? "bg-brand-600 text-white" : "text-ink-2 hover:bg-hover"}`}>Unassigned · {counts.unassigned >= 150 ? "150+" : counts.unassigned}</Link>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Open right now only</label>
        </div>
      </div>

      {!current ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-semibold">Nobody left to call {openOnly ? "who's open right now" : "today"} 🎉</p>
          <p className="mt-1 text-sm text-ink-3">{skipped.size > 0 ? `You skipped ${skipped.size}. ` : ""}Leads come back here when their follow-up is due.{mode === "mine" && canSeeUnassigned && counts.unassigned > 0 ? " There are unassigned leads to call too." : ""}</p>
          {skipped.size > 0 && <button type="button" className="btn-ghost mt-3" onClick={() => setSkipped(new Set())}>Show skipped again</button>}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="card space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">{current.company}</h2>
                  {current.priority && <span className="chip bg-brand-600 text-white">Priority {current.priority}</span>}
                  {current.due && <span className="chip bg-amber-50 text-amber-800">Follow-up due</span>}
                </div>
                <p className="text-sm text-ink-2">{[current.contactName, current.industry, current.country].filter(Boolean).join(" · ")}</p>
              </div>
              <Link href={`/leads/${current.id}`} className="btn-ghost text-sm"><ExternalLink className="h-4 w-4" /> Open lead</Link>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a href={`tel:${current.e164 ?? current.phone}`} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-lg font-semibold text-white hover:bg-brand-700">
                <Phone className="h-5 w-5" /> {current.phone}
              </a>
              <LeadComms key={current.id} lead={{ id: current.id, company: current.company, contactName: current.contactName, phone: current.phone, e164: current.e164 }} hasTwilio={hasTwilio} autoOpen={null} />
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${current.openNow ? "bg-emerald-50 text-emerald-700" : "bg-line-soft text-ink-2"}`}>
                <Clock className="h-4 w-4" /> {current.localTime} their time · {current.openNow ? "open now" : "probably closed"}
              </span>
            </div>

            {(current.whyFit || current.notes || current.last) && (
              <div className="grid gap-3 rounded-xl bg-canvas p-3 text-sm sm:grid-cols-2">
                {current.whyFit && <div><div className="label">Why they&rsquo;re a fit</div><p>{current.whyFit}</p></div>}
                {current.notes && <div><div className="label">Notes</div><p className="whitespace-pre-line">{current.notes}</p></div>}
                {current.last && (
                  <div className="sm:col-span-2">
                    <div className="label">Last time</div>
                    <p>{new Date(current.last.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}: {current.last.summary ?? current.last.type.toLowerCase()}</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="label">What happened? <span className="font-normal text-ink-3">(or press the letter)</span></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CALL_OUTCOMES.map((o) => (
                  <button key={o.id} type="button" disabled={pending} onClick={() => submit(o.id)}
                    className={`flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm font-medium disabled:opacity-50 ${TONE[o.id]} ${asking === o.id ? "ring-2 ring-brand-500" : ""}`}>
                    {o.label} <kbd className="rounded border border-current/20 px-1.5 text-[11px] opacity-60">{o.key.toUpperCase()}</kbd>
                  </button>
                ))}
                <button type="button" onClick={skip} className="flex items-center justify-between rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-ink-2 hover:bg-hover">
                  Skip <span className="flex items-center gap-1"><SkipForward className="h-3.5 w-3.5" /><kbd className="rounded border border-line px-1.5 text-[11px]">S</kbd></span>
                </button>
              </div>
            </div>

            {asking && (
              <div className="flex flex-wrap items-end gap-2 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
                <label className="text-sm">
                  <span className="label">{asking === "meeting" ? "When is the meeting?" : "When should you call back?"}</span>
                  <input type="datetime-local" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <button type="button" className="btn-primary" disabled={pending || !date} onClick={() => submit(asking, date)}>Save <ArrowRight className="h-4 w-4" /></button>
                <button type="button" className="btn-ghost" onClick={() => setAsking(null)}>Cancel</button>
              </div>
            )}
            <textarea className="input min-h-16" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes from the call (optional), saved with the outcome" />
          </section>

          <aside className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">Up next · {visible.length - 1}</h3>
            {upNext.length === 0 ? <p className="text-sm text-ink-3">That&rsquo;s the last one.</p> : (
              <ul className="space-y-1">
                {upNext.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => { reset(); setPicked(l.id); }} className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-hover">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${l.openNow ? "bg-emerald-500" : "bg-line"}`} title={l.openNow ? "Open now" : "Probably closed"} />
                        <span className="truncate">{l.company}</span>
                        {l.priority && <span className="ml-auto text-xs text-ink-3">{l.priority}</span>}
                      </div>
                      <div className="truncate pl-4 text-xs text-ink-3">{[l.country, l.localTime].filter(Boolean).join(" · ")}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
