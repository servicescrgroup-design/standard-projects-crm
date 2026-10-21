"use client";

import { useActionState, useEffect, useTransition } from "react";
import { CheckCircle2, PhoneCall } from "lucide-react";
import { connectTwilioAction, disconnectTwilioAction, type VoiceResult } from "@/app/voiceActions";
import { toast } from "@/components/ui/Toaster";

/** Settings → Phone: connect the agent's own Twilio account (optional). */
export function TwilioSettings({ connection }: { connection: { callerId: string; accountSid: string; record: boolean } | null }) {
  const [state, action, pending] = useActionState<VoiceResult, FormData>(connectTwilioAction, {});
  const [busy, start] = useTransition();
  useEffect(() => {
    if (state.error) toast(state.error, "error");
    if (state.ok) toast(state.message ?? "Connected", "ok");
  }, [state]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line p-4 text-sm">
        <p className="flex items-center gap-2 font-medium"><PhoneCall className="h-4 w-4 text-brand-600" /> Calling from your phone (free)</p>
        <p className="mt-1 text-ink-2">
          Always available. Press <b>Call</b> on a lead: your phone dials (on a Mac it rings through your iPhone) and a call panel opens in the CRM
          for notes and the outcome, which save to the lead&rsquo;s history.
        </p>
      </div>

      <div className="rounded-xl border border-line p-4 text-sm">
        <p className="flex items-center gap-2 font-medium"><PhoneCall className="h-4 w-4 text-brand-600" /> Calling from the browser with your own Twilio account (optional)</p>
        {connection ? (
          <>
            <p className="mt-2 flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Connected. Calls show {connection.callerId}{connection.record ? " · calls are recorded in your Twilio account" : ""}.</p>
            <p className="mt-1 text-xs text-ink-3">Account {connection.accountSid.slice(0, 6)}…{connection.accountSid.slice(-4)}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => start(async () => { const r = await disconnectTwilioAction(); toast(r.message ?? "Disconnected", "ok"); })}
              className="btn-ghost mt-3"
            >
              Disconnect Twilio
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-ink-2">
              Call leads straight from the CRM with a headset; Twilio bills your own account per minute. In the Twilio Console: copy your
              <b> Account SID</b>, create an <b>API key</b> (Account → API keys &amp; tokens → Create, type Standard) and copy its SID and secret, and
              have a <b>phone number</b> (bought in Twilio, or your own number verified as a caller ID). The CRM sets up the rest.
            </p>
            <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
              <label><span className="label">Account SID</span><input name="accountSid" required className="input font-mono" placeholder="AC…" autoComplete="off" spellCheck={false} /></label>
              <label><span className="label">Twilio phone number</span><input name="callerId" required className="input" placeholder="+1 512 555 0100" autoComplete="off" /></label>
              <label><span className="label">API key SID</span><input name="apiKeySid" required className="input font-mono" placeholder="SK…" autoComplete="off" spellCheck={false} /></label>
              <label><span className="label">API key secret</span><input name="apiKeySecret" required type="password" className="input font-mono" autoComplete="new-password" /></label>
              <label className="flex items-start gap-2 sm:col-span-2">
                <input type="checkbox" name="record" className="mt-1" />
                <span className="text-ink-2">Record calls in my Twilio account. Only turn this on if you tell people the call is recorded, as the law requires in many countries.</span>
              </label>
              <div className="sm:col-span-2">
                <button className="btn-primary" disabled={pending}>{pending ? "Checking with Twilio…" : "Connect Twilio"}</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
