"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Mail, TriangleAlert } from "lucide-react";
import { toast } from "@/components/ui/Toaster";
import { NAMES, STATUS } from "./MailboxSettings";

type Provider = "GMAIL" | "OUTLOOK";
type Box = { provider: string; address: string; status: string; lastSyncAt: string | null };

/** Top of the Emails page: your connected mailbox, or one-click Connect Gmail / Outlook that brings you back here. */
export function MailboxBar({ mailboxes, configured, status }: { mailboxes: Box[]; configured: Record<Provider, boolean>; status: string | null }) {
  useEffect(() => {
    const s = status && STATUS[status];
    if (s) toast(s[0], s[1]);
  }, [status]);

  const connect = (p: Provider, label: string, primary: boolean) => (
    <a key={p} href={`/api/email/connect/${p.toLowerCase()}?back=emails`} className={primary ? "btn-primary" : "btn-ghost"}>{label}</a>
  );
  const missing = (["GMAIL", "OUTLOOK"] as Provider[]).filter((p) => configured[p] && !mailboxes.some((m) => m.provider === p));

  if (mailboxes.length === 0) {
    if (missing.length === 0) return null;
    return (
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <Mail className="h-5 w-5 shrink-0 text-brand-600" />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">Connect your mailbox</span>
          <span className="text-ink-2"> to send from your own address and see your leads&rsquo; replies here.</span>
        </p>
        <div className="flex flex-wrap gap-2">{missing.map((p, i) => connect(p, `Connect ${NAMES[p]}`, i === 0))}</div>
      </div>
    );
  }

  return (
    <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
      {mailboxes.map((m) => {
        const ok = m.status === "ACTIVE";
        return (
          <span key={m.provider} className={`flex items-center gap-1.5 ${ok ? "text-emerald-700" : "text-rose-600"}`}>
            {ok ? <CheckCircle2 className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
            {ok ? `Sending from ${m.address}` : `${m.address} needs reconnecting`}
            {ok && m.lastSyncAt && <span className="text-ink-3">· synced {new Date(m.lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            {!ok && connect(m.provider as Provider, "Reconnect", true)}
          </span>
        );
      })}
      <span className="ml-auto flex flex-wrap items-center gap-2">
        {missing.map((p) => connect(p, `Connect ${NAMES[p]}`, false))}
        <Link href="/settings#email" className="text-ink-3 hover:text-ink">Manage</Link>
      </span>
    </div>
  );
}
