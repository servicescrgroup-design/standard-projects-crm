"use client";

import { useEffect, useTransition } from "react";
import { CheckCircle2, Mail, RefreshCw, TriangleAlert } from "lucide-react";
import { disconnectMailbox, syncMyMailboxes } from "@/app/emailActions";
import { toast } from "@/components/ui/Toaster";

type Box = { provider: string; address: string; status: string; lastError: string | null; lastSyncAt: string | null };
type Provider = "GMAIL" | "OUTLOOK";

const NAMES: Record<Provider, string> = { GMAIL: "Gmail", OUTLOOK: "Outlook" };

const STATUS: Record<string, [string, "ok" | "error"]> = {
  "connected-gmail": ["Gmail connected. New emails with your leads will appear within 10 minutes.", "ok"],
  "connected-outlook": ["Outlook connected. New emails with your leads will appear within 10 minutes.", "ok"],
  cancelled: ["Connection cancelled.", "error"],
  expired: ["That sign-in link expired. Please try again.", "error"],
  "no-offline-access": ["The provider didn't grant ongoing access. Please try again and accept all permissions.", "error"],
  "not-configured": ["This provider isn't set up yet. The owner needs to add its app keys in Vercel.", "error"],
  failed: ["Couldn't connect the mailbox. Please try again.", "error"],
};

/** Connect / status / disconnect for the signed-in user's Gmail and Outlook mailboxes. */
export function MailboxSettings({ mailboxes, configured, status }: { mailboxes: Box[]; configured: Record<Provider, boolean>; status: string | null }) {
  const [pending, start] = useTransition();

  useEffect(() => {
    const s = status && STATUS[status];
    if (s) toast(s[0], s[1]);
  }, [status]);

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      toast(r.error ?? r.message ?? "Done", r.error ? "error" : "ok");
    });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {(["GMAIL", "OUTLOOK"] as Provider[]).map((p) => {
          const box = mailboxes.find((m) => m.provider === p);
          return (
            <div key={p} className="rounded-xl border border-line p-4">
              <div className="flex items-center gap-2 font-medium">
                <Mail className="h-4 w-4 text-brand-600" /> {NAMES[p]}
              </div>
              {box ? (
                <>
                  <p className={`mt-2 flex items-center gap-1.5 text-sm ${box.status === "ACTIVE" ? "text-emerald-700" : "text-rose-600"}`}>
                    {box.status === "ACTIVE" ? <CheckCircle2 className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
                    {box.status === "ACTIVE" ? `Connected as ${box.address}` : `${box.address}: needs reconnecting`}
                  </p>
                  {box.lastError && <p className="mt-1 text-xs text-rose-600">{box.lastError}</p>}
                  <p className="mt-1 text-xs text-ink-3">
                    {box.lastSyncAt ? `Last checked ${new Date(box.lastSyncAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Not checked yet"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {box.status !== "ACTIVE" && (
                      <a href={`/api/email/connect/${p.toLowerCase()}`} className="btn-primary">Reconnect</a>
                    )}
                    <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => disconnectMailbox(p))}>
                      Disconnect
                    </button>
                  </div>
                </>
              ) : configured[p] ? (
                <a href={`/api/email/connect/${p.toLowerCase()}`} className="btn-primary mt-3 inline-flex">Connect {NAMES[p]}</a>
              ) : (
                <p className="mt-2 text-sm text-ink-3">Not available yet: the owner needs to add the {NAMES[p]} app keys in Vercel.</p>
              )}
            </div>
          );
        })}
      </div>
      {mailboxes.length > 0 && (
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(syncMyMailboxes)}>
          <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} /> Check for new emails now
        </button>
      )}
      <p className="text-xs text-ink-3">
        Emails you send from the CRM are tagged &ldquo;Standard Projects/Outreach Sent&rdquo; (a Gmail label or an Outlook category).
        Your sign-in tokens are stored encrypted and are only used for your own mailbox.
      </p>
    </div>
  );
}
