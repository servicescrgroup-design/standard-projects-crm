"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { approveAndSend, deleteDraft, saveEmailDraft, type EmailResult } from "@/app/emailActions";
import { toast } from "@/components/ui/Toaster";
import { Select } from "@/components/ui/Select";

export type ThreadOption = { activityId: string; subject: string };

/** "Send email" on a lead. Reps submit for approval; owners and team leads can send straight away. */
export function EmailComposer({ leadId, defaultTo, canSend, threads, hasMailbox }: { leadId: string; defaultTo: string; canSend: boolean; threads: ThreadOption[]; hasMailbox: boolean }) {
  const [state, action, pending] = useActionState<EmailResult, FormData>(saveEmailDraft, {});
  const [replyTo, setReplyTo] = useState("");
  const [subject, setSubject] = useState("");
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) toast(state.error, "error");
    if (state.ok) {
      toast(state.message ?? "Saved", "ok");
      form.current?.reset();
      setReplyTo("");
      setSubject("");
    }
  }, [state]);

  const pickThread = (id: string) => {
    setReplyTo(id);
    const t = threads.find((x) => x.activityId === id);
    if (t) setSubject(/^re:/i.test(t.subject) ? t.subject : `Re: ${t.subject}`);
  };

  return (
    <form ref={form} action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      {threads.length > 0 && (
        <label className="block">
          <span className="label">Reply in thread</span>
          <Select name="replyToActivityId" ariaLabel="Reply in thread" value={replyTo} onChange={pickThread} options={[{ value: "", label: "New email" }, ...threads.map((t) => ({ value: t.activityId, label: t.subject || "(no subject)" }))]} />
        </label>
      )}
      <label className="block">
        <span className="label">To</span>
        <input name="to" className="input" defaultValue={defaultTo} placeholder="name@company.com" required />
      </label>
      <label className="block">
        <span className="label">Subject</span>
        <input name="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} />
      </label>
      <label className="block">
        <span className="label">Message</span>
        <textarea name="body" className="input min-h-36" required />
      </label>
      <div className="flex flex-wrap gap-2">
        {canSend ? (
          <>
            <button name="intent" value="send" className="btn-primary" disabled={pending || !hasMailbox} title={hasMailbox ? undefined : "Connect your mailbox in Settings first"}>
              <Send className="h-4 w-4" /> {pending ? "Sending…" : "Send"}
            </button>
            <button name="intent" value="approval" className="btn-ghost" disabled={pending}>Save as awaiting approval</button>
          </>
        ) : (
          <button name="intent" value="approval" className="btn-primary" disabled={pending}>
            <Send className="h-4 w-4" /> Submit for approval
          </button>
        )}
        <button name="intent" value="draft" className="btn-ghost" disabled={pending}>Save draft</button>
      </div>
      {canSend && !hasMailbox && (
        <p className="text-xs text-ink-3">
          To send, <a href="/settings#email" className="text-brand-700 underline">connect Gmail or Outlook</a> first. The email goes out from the author&rsquo;s mailbox, or yours if they haven&rsquo;t connected one.
        </p>
      )}
    </form>
  );
}

/** Approve & Send / Delete on a saved draft (owners and team leads only). */
export function DraftButtons({ draftId }: { draftId: string }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<EmailResult>) =>
    start(async () => {
      const r = await fn();
      toast(r.error ?? r.message ?? "Done", r.error ? "error" : "ok");
    });
  return (
    <div className="flex gap-2">
      <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => approveAndSend(draftId))}>
        {pending ? "Sending…" : "Approve & Send"}
      </button>
      <button type="button" className="btn-ghost text-rose-600" disabled={pending} onClick={() => confirm("Delete this draft?") && run(() => deleteDraft(draftId))}>
        Delete
      </button>
    </div>
  );
}
