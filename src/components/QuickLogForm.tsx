"use client";

import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { quickLog } from "@/app/actions";

type LeadOption = { id: string; company: string; contactName: string | null };

const TYPES = [
  { value: "CALL", label: "Call" },
  { value: "EMAIL_OUT", label: "Email" },
  { value: "VISIT", label: "Visit" },
  { value: "MEETING", label: "Meeting" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "NOTE", label: "Note" },
];

const CALL_OUTCOMES = [
  { value: "NO_ANSWER", label: "No answer" },
  { value: "VOICEMAIL", label: "Voicemail" },
  { value: "CONNECTED", label: "Spoke to them" },
  { value: "INTERESTED", label: "Interested" },
  { value: "NOT_INTERESTED", label: "Not interested" },
];

const FOLLOW_UPS = [
  { value: "", label: "Auto" },
  { value: "1", label: "Tomorrow" },
  { value: "3", label: "3 days" },
  { value: "7", label: "1 week" },
  { value: "14", label: "2 weeks" },
];

function Pills({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
            value === o.value
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-white/80 bg-white text-ink-2 hover:bg-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary w-full py-3 text-base sm:w-auto sm:py-2 sm:text-sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

/**
 * Minimal-typing activity logger. Stage and follow-up date update automatically from what's
 * logged (see stageRules.ts); the rep only overrides the follow-up when they want a specific date.
 */
export function QuickLogForm({
  leadId,
  leads,
  redirectTo,
  defaultType = "CALL",
}: {
  leadId?: string;
  leads?: LeadOption[];
  redirectTo?: string;
  defaultType?: string;
}) {
  const [type, setType] = useState(defaultType);
  const [outcome, setOutcome] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string>(leadId ?? "");
  const formRef = useRef<HTMLFormElement>(null);

  const matches = useMemo(() => {
    if (!leads || !search) return [];
    const q = search.toLowerCase();
    return leads
      .filter((l) => l.company.toLowerCase().includes(q) || l.contactName?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [leads, search]);
  const pickedLead = leads?.find((l) => l.id === picked);
  const needsOutcome = type === "CALL";
  const ready = !!picked && (!needsOutcome || !!outcome);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await quickLog(fd);
        // Clear for the next log (only reached when the action doesn't redirect).
        formRef.current?.reset();
        setOutcome("");
        setFollowUp("");
        setCustomDate("");
        if (!leadId) setPicked("");
      }}
      className="space-y-4"
    >
      <input type="hidden" name="leadId" value={picked} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="outcome" value={needsOutcome ? outcome : ""} />
      <input type="hidden" name="followUp" value={customDate || followUp} />
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      {!leadId && (
        <div>
          <label className="label">Who?</label>
          {pickedLead ? (
            <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5">
              <span className="font-medium">{pickedLead.company}</span>
              <button type="button" className="text-sm text-brand-700" onClick={() => setPicked("")}>
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                className="input py-3 text-base"
                placeholder="Search company or contact…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {matches.length > 0 && (
                <ul className="mt-1 divide-y divide-line-soft rounded-lg border border-line bg-white">
                  {matches.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2.5 text-left hover:bg-hover"
                        onClick={() => {
                          setPicked(l.id);
                          setSearch("");
                        }}
                      >
                        <span className="font-medium">{l.company}</span>
                        {l.contactName && <span className="ml-2 text-sm text-ink-3">{l.contactName}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      <div>
        <label className="label">What happened?</label>
        <Pills options={TYPES} value={type} onChange={setType} />
      </div>

      {needsOutcome && (
        <div>
          <label className="label">Outcome</label>
          <Pills options={CALL_OUTCOMES} value={outcome} onChange={setOutcome} />
        </div>
      )}

      <div>
        <label className="label">Note (optional)</label>
        <textarea name="summary" rows={2} className="input text-base sm:text-sm" placeholder="Key points, next step…" />
      </div>

      {outcome !== "NOT_INTERESTED" && (
        <div>
          <label className="label">Follow up</label>
          <div className="flex flex-wrap items-center gap-2">
            <Pills
              options={FOLLOW_UPS}
              value={customDate ? "custom" : followUp}
              onChange={(v) => {
                setFollowUp(v);
                setCustomDate("");
              }}
            />
            <input
              type="date"
              className="input w-auto py-1.5"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              aria-label="Pick a follow-up date"
            />
          </div>
          {!followUp && !customDate && (
            <p className="mt-1 text-xs text-ink-3">Auto uses the stage cadence (e.g. 7 days after a proposal).</p>
          )}
        </div>
      )}

      {ready ? <SaveButton /> : <button className="btn-primary w-full py-3 sm:w-auto sm:py-2" disabled>Save</button>}
    </form>
  );
}
