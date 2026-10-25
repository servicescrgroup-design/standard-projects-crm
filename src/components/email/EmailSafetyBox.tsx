"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Clock, MailWarning, ShieldCheck } from "lucide-react";
import { clearConsent, recordConsent, setDoNotEmail } from "@/app/emailSafetyActions";
import { CONSENT_METHODS } from "@/lib/emailSafety";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toaster";

type Flag = { at: string; reason: string | null } | null;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** On a lead: Do not email, bounce, consent and the customer's local time. */
export function EmailSafetyBox({ leadId, optOut, bounce, consent, restrictedCountry, localNow, canUnblock }: {
  leadId: string;
  optOut: Flag;
  bounce: Flag;
  consent: Flag;
  restrictedCountry: string | null;
  localNow: string | null;
  canUnblock: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [recording, setRecording] = useState(false);
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");

  const run = (fn: () => Promise<{ error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      toast(r.error ?? r.message ?? "Done", r.error ? "error" : "ok");
      if (!r.error) after?.();
      router.refresh();
    });

  return (
    <div className="space-y-2 text-sm">
      {optOut && (
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
          <Ban className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <b>Do not email</b> since {day(optOut.at)}
            {optOut.reason && <div className="text-xs text-rose-700">{optOut.reason}</div>}
          </div>
          {canUnblock && (
            <button type="button" disabled={pending} className="rounded-md px-2 py-1 text-xs hover:bg-rose-100"
              onClick={() => confirm("Only remove this if they've said they want to hear from you again. Remove “Do not email”?") && run(() => setDoNotEmail(leadId, false))}>
              Remove
            </button>
          )}
        </div>
      )}
      {bounce && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <b>Email bounced</b> on {day(bounce.at)}{bounce.reason && ` – ${bounce.reason}`}.
            <div className="text-xs">Emails to this address are paused. Change the email address in the details below to send again.</div>
          </div>
        </div>
      )}

      {consent ? (
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <b>Agreed to receive emails</b> on {day(consent.at)}
            {consent.reason && <div className="text-xs text-emerald-800">{consent.reason}</div>}
          </div>
          <button type="button" disabled={pending} className="rounded-md px-2 py-1 text-xs hover:bg-emerald-100" onClick={() => confirm("Remove the consent record?") && run(() => clearConsent(leadId))}>Remove</button>
        </div>
      ) : recording ? (
        <div className="space-y-2 rounded-lg border border-line p-3">
          <span className="label">How did they agree to receive emails?</span>
          <Select ariaLabel="How they agreed" value={method} placeholder="Choose…" onChange={setMethod} options={CONSENT_METHODS.map((m) => ({ value: m, label: m }))} />
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Details (optional), e.g. spoke to the owner, Anna" maxLength={200} />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={!method || pending} onClick={() => run(() => recordConsent(leadId, method, note), () => setRecording(false))}>Save</button>
            <button type="button" className="btn-ghost" onClick={() => setRecording(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        restrictedCountry && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            In {restrictedCountry}, marketing emails need the business&rsquo;s consent. Call or use their contact form first, then{" "}
            <button type="button" className="font-medium underline" onClick={() => setRecording(true)}>record that they agreed</button>.
          </p>
        )
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
        {localNow && (
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Their time: {localNow} · sequence emails go out 9:00–16:00 on weekdays, their time</span>
        )}
        {!consent && !recording && !restrictedCountry && (
          <button type="button" className="hover:text-ink hover:underline" onClick={() => setRecording(true)}>Record consent</button>
        )}
        {!optOut && (
          <button type="button" disabled={pending} className="hover:text-rose-600 hover:underline"
            onClick={() => confirm("Stop all emails to this lead, now and in future?") && run(() => setDoNotEmail(leadId, true))}>
            Mark “Do not email”
          </button>
        )}
      </div>
    </div>
  );
}
