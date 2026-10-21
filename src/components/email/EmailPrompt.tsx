"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- OAuth start routes need a full page navigation */
import { useTransition } from "react";
import { Mail, X } from "lucide-react";
import { dismissEmailPrompt } from "@/app/emailActions";

/** Shown on the dashboard until the user connects a mailbox or dismisses it. */
export function EmailPrompt({ gmail, outlook }: { gmail: boolean; outlook: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
      <Mail className="h-5 w-5 shrink-0 text-brand-600" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">Connect your mailbox</span>
        <span className="text-ink-2"> so emails with your leads are logged automatically and you can send from the CRM.</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {gmail && <a href="/api/email/connect/gmail" className="btn-primary">Connect Gmail</a>}
        {outlook && <a href="/api/email/connect/outlook" className="btn-ghost">Connect Outlook</a>}
        <button type="button" aria-label="Dismiss" className="btn-ghost px-2" disabled={pending} onClick={() => start(() => dismissEmailPrompt())}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
