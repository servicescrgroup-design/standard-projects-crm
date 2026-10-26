"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Search, Send, Sparkles, X } from "lucide-react";
import { saveEmailDraft } from "@/app/emailActions";
import { languageInfo, missingFields, rankTemplates, renderTemplate, targetLabel, type MergeContext } from "@/lib/templates";
import { toast } from "@/components/ui/Toaster";
import type { LeadTarget, TemplateOption } from "./EmailComposer";

/**
 * "Quick email" on a lead: pick a template (the best one for the lead's country and industry is on top),
 * check the filled-in email, send from your own Gmail. Two clicks for the usual case.
 */
export function QuickEmail({ leadId, leadEmail, company, templates, merge, target, canSendNow, hasMailbox, blocked }: {
  leadId: string; leadEmail: string | null; company: string; templates: TemplateOption[]; merge: MergeContext; target: LeadTarget;
  canSendNow: boolean; hasMailbox: boolean; blocked: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<TemplateOption | null>(null);
  const [query, setQuery] = useState("");
  const [to, setTo] = useState(leadEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  const ranked = useMemo(() => rankTemplates(templates, target), [templates, target]);
  const recommended = ranked.filter((t) => t.fit > 0).slice(0, 3);
  const others = ranked.filter((t) => !recommended.includes(t) && `${t.name} ${t.subject} ${targetLabel(t)}`.toLowerCase().includes(query.toLowerCase()));
  const missing = picked ? missingFields(`${picked.subject}\n${picked.body}`, merge) : [];
  const forWhom = [target.country, target.industry].filter(Boolean).join(" · ");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const choose = (t: TemplateOption | null) => {
    setPicked(t ?? { id: "", name: "Blank email", language: "en", subject: "", body: "", countries: [], industries: [] });
    setSubject(t ? renderTemplate(t.subject, merge) : "");
    setBody(t ? renderTemplate(t.body, merge) : `Hi ${merge.first_name || "there"},\n\n\n\nBest regards,\n${merge.agent_name ?? ""}`);
  };
  const close = () => { setOpen(false); setPicked(null); setQuery(""); };

  const submit = (intent: "send" | "approval" | "draft") =>
    start(async () => {
      const fd = new FormData();
      fd.set("leadId", leadId);
      fd.set("to", to);
      fd.set("subject", subject);
      fd.set("body", body);
      fd.set("intent", intent);
      if (picked?.id) fd.set("templateId", picked.id);
      const r = await saveEmailDraft({}, fd);
      toast(r.error ?? r.message ?? "Done", r.error ? "error" : "ok");
      if (!r.error) { close(); router.refresh(); }
    });

  const card = (t: TemplateOption & { fit?: number }, best = false) => (
    <button key={t.id} type="button" onClick={() => choose(t)}
      className={`w-full rounded-xl border p-3 text-left hover:border-brand-400 hover:bg-brand-50/40 ${best ? "border-brand-300 bg-brand-50/30" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{t.name}</span>
        {best && <span className="chip bg-brand-600 text-white"><Sparkles className="mr-1 inline h-3 w-3" />Recommended</span>}
        <span className="chip">{languageInfo(t.language).label}</span>
      </div>
      <p className="mt-1 truncate text-sm text-ink-2">{renderTemplate(t.subject, merge)}</p>
      {targetLabel(t) && <p className="text-xs text-ink-3">For {targetLabel(t)}</p>}
    </button>
  );

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}><Mail className="h-4 w-4" /> Quick email</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:items-center" onClick={close}>
          <div role="dialog" aria-label="Quick email" className="w-full max-w-2xl rounded-2xl border border-line bg-white shadow-[var(--shadow-menu)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2">
                {picked && <button type="button" aria-label="Back to templates" onClick={() => setPicked(null)} className="rounded-lg p-1.5 text-ink-2 hover:bg-hover"><ArrowLeft className="h-4 w-4" /></button>}
                <h2 className="font-semibold">{picked ? picked.name : `Email ${company}`}</h2>
              </div>
              <button type="button" aria-label="Close" onClick={close} className="rounded-lg p-1.5 text-ink-2 hover:bg-hover"><X className="h-4 w-4" /></button>
            </div>

            {!hasMailbox ? (
              <div className="space-y-3 p-5 text-sm">
                <p>Connect your Gmail (or Outlook) first. Your emails then go out from your own address, and replies show up on the lead.</p>
                <Link href="/settings#email" className="btn-primary">Connect Gmail</Link>
              </div>
            ) : blocked ? (
              <p className="p-5 text-sm text-rose-700">{blocked}. Emails to this lead are switched off.</p>
            ) : !leadEmail ? (
              <p className="p-5 text-sm text-ink-2">This lead has no email address yet. Add one in the lead&rsquo;s details, then try again.</p>
            ) : !picked ? (
              <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
                {recommended.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Best for {forWhom || "this lead"}</p>
                    {recommended.map((t, i) => card(t, i === 0))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-canvas p-3 text-sm text-ink-2">
                    No template is written for {forWhom || "this lead's country and industry"} yet. Pick a general one below, or ask your manager to make one in Outreach → Templates.
                  </p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
                    <Search className="h-4 w-4 text-ink-3" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all templates…" className="w-full bg-transparent text-sm outline-none" aria-label="Search templates" />
                  </div>
                  <div className="space-y-2">{others.slice(0, 40).map((t) => card(t))}</div>
                  {others.length === 0 && <p className="text-sm text-ink-3">No other templates match.</p>}
                  <button type="button" onClick={() => choose(null)} className="w-full rounded-xl border border-dashed border-line p-3 text-left text-sm text-ink-2 hover:bg-hover">Write without a template</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-5">
                <label className="block"><span className="label">To</span><input className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
                <label className="block"><span className="label">Subject</span><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} /></label>
                <label className="block"><span className="label">Message</span><textarea className="input min-h-72" value={body} onChange={(e) => setBody(e.target.value)} /></label>
                {missing.length > 0 && <p className="text-xs text-amber-700">This lead has no {missing.map((m) => m.replace("_", " ")).join(", ")}, so that part was left out. Check the text before sending.</p>}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {canSendNow ? (
                    <button type="button" className="btn-primary" disabled={pending || !body.trim()} onClick={() => submit("send")}><Send className="h-4 w-4" /> {pending ? "Sending…" : "Send"}</button>
                  ) : (
                    <button type="button" className="btn-primary" disabled={pending || !body.trim()} onClick={() => submit("approval")}><Send className="h-4 w-4" /> {pending ? "Sending…" : "Send for approval"}</button>
                  )}
                  <button type="button" className="btn-ghost" disabled={pending} onClick={() => submit("draft")}>Save draft</button>
                  <span className="text-xs text-ink-3">{canSendNow ? "Goes from your own mailbox. Replies show up on this lead." : "A manager approves it, then it goes from your mailbox."}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
