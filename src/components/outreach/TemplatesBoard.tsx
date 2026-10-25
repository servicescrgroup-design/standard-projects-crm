"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Wand2, X } from "lucide-react";
import { deleteTemplate, saveTemplate } from "@/app/outreachActions";
import { MERGE_FIELDS, OPT_OUT_LINE, TEMPLATE_LANGUAGES, languageInfo, rankTemplates, renderTemplate, starterTemplate, targetLabel, templateLanguage, type MergeContext } from "@/lib/templates";
import { COUNTRY_LIST, countryByName } from "@/lib/countries";
import { MultiSelect, Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toaster";
import type { TemplateView } from "./SequencesBoard";

const SAMPLE: MergeContext = Object.fromEntries(MERGE_FIELDS.map((f) => [f.key, f.example]));
type Draft = { id: string | null; name: string; category: string; language: string; subject: string; body: string; countries: string[]; industries: string[] };
const TYPES = ["Intro", "Follow-up", "Case study", "Proposal", "Break-up", "Other"];
const COUNTRY_OPTIONS = COUNTRY_LIST.map((c) => ({ value: c.name, label: `${c.flag} ${c.name}` }));

/**
 * Template list with an editor (merge-field buttons, live preview) and a creator that starts a template for a
 * country and industry. Agents then get the best-fitting template suggested on each lead's email form.
 */
export function TemplatesBoard({ templates, canEdit, industries }: { templates: TemplateView[]; canEdit: boolean; industries: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pending, start] = useTransition();
  const [maker, setMaker] = useState({ country: "", industry: "", category: "Intro" });
  const [show, setShow] = useState({ country: "", industry: "" });
  const industryOptions = industries.map((i) => ({ value: i, label: i }));
  const shown = show.country || show.industry
    ? rankTemplates(templates, { country: show.country || null, industry: show.industry || null }).filter((t) => t.fit >= 0)
    : templates;
  const exists = (c: string, i: string) =>
    templates.some((t) => (c ? t.countries.includes(c) : !t.countries.length) && (i ? t.industries.includes(i) : !t.industries.length));

  const create = () => {
    const st = starterTemplate({ country: maker.country || null, industry: maker.industry || null, category: maker.category });
    setEditing({ id: null, name: st.name, category: maker.category, language: st.language, subject: st.subject, body: st.body, countries: maker.country ? [maker.country] : [], industries: maker.industry ? [maker.industry] : [] });
  };
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
        <section className="card space-y-3 p-4" data-tour="template-creator">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><Wand2 className="h-4 w-4 text-brand-600" /> Template creator</h2>
            <p className="text-sm text-ink-2">Make a template for a country and industry. It starts in that country&rsquo;s language; edit it, save it, and your agents see it suggested on every matching lead, filled in with the lead&rsquo;s details.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px_auto] sm:items-end">
            <div><span className="label">Country</span><Select ariaLabel="Country" value={maker.country} onChange={(v) => setMaker({ ...maker, country: v })} options={[{ value: "", label: "Any country" }, ...COUNTRY_OPTIONS]} /></div>
            <div><span className="label">Industry</span><Select ariaLabel="Industry" value={maker.industry} onChange={(v) => setMaker({ ...maker, industry: v })} options={[{ value: "", label: "Any industry" }, ...industryOptions]} /></div>
            <div><span className="label">Type</span><Select ariaLabel="Type" value={maker.category} onChange={(v) => setMaker({ ...maker, category: v })} options={TYPES.map((c) => ({ value: c, label: c }))} /></div>
            <button type="button" className="btn-primary" onClick={create}><Plus className="h-4 w-4" /> Create template</button>
          </div>
          {(maker.country || maker.industry) && exists(maker.country, maker.industry) && (
            <p className="text-xs text-amber-700">There&rsquo;s already a template for this. You can still make another (e.g. a follow-up).</p>
          )}
        </section>
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
              <div><span className="label">Type</span><Select ariaLabel="Type" value={editing.category} onChange={(v) => setEditing({ ...editing, category: v })} options={TYPES.map((c) => ({ value: c, label: c }))} /></div>
              <div><span className="label">Language</span><Select ariaLabel="Language" value={editing.language} onChange={(v) => setEditing({ ...editing, language: v })} options={TEMPLATE_LANGUAGES.map((l) => ({ value: l.value, label: l.label }))} /></div>
              <div className="sm:col-span-3 grid gap-3 sm:grid-cols-2">
                <div><span className="label">For leads in</span><MultiSelect ariaLabel="Countries" placeholder="Any country" values={editing.countries} onChange={(v) => setEditing({ ...editing, countries: v })} options={COUNTRY_OPTIONS} /></div>
                <div><span className="label">In the industry</span><MultiSelect ariaLabel="Industries" placeholder="Any industry" values={editing.industries} onChange={(v) => setEditing({ ...editing, industries: v })} options={[...new Set([...industryOptions.map((o) => o.value), ...editing.industries])].map((i) => ({ value: i, label: i }))} /></div>
              </div>
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
              <span className="text-ink-3">{OPT_OUT_LINE[templateLanguage(editing.language)]} (sequence emails only)</span>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56"><span className="label">Show templates for</span><Select ariaLabel="Show templates for country" value={show.country} onChange={(v) => setShow({ ...show, country: v })} options={[{ value: "", label: "All countries" }, ...COUNTRY_OPTIONS]} /></div>
        <div className="w-56"><span className="label">&nbsp;</span><Select ariaLabel="Show templates for industry" value={show.industry} onChange={(v) => setShow({ ...show, industry: v })} options={[{ value: "", label: "All industries" }, ...industryOptions]} /></div>
        {(show.country || show.industry) && <p className="pb-2 text-xs text-ink-3">Best match first, as an agent would see them on a lead.</p>}
      </div>

      <div className="card divide-y divide-line-soft">
        {shown.length === 0 && <p className="px-4 py-6 text-sm text-ink-3">No templates fit yet. Use the template creator above.</p>}
        {shown.map((t) => (
          <div key={t.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t.name}</span>
                {t.category && <span className="chip">{t.category}</span>}
                <span className="chip">{languageInfo(t.language).label}</span>
                {t.countries.map((c) => <span key={c} className="chip bg-brand-50 text-brand-700">{countryByName(c)?.flag} {c}</span>)}
                {t.industries.map((i) => <span key={i} className="chip bg-amber-50 text-amber-800">{i}</span>)}
                {!targetLabel(t) && <span className="chip text-ink-3">Any lead</span>}
              </div>
              <p className="truncate text-sm text-ink-2">{t.subject}</p>
              <TemplateStats stats={t.stats} />
            </div>
            {canEdit && (
              <button type="button" aria-label={`Edit ${t.name}`} className="btn px-2 hover:bg-hover" onClick={() => setEditing({ id: t.id, name: t.name, category: t.category ?? "Other", language: t.language, subject: t.subject, body: t.body, countries: t.countries, industries: t.industries })}>
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** "24 sent · 5 replies (21%)". Green from 10% up, after enough sends to mean something. */
function TemplateStats({ stats }: { stats?: { sent: number; replied: number } | null }) {
  if (!stats?.sent) return <p className="text-xs text-ink-3">Not sent yet</p>;
  const rate = Math.round((stats.replied / stats.sent) * 100);
  const good = stats.sent >= 10 && rate >= 10;
  return (
    <p className="text-xs text-ink-3">
      {stats.sent} sent · <span className={good ? "font-medium text-emerald-700" : ""}>{stats.replied} {stats.replied === 1 ? "reply" : "replies"} ({rate}%)</span>
      {stats.sent < 10 && " · too early to judge"}
    </p>
  );
}
