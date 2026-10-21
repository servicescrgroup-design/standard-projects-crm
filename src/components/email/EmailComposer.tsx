"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { approveAndSend, deleteDraft, saveEmailDraft, type EmailResult } from "@/app/emailActions";
import { toast } from "@/components/ui/Toaster";
import { Select } from "@/components/ui/Select";
import { languageInfo, missingFields, rankTemplates, renderTemplate, targetLabel, type MergeContext } from "@/lib/templates";

export type ThreadOption = { activityId: string; subject: string };
export type TemplateOption = { id: string; name: string; language: string; subject: string; body: string; countries: string[]; industries: string[] };
export type LeadTarget = { country: string | null; industry: string | null };

/** "Send email" on a lead. Reps submit for approval; owners and team leads can send straight away. */
export function EmailComposer({ leadId, defaultTo, canSend, threads, hasMailbox, templates = [], merge = {}, target = { country: null, industry: null } }: { leadId: string; defaultTo: string; canSend: boolean; threads: ThreadOption[]; hasMailbox: boolean; templates?: TemplateOption[]; merge?: MergeContext; target?: LeadTarget }) {
  const [state, action, pending] = useActionState<EmailResult, FormData>(saveEmailDraft, {});
  const [replyTo, setReplyTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const form = useRef<HTMLFormElement>(null);
  // Best fit for this lead's country and industry first; templates written for other countries/industries last.
  const ranked = rankTemplates(templates, target);
  const suggested = ranked.filter((t) => t.fit > 0).slice(0, 4);

  // Fill subject and message from a template, with this lead's details merged in.
  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if (!replyTo) setSubject(renderTemplate(t.subject, merge));
    setBody(renderTemplate(t.body, merge));
    setMissing(missingFields(`${t.subject}\n${t.body}`, merge));
  };

  useEffect(() => {
    if (state.error) toast(state.error, "error");
    if (state.ok) {
      toast(state.message ?? "Saved", "ok");
      form.current?.reset();
      setReplyTo("");
      setSubject("");
      setBody("");
      setTemplateId("");
      setMissing([]);
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
      {templates.length > 0 && (
        <div>
          {suggested.length > 0 && (
            <div className="mb-2">
              <span className="label">Templates for {[target.country, target.industry].filter(Boolean).join(" · ")}</span>
              <div className="flex flex-wrap gap-1.5">
                {suggested.map((t) => (
                  <button key={t.id} type="button" onClick={() => applyTemplate(t.id)} className={`chip hover:bg-brand-50 hover:text-brand-700 ${templateId === t.id ? "bg-brand-600 text-white hover:bg-brand-600 hover:text-white" : ""}`}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <span className="label">{suggested.length ? "Or choose any template" : "Start from a template"}</span>
          <Select ariaLabel="Template" value={templateId} placeholder="Choose a template…" onChange={applyTemplate} options={ranked.map((t) => ({ value: t.id, label: t.name, hint: t.fit < 0 ? `for ${targetLabel(t)}` : languageInfo(t.language).short }))} />
          {missing.length > 0 && <p className="mt-1 text-xs text-amber-700">This lead has no {missing.map((m) => m.replace("_", " ")).join(", ")}. Check the text before sending.</p>}
        </div>
      )}
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
        <textarea name="body" className="input min-h-36" required value={body} onChange={(e) => setBody(e.target.value)} />
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
