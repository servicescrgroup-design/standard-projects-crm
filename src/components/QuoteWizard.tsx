"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitQuote } from "@/app/quote/actions";
import {
  QUOTE_BUDGETS,
  QUOTE_BUSINESS_TYPES,
  QUOTE_CONTACT_PREFS,
  QUOTE_SERVICES,
  QUOTE_TEAM_SIZES,
  QUOTE_TIMELINES,
  type QuoteAnswers,
} from "@/lib/quote";

type Field = keyof QuoteAnswers;

const STEPS: { title: string; fields: Field[] }[] = [
  { title: "What do you need?", fields: ["services"] },
  { title: "About your business", fields: ["businessType", "teamSize", "currentWebsite"] },
  { title: "Budget and timing", fields: ["budget", "timeline", "details"] },
  { title: "Your details", fields: ["name", "company", "email", "phone", "contactPref"] },
];

function Choice({
  name,
  value,
  type,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  type: "radio" | "checkbox";
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${
        checked ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-blue-600"
      />
      {value}
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary px-6 py-2.5" disabled={pending}>
      {pending ? "Sending…" : "Send my request"}
    </button>
  );
}

export function QuoteWizard() {
  const [state, action] = useActionState(submitQuote, {});
  const [step, setStep] = useState(0);
  const [services, setServices] = useState<string[]>([]);
  const [single, setSingle] = useState<Record<string, string>>({ contactPref: "Email" });
  const [stepError, setStepError] = useState("");

  // Server-side validation errors: jump back to the first step that has one.
  useEffect(() => {
    if (!state.errors) return;
    const first = STEPS.findIndex((s) => s.fields.some((f) => state.errors?.[f]));
    if (first >= 0) setStep(first);
  }, [state.errors]);

  if (state.ok) {
    return (
      <div className="py-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
          ✓
        </div>
        <h2 className="text-xl font-semibold">Thanks, we&apos;ve got your request</h2>
        <p className="mt-2 text-slate-600">We&apos;ll be in touch within one working day with next steps.</p>
      </div>
    );
  }

  const fieldError = (f: Field) => state.errors?.[f];

  function next() {
    const missing =
      (step === 0 && services.length === 0 && "Pick at least one option") ||
      (step === 1 && (!single.businessType || !single.teamSize) && "Please answer both questions") ||
      (step === 2 && (!single.budget || !single.timeline) && "Please pick a budget and a timeline") ||
      "";
    setStepError(missing);
    if (!missing) setStep((s) => s + 1);
  }

  const radios = (name: string, options: readonly string[]) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <Choice
          key={o}
          type="radio"
          name={name}
          value={o}
          checked={single[name] === o}
          onChange={() => setSingle((s) => ({ ...s, [name]: o }))}
        />
      ))}
    </div>
  );

  return (
    <form action={action} noValidate>
      <div className="mb-6">
        <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span>{STEPS[step].title}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100">
          <div className="h-1.5 rounded-full bg-blue-600 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      {/* Honeypot for bots; hidden from people and screen readers. */}
      <input type="text" name="fax" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <section hidden={step !== 0} className="space-y-3">
        <h2 className="text-lg font-semibold">What can we help with?</h2>
        <p className="text-sm text-slate-500">Pick all that apply.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {QUOTE_SERVICES.map((o) => (
            <Choice
              key={o}
              type="checkbox"
              name="services"
              value={o}
              checked={services.includes(o)}
              onChange={(c) => setServices((s) => (c ? [...s, o] : s.filter((x) => x !== o)))}
            />
          ))}
        </div>
        {fieldError("services") && <p className="text-sm text-rose-600">{fieldError("services")}</p>}
      </section>

      <section hidden={step !== 1} className="space-y-5">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">What kind of business are you?</h2>
          {radios("businessType", QUOTE_BUSINESS_TYPES)}
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold">How big is your team?</h3>
          {radios("teamSize", QUOTE_TEAM_SIZES)}
        </div>
        <div>
          <label htmlFor="currentWebsite" className="label">
            Current website (if you have one)
          </label>
          <input id="currentWebsite" name="currentWebsite" className="input py-2.5" placeholder="yourcompany.co.uk" />
        </div>
      </section>

      <section hidden={step !== 2} className="space-y-5">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Roughly what budget do you have in mind?</h2>
          {radios(
            "budget",
            QUOTE_BUDGETS.map((b) => b.label),
          )}
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold">When would you like to start?</h3>
          {radios("timeline", QUOTE_TIMELINES)}
        </div>
        <div>
          <label htmlFor="details" className="label">
            Anything else we should know? (optional)
          </label>
          <textarea
            id="details"
            name="details"
            rows={4}
            maxLength={4000}
            className="input"
            placeholder="What's not working today, what you'd like to achieve, any must-haves…"
          />
        </div>
      </section>

      <section hidden={step !== 3} className="space-y-4">
        <h2 className="text-lg font-semibold">Where should we send your quote?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["name", "Your name", "text", "name"],
              ["company", "Company name", "text", "organization"],
              ["email", "Email", "email", "email"],
              ["phone", "Phone (optional)", "tel", "tel"],
            ] as const
          ).map(([name, label, type, auto]) => (
            <div key={name}>
              <label htmlFor={name} className="label">
                {label}
              </label>
              <input id={name} name={name} type={type} autoComplete={auto} className="input py-2.5" />
              {fieldError(name) && <p className="mt-1 text-sm text-rose-600">{fieldError(name)}</p>}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Best way to reach you</h3>
          {radios("contactPref", QUOTE_CONTACT_PREFS)}
        </div>
        <p className="text-xs text-slate-500">
          We only use these details to reply to your request.
        </p>
      </section>

      {(stepError || state.error) && <p className="mt-4 text-sm text-rose-600">{stepError || state.error}</p>}

      <div className="mt-6 flex items-center justify-between">
        {step > 0 ? (
          <button type="button" className="btn-ghost" onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn-primary px-6 py-2.5" onClick={next}>
            Next
          </button>
        ) : (
          <SubmitButton />
        )}
      </div>
    </form>
  );
}
