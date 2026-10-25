"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import { goAheadAction, recordDemoViewAction } from "./actions";

/** The live demo in a browser frame (desktop or phone size), with a full-screen link for sites that can't be framed. */
export function DemoFrame({ url }: { url: string }) {
  const [phone, setPhone] = useState(false);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
          <button type="button" onClick={() => setPhone(false)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${!phone ? "bg-[#0b2a3a] text-white" : "text-slate-600"}`}><Monitor className="h-4 w-4" /> Computer</button>
          <button type="button" onClick={() => setPhone(true)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${phone ? "bg-[#0b2a3a] text-white" : "text-slate-600"}`}><Smartphone className="h-4 w-4" /> Phone</button>
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#cdf464] px-4 py-2 text-sm font-semibold text-black hover:brightness-95">Open the demo full screen <ExternalLink className="h-4 w-4" /></a>
      </div>
      <div className={`mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg transition-all ${phone ? "max-w-[400px]" : "w-full"}`}>
        <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 truncate text-xs text-slate-500">{url.replace(/^https?:\/\//, "")}</span>
        </div>
        <iframe src={url} title="Your demo website" className={`w-full bg-white ${phone ? "h-[720px]" : "h-[70vh] min-h-[520px]"}`} loading="lazy" />
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">Not loading? Use &ldquo;Open the demo full screen&rdquo;.</p>
    </div>
  );
}

export function GoAhead({ token, done: alreadyDone, record }: { token: string; done: boolean; record: boolean }) {
  const [done, setDone] = useState(alreadyDone);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Count the visit once per browser session, from the client's browser only.
  useEffect(() => {
    if (!record) return;
    const key = `spcrm.demo.${token}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    recordDemoViewAction(token).catch(() => null);
  }, [token, record]);

  if (done) {
    return (
      <div className="rounded-2xl bg-emerald-50 p-6 text-center text-emerald-900">
        <p className="text-lg font-semibold">Thank you! 🎉</p>
        <p className="mt-1 text-sm">We&rsquo;ll be in touch very soon to talk through the next steps.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-[#0b2a3a] p-6 text-white">
      <p className="text-lg font-semibold">Like what you see?</p>
      <p className="mt-1 text-sm text-white/70">Let us know and we&rsquo;ll call you to talk through changes and next steps. There&rsquo;s no commitment yet.</p>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Anything you'd like changed, or the best time to call (optional)" className="mt-4 min-h-20 w-full rounded-xl border-0 bg-white/10 p-3 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[#cdf464]" />
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await goAheadAction(token, note); if (r.error) setError(r.error); else setDone(true); })}
        className="mt-3 rounded-xl bg-[#cdf464] px-5 py-3 font-semibold text-black hover:brightness-95 disabled:opacity-60">
        {pending ? "Sending…" : "I’d like to go ahead"}
      </button>
    </div>
  );
}
