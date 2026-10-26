"use client";

import { useState, useTransition } from "react";
import { setAgentsSendDirectAction } from "@/app/emailActions";
import { toast } from "@/components/ui/Toaster";

/** Owner switch: agents send one-off emails from their own Gmail/Outlook without waiting for approval. */
export function AgentsSendToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className="mt-4 flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={on} disabled={pending}
        onChange={(e) => { const next = e.target.checked; setOn(next); start(async () => { const r = await setAgentsSendDirectAction(next); toast(r.error ?? r.message ?? "Saved", r.error ? "error" : "ok"); if (r.error) setOn(!next); }); }} />
      <span>
        <b>Agents can send emails from their own Gmail without approval</b>
        <span className="block text-ink-3">When on, an agent who has connected their own mailbox can press Send on a lead and it goes straight away. When off, their emails wait for you or a team lead to approve. Email sequences always need approval.</span>
      </span>
    </label>
  );
}
