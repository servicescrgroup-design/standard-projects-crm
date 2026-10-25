"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Mail, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { runSequencesNow, saveSequence } from "@/app/outreachActions";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toaster";
import { languageInfo } from "@/lib/templates";

export type TemplateView = { id: string; name: string; category: string | null; language: string; subject: string; body: string; countries: string[]; industries: string[]; stats?: { sent: number; replied: number } | null };
export type SequenceView = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  steps: { templateId: string; waitDays: number; templateName: string }[];
  stats: { active: number; pending: number; replied: number; completed: number; stopped: number };
};

type Draft = { id: string | null; name: string; description: string; active: boolean; steps: { templateId: string; waitDays: number }[] };

/** Sequence cards with an inline editor (owners and team leads). */
export function SequencesBoard({ sequences, templates, canEdit, canRunNow }: { sequences: SequenceView[]; templates: TemplateView[]; canEdit: boolean; canRunNow: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pending, start] = useTransition();
  const tplOptions = templates.map((t) => ({ value: t.id, label: `${t.name}${t.language === "en" ? "" : ` (${languageInfo(t.language).short})`}`, hint: t.category ?? undefined }));

  const save = () =>
    editing &&
    start(async () => {
      const r = await saveSequence(editing);
      toast(r.error ?? r.message ?? "Saved", r.error ? "error" : "ok");
      if (!r.error) {
        setEditing(null);
        router.refresh();
      }
    });

  const day = (steps: { waitDays: number }[], i: number) => steps.slice(0, i + 1).reduce((t, s) => t + s.waitDays, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <button type="button" className="btn-primary" onClick={() => setEditing({ id: null, name: "", description: "", active: true, steps: [{ templateId: templates[0]?.id ?? "", waitDays: 0 }] })}>
            <Plus className="h-4 w-4" /> New sequence
          </button>
        )}
        {canRunNow && (
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => start(async () => { const r = await runSequencesNow(); toast(r.error ?? r.message ?? "Done", r.error ? "error" : "ok"); router.refresh(); })}>
            <Play className="h-4 w-4" /> Send due emails now
          </button>
        )}
      </div>

      {editing && (
        <section className="card space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{editing.id ? "Edit sequence" : "New sequence"}</h2>
            <button type="button" aria-label="Close" className="btn px-2 text-ink-2 hover:bg-hover" onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="label">Name</span><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Website outreach (English)" /></label>
            <label><span className="label">Description</span><input className="input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Who it's for" /></label>
          </div>
          <ol className="space-y-2">
            {editing.steps.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
                <span className="text-sm text-ink-2">{i === 0 ? "Send" : "Wait"}</span>
                <input
                  type="number"
                  min={i === 0 ? 0 : 1}
                  max={60}
                  value={s.waitDays}
                  onChange={(e) => setEditing({ ...editing, steps: editing.steps.map((x, j) => (j === i ? { ...x, waitDays: Number(e.target.value) } : x)) })}
                  className="input w-20"
                  aria-label={`Days before email ${i + 1}`}
                />
                <span className="text-sm text-ink-2">{i === 0 ? "days after enrolling, then send" : "days, then send"}</span>
                <div className="min-w-56 flex-1">
                  <Select ariaLabel={`Template for email ${i + 1}`} value={s.templateId} placeholder="Choose a template…" onChange={(v) => setEditing({ ...editing, steps: editing.steps.map((x, j) => (j === i ? { ...x, templateId: v } : x)) })} options={tplOptions} />
                </div>
                <span className="text-xs text-ink-3">Day {day(editing.steps, i)}</span>
                <div className="flex gap-1">
                  <button type="button" aria-label="Move up" disabled={i === 0} className="btn px-1.5 hover:bg-hover disabled:opacity-30" onClick={() => { const st = [...editing.steps]; [st[i - 1], st[i]] = [st[i], st[i - 1]]; setEditing({ ...editing, steps: st }); }}><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" aria-label="Move down" disabled={i === editing.steps.length - 1} className="btn px-1.5 hover:bg-hover disabled:opacity-30" onClick={() => { const st = [...editing.steps]; [st[i + 1], st[i]] = [st[i], st[i + 1]]; setEditing({ ...editing, steps: st }); }}><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" aria-label="Remove" disabled={editing.steps.length === 1} className="btn px-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-30" onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            {editing.steps.length < 10 && (
              <button type="button" className="btn-ghost" onClick={() => setEditing({ ...editing, steps: [...editing.steps, { templateId: templates[0]?.id ?? "", waitDays: 3 }] })}><Plus className="h-4 w-4" /> Add email</button>
            )}
            <label className="ml-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} className="h-4 w-4 accent-brand-600" /> Available to use</label>
            <button type="button" className="btn-primary ml-auto" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save sequence"}</button>
          </div>
          <p className="text-xs text-ink-3">Every email gets a short &ldquo;reply no thanks to stop&rdquo; line. Follow-ups are sent as replies in the same email thread. Sending stops as soon as the lead replies, the deal closes or a quote is accepted.</p>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2" data-tour="sequences">
        {sequences.map((s) => (
          <article key={s.id} className="card flex flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold">{s.name}</h3>
                {s.description && <p className="text-sm text-ink-2">{s.description}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!s.active && <span className="pill bg-line-soft text-ink-2">Off</span>}
                {canEdit && (
                  <button type="button" aria-label={`Edit ${s.name}`} className="btn px-2 hover:bg-hover" onClick={() => setEditing({ id: s.id, name: s.name, description: s.description ?? "", active: s.active, steps: s.steps.map((x) => ({ templateId: x.templateId, waitDays: x.waitDays })) })}>
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <ol className="mt-3 space-y-1.5">
              {s.steps.map((st, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-14 shrink-0 text-xs text-ink-3">Day {day(s.steps, i)}</span>
                  <Mail className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                  <span className="truncate">{st.templateName}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 grid grid-cols-5 gap-2 border-t border-line-soft pt-3 text-center text-xs">
              {[["Active", s.stats.active], ["Approval", s.stats.pending], ["Replied", s.stats.replied], ["Finished", s.stats.completed], ["Stopped", s.stats.stopped]].map(([k, v]) => (
                <div key={k}><div className={`text-lg font-semibold tabular-nums ${k === "Replied" && Number(v) > 0 ? "text-emerald-600" : ""}`}>{v}</div><div className="text-ink-3">{k}</div></div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
