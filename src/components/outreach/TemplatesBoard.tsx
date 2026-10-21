"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { deleteTemplate, saveTemplate } from "@/app/outreachActions";
import { MERGE_FIELDS, OPT_OUT_LINE, renderTemplate, type MergeContext } from "@/lib/templates";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toaster";
import type { TemplateView } from "./SequencesBoard";

const SAMPLE: MergeContext = Object.fromEntries(MERGE_FIELDS.map((f) => [f.key, f.example]));
type Draft = { id: string | null; name: string; category: string; language: string; subject: string; body: string };

/** Template list with an editor: merge-field buttons and a live preview filled with a sample lead. */
export function TemplatesBoard({ templates, canEdit }: { templates: TemplateView[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pending, start] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const preview = useMemo(() => (editing ? { subject: renderTemplate(editing.subject, SAMPLE), body: renderTemplate(editing.body, SAMPLE) } : null), [editing]);

  const insert = (key: string) => {
    if (!editing) return;
    const el = bodyRef.current;
    const token = key === "first_name" ? "{{first_name|there}}" : `{{${key}}}`;
    if (!el) return setEditing({ ...editing, body: editing.body + token });
    const at = el.selectionStart ?? editing.body.length;
    const body = editing.body.slice(0, at) + token + editing.body.slice(el.selectionEnd ?? at);
    setEditing({ ...editing, body });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(at + token.length, at + token.length); });
  };

  return (
    <div className="space-y-4">
      {canEdit && !editing && (
        <button type="button" className="btn-primary" onClick={() => setEditing({ id: null, name: "", category: "Intro", language: "en", subject: "", body: "Hi {{first_name|there}},\n\n\n\nBest regards,\n{{agent_name}}" })}>
          <Plus className="h-4 w-4" /> New template
        </button>
      )}

      {editing && preview && (
        <section className="card grid gap-5 p-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{editing.id ? "Edit template" : "New template"}</h2>
              <button type="button" aria-label="Close" className="btn px-2 text-ink-2 hover:bg-hover" onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="sm:col-span-3"><span className="label">Name</span><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
              <div><span className="label">Type</span><Select ariaLabel="Type" value={editing.category} onChange={(v) => setEditing({ ...editing, category: v })} options={["Intro", "Follow-up", "Case study", "Proposal", "Break-up", "Other"].map((c) => ({ value: c, label: c }))} /></div>
              <div><span className="label">Language</span><Select ariaLabel="Language" value={editing.language} onChange={(v) => setEditing({ ...editing, language: v })} options={[{ value: "en", label: "English" }, { value: "th", label: "ภาษาไทย" }]} /></div>
            </div>
            <label className="block"><span className="label">Subject</span><input className="input" value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} /></label>
            <div>
              <span className="label">Insert a field (it&rsquo;s filled in for each lead)</span>
              <div className="flex flex-wrap gap-1.5">
                {MERGE_FIELDS.map((f) => (
                  <button key={f.key} type="button" onClick={() => insert(f.key)} className="chip hover:bg-brand-50 hover:text-brand-700">{f.label}</button>
                ))}
              </div>
            </div>
            <label className="block"><span className="label">Message</span><textarea ref={bodyRef} className="input min-h-72 font-[inherit]" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></label>
            <p className="text-xs text-ink-3">Tip: <code>{"{{first_name|there}}"}</code> writes &ldquo;there&rdquo; when the lead has no contact name. Lines whose field is empty are left out.</p>
            <div className="flex gap-2">
              <button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => { const r = await saveTemplate(editing); toast(r.error ?? r.message ?? "Saved", r.error ? "error" : "ok"); if (!r.error) { setEditing(null); router.refresh(); } })}>
                {pending ? "Saving…" : "Save template"}
              </button>
              {editing.id && (
                <button type="button" className="btn-ghost text-rose-600" disabled={pending} onClick={() => confirm("Delete this template?") && start(async () => { const r = await deleteTemplate(editing.id!); toast(r.error ?? r.message ?? "Deleted", r.error ? "error" : "ok"); if (!r.error) { setEditing(null); router.refresh(); } })}>
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Preview with a sample lead</p>
            <p className="mt-3 text-sm"><span className="text-ink-3">Subject: </span><b>{preview.subject || "—"}</b></p>
            <div className="mt-3 whitespace-pre-line rounded-lg border border-line bg-white p-4 text-sm leading-relaxed">
              {preview.body}
              {"\n\n"}
              <span className="text-ink-3">{OPT_OUT_LINE[editing.language === "th" ? "th" : "en"]} (sequence emails only)</span>
            </div>
          </div>
        </section>
      )}

      <div className="card divide-y divide-line-soft">
        {templates.map((t) => (
          <div key={t.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t.name}</span>
                {t.category && <span className="chip">{t.category}</span>}
                <span className="chip">{t.language === "th" ? "ภาษาไทย" : "English"}</span>
              </div>
              <p className="truncate text-sm text-ink-2">{t.subject}</p>
            </div>
            {canEdit && (
              <button type="button" aria-label={`Edit ${t.name}`} className="btn px-2 hover:bg-hover" onClick={() => setEditing({ id: t.id, name: t.name, category: t.category ?? "Other", language: t.language, subject: t.subject, body: t.body })}>
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
