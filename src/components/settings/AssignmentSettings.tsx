"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveAssignmentAction } from "@/app/outreachActions";
import { MultiSelect, Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toaster";
import type { AssignmentSettings as Settings } from "@/lib/assignment";

/** Owner: hand new enquiries out automatically (rules by country / industry, then round-robin). */
export function AssignmentSettings({ initial, people, countries, industries, sources }: {
  initial: Settings;
  people: { id: string; name: string }[];
  countries: string[];
  industries: string[];
  sources: { value: string; label: string }[];
}) {
  const [s, setS] = useState<Settings>(initial);
  const [pending, start] = useTransition();
  const save = () => start(async () => { const r = await saveAssignmentAction(s); toast(r.error ?? r.message ?? "Saved", r.error ? "error" : "ok"); });
  const personOptions = people.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["OFF", "ROUND_ROBIN"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setS({ ...s, mode: m })} aria-pressed={s.mode === m} className={`rounded-full border px-4 py-1.5 text-sm ${s.mode === m ? "border-brand-600 bg-brand-50 font-medium text-brand-700" : "border-line text-ink-2 hover:bg-hover"}`}>
            {m === "OFF" ? "Off: I assign by hand" : "On: assign automatically"}
          </button>
        ))}
      </div>

      {s.mode === "ROUND_ROBIN" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="label">Take turns between</span>
              <MultiSelect ariaLabel="Rotation" placeholder="Choose people…" values={s.pool} onChange={(pool) => setS({ ...s, pool })} options={personOptions} />
            </div>
            <div>
              <span className="label">Which leads count as new enquiries</span>
              <MultiSelect ariaLabel="Sources" placeholder="Choose sources…" values={s.sources} onChange={(sources) => setS({ ...s, sources })} options={sources} />
            </div>
          </div>

          <div>
            <span className="label">Rules (checked first, top to bottom)</span>
            <ul className="space-y-2">
              {s.rules.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2 text-sm">
                  <span className="text-ink-2">If</span>
                  <div className="w-32"><Select ariaLabel="Field" value={r.field} onChange={(v) => setS({ ...s, rules: s.rules.map((x, j) => (j === i ? { ...x, field: v as "country" | "industry", value: "" } : x)) })} options={[{ value: "country", label: "Country" }, { value: "industry", label: "Industry" }]} /></div>
                  <span className="text-ink-2">is</span>
                  <div className="min-w-40 flex-1"><Select ariaLabel="Value" value={r.value} placeholder="Choose…" onChange={(v) => setS({ ...s, rules: s.rules.map((x, j) => (j === i ? { ...x, value: v } : x)) })} options={(r.field === "country" ? countries : industries).map((v) => ({ value: v, label: v }))} /></div>
                  <span className="text-ink-2">give it to</span>
                  <div className="min-w-40 flex-1"><Select ariaLabel="Person" value={r.userId} placeholder="Choose…" onChange={(v) => setS({ ...s, rules: s.rules.map((x, j) => (j === i ? { ...x, userId: v } : x)) })} options={personOptions} /></div>
                  <button type="button" aria-label="Remove rule" className="btn px-1.5 text-rose-600 hover:bg-rose-50" onClick={() => setS({ ...s, rules: s.rules.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-ghost mt-2" onClick={() => setS({ ...s, rules: [...s.rules, { field: "country", value: "", userId: "" }] })}><Plus className="h-4 w-4" /> Add rule</button>
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save assignment"}</button>
        <p className="text-xs text-ink-3">The new owner gets an alert straight away and a response timer on their Workspace. Only enquiries that arrive after you switch this on are assigned; imports are never touched.</p>
      </div>
    </div>
  );
}
