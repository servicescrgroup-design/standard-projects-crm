"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, Printer, XCircle } from "lucide-react";
import { acceptQuoteAction, declineQuoteAction, recordViewAction, type PublicQuoteResult } from "./actions";

/** Accept / decline buttons on the public quote, plus print. */
export function QuoteAnswer({ token, status, expired, preview, acceptedName, acceptedAt, contactEmail }: {
  token: string; status: string; expired: boolean; preview: boolean; acceptedName: string | null; acceptedAt: string | null; contactEmail: string | null;
}) {
  const [accept, acceptAction, accepting] = useActionState<PublicQuoteResult, FormData>(acceptQuoteAction.bind(null, token), {});
  const [decline, declineAction, declining] = useActionState<PublicQuoteResult, FormData>(declineQuoteAction.bind(null, token), {});
  const [mode, setMode] = useState<"idle" | "decline">("idle");

  // Count one view per browser visit (team previews don't count).
  useEffect(() => {
    if (preview) return;
    const key = `spcrm.quoteViewed.${token}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked: still count it */
    }
    recordViewAction(token).catch(() => null);
  }, [preview, token]);
  const contact = contactEmail ? <> or email <a className="underline" href={`mailto:${contactEmail}`}>{contactEmail}</a></> : null;

  const done = status === "ACCEPTED" || accept.ok;
  const declined = status === "DECLINED" || decline.ok;

  return (
    <div className="space-y-4 border-t border-[#eaecf0] pt-6 print:hidden">
      {done ? (
        <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <span><b>Accepted{acceptedName ? ` by ${acceptedName}` : ""}{acceptedAt ? ` on ${acceptedAt}` : ""}.</b> Thank you! We&rsquo;ll be in touch shortly about next steps.</span>
        </p>
      ) : declined ? (
        <p className="flex items-start gap-2 rounded-xl bg-[#f9fafb] p-4 text-[#344054]"><XCircle className="mt-0.5 h-5 w-5 shrink-0" /> You declined this quote. Thanks for letting us know. If anything changes, just reply to our email{contact}.</p>
      ) : expired ? (
        <p className="rounded-xl bg-amber-50 p-4 text-amber-800">This quote has expired. Please reply to our email{contact} and we&rsquo;ll send an updated one.</p>
      ) : preview ? (
        <p className="rounded-xl bg-[#f9fafb] p-4 text-sm text-[#667085]">The customer sees <b>Accept quote</b> and <b>Decline</b> buttons here.</p>
      ) : mode === "decline" ? (
        <form action={declineAction} className="space-y-3">
          <label className="block text-sm"><span className="mb-1 block font-medium">Could you tell us why? (optional)</span><textarea name="reason" className="w-full rounded-lg border border-[#d0d5dd] p-3 text-sm" rows={3} placeholder="e.g. budget, timing, chose another option" /></label>
          {decline.error && <p className="text-sm text-rose-600">{decline.error}</p>}
          <div className="flex gap-2">
            <button className="rounded-lg bg-[#101828] px-4 py-2.5 text-sm font-medium text-white" disabled={declining}>{declining ? "Sending…" : "Decline quote"}</button>
            <button type="button" className="rounded-lg px-4 py-2.5 text-sm text-[#475467]" onClick={() => setMode("idle")}>Back</button>
          </div>
        </form>
      ) : (
        <form action={acceptAction} className="space-y-3">
          <p className="font-medium">Happy to go ahead?</p>
          <label className="block text-sm"><span className="mb-1 block text-[#475467]">Your full name</span><input name="name" required minLength={2} className="w-full max-w-sm rounded-lg border border-[#d0d5dd] px-3 py-2.5" autoComplete="name" /></label>
          <label className="flex items-start gap-2 text-sm text-[#475467]"><input type="checkbox" name="agree" className="mt-1" required /> I accept this quote and its terms on behalf of the business named above.</label>
          {accept.error && <p className="text-sm text-rose-600">{accept.error}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700" disabled={accepting}>{accepting ? "Accepting…" : "Accept quote"}</button>
            <button type="button" className="rounded-lg border border-[#d0d5dd] px-4 py-2.5 text-sm" onClick={() => setMode("decline")}>Decline</button>
          </div>
        </form>
      )}
      <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 text-sm text-[#475467] hover:text-[#101828]"><Printer className="h-4 w-4" /> Print or save as PDF</button>
    </div>
  );
}
