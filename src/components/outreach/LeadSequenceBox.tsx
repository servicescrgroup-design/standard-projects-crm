"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Square } from "lucide-react";
import { enrollAction, stopEnrollmentAction } from "@/app/outreachActions";
import { enrollmentLabel } from "@/lib/sequences";
import { localTimeLabel } from "@/lib/timezones";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toaster";

type Enrollment = { id: string; sequenceName: string; status: string; step: number; total: number; nextRunAt: string | null; stopReason: string | null };

/** On a lead: its sequences (with Stop) and "Start a sequence". */
export function LeadSequenceBox({ leadId, hasEmail, blockedReason = null, zone, restrictedCountry, sequences, enrollments, canSend }: {
  leadId: string;
  hasEmail: boolean;
  /** "They asked not to be emailed" etc.: no new sequences. */
  blockedReason?: string | null;
  /** The lead's time zone, to show when the next email lands for them. */
  zone?: string;
  restrictedCountry: string | null;
  sequences: { id: string; name: string }[];
  enrollments: Enrollment[];
  canSend: boolean;
}) {
  const router = useRouter();
  const [seq, setSeq] = useState("");
  const [override, setOverride] = useState(false);
  const [pending, start] = useTransition();
  const running = enrollments.some((e) => e.status === "ACTIVE" || e.status === "PENDING_APPROVAL");

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      toast(r.error ?? r.message ?? "Done", r.error ? "error" : "ok");
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Repeat className="h-4 w-4 text-brand-600" /> Sequence</h3>
      {enrollments.length > 0 && (
        <ul className="space-y-2">
          {enrollments.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <span className="font-medium">{e.sequenceName}</span>
              <span className={`pill ${e.status === "REPLIED" ? "bg-emerald-50 text-emerald-700" : e.status === "ACTIVE" ? "bg-brand-50 text-brand-700" : e.status === "PENDING_APPROVAL" ? "bg-amber-50 text-amber-700" : "bg-line-soft text-ink-2"}`}>{enrollmentLabel(e.status)}</span>
              <span className="text-xs text-ink-3">
                {Math.min(e.step, e.total)}/{e.total} sent
                {e.status === "ACTIVE" && e.nextRunAt && ` · next ${new Date(e.nextRunAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}${zone ? ` (${localTimeLabel(zone, new Date(e.nextRunAt))} their time)` : ""}`}
                {e.stopReason && e.status !== "REPLIED" && ` · ${e.stopReason}`}
              </span>
              {(e.status === "ACTIVE" || e.status === "PENDING_APPROVAL") && (
                <button type="button" disabled={pending} onClick={() => run(() => stopEnrollmentAction(e.id))} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">
                  <Square className="h-3 w-3" /> Stop
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!running && (
        blockedReason ? (
          <p className="text-sm text-ink-3">{blockedReason}, so sequences can&rsquo;t be started.</p>
        ) : hasEmail ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <div className="min-w-56 flex-1">
                <Select ariaLabel="Sequence" value={seq} placeholder="Choose a sequence…" onChange={setSeq} options={sequences.map((s) => ({ value: s.id, label: s.name }))} />
              </div>
              <button type="button" className="btn-primary" disabled={!seq || pending || (!!restrictedCountry && !override)} onClick={() => run(() => enrollAction(seq, [leadId], override))}>
                {canSend ? "Start sequence" : "Request sequence"}
              </button>
            </div>
            {restrictedCountry && (
              <label className="flex items-start gap-2 text-xs text-amber-800">
                <input type="checkbox" className="mt-0.5" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                This business is in {restrictedCountry}, where marketing email needs the business&rsquo;s consent. Tick only if they&rsquo;ve agreed to hear from you (for example on a call). This is saved on the lead as their consent.
              </label>
            )}
            {!canSend && <p className="text-xs text-ink-3">A manager approves it before the first email goes out.</p>}
          </div>
        ) : (
          <p className="text-sm text-ink-3">Add an email address to this lead to use sequences.</p>
        )
      )}
    </div>
  );
}
