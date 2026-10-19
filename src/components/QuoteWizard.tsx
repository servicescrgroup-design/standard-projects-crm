"use client";

import { useActionState, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { submitQuote } from "@/app/quote/actions";
import {
  QUOTE_BUDGETS,
  QUOTE_BUSINESS_TYPES,
  QUOTE_CONTACT_PREFS,
  QUOTE_LOCATIONS,
  QUOTE_SERVICES,
  QUOTE_TIMELINES,
  type Lang,
  type Option,
  type QuoteAnswers,
  type QuoteErrorCode,
} from "@/lib/quote";

type Field = keyof QuoteAnswers;

const T = {
  step: { en: "Step", th: "ขั้นตอนที่" },
  of: { en: "of", th: "จาก" },
  stepTitles: {
    en: ["What you need", "Your business", "Budget and timing", "Your details"],
    th: ["สิ่งที่ต้องการ", "ธุรกิจของคุณ", "งบประมาณและระยะเวลา", "ข้อมูลติดต่อ"],
  },
  q1: { en: "What can we help with?", th: "ให้เราช่วยเรื่องอะไรดี?" },
  q1hint: { en: "Pick all that apply.", th: "เลือกได้มากกว่าหนึ่งข้อ" },
  q2: { en: "What kind of business are you?", th: "ธุรกิจของคุณเป็นประเภทไหน?" },
  q3: { en: "How many locations?", th: "มีกี่สาขา?" },
  website: { en: "Current website (if you have one)", th: "เว็บไซต์ปัจจุบัน (ถ้ามี)" },
  q4: { en: "Roughly what budget do you have in mind?", th: "งบประมาณโดยประมาณเท่าไร?" },
  q5: { en: "When would you like to start?", th: "อยากเริ่มเมื่อไร?" },
  details: { en: "Anything else we should know? (optional)", th: "มีอะไรที่อยากให้เราทราบเพิ่มเติมไหม? (ไม่บังคับ)" },
  detailsPh: {
    en: "What's not working today, what must go live first, any deadline…",
    th: "ตอนนี้ติดปัญหาอะไร อะไรต้องใช้งานก่อน มีกำหนดเวลาไหม…",
  },
  q6: { en: "Where should we send your quote?", th: "ให้เราส่งใบเสนอราคาไปที่ไหน?" },
  name: { en: "Your name", th: "ชื่อของคุณ" },
  company: { en: "Business name", th: "ชื่อธุรกิจ" },
  email: { en: "Email", th: "อีเมล" },
  phone: { en: "Phone or LINE ID", th: "เบอร์โทรหรือ LINE ID" },
  reach: { en: "Best way to reach you", th: "ช่องทางที่สะดวกให้ติดต่อ" },
  privacy: { en: "We only use these details to reply to your request.", th: "เราใช้ข้อมูลนี้เพื่อตอบกลับคำขอของคุณเท่านั้น" },
  back: { en: "Back", th: "ย้อนกลับ" },
  next: { en: "Next", th: "ถัดไป" },
  send: { en: "Send my request", th: "ส่งคำขอ" },
  sending: { en: "Sending…", th: "กำลังส่ง…" },
  doneTitle: { en: "Thanks, we've got your request", th: "ขอบคุณ เราได้รับคำขอของคุณแล้ว" },
  doneText: {
    en: "We'll be in touch within one working day with next steps.",
    th: "เราจะติดต่อกลับภายในหนึ่งวันทำการ",
  },
  needBoth: { en: "Please answer both questions", th: "กรุณาตอบทั้งสองข้อ" },
  rateLimited: {
    en: "Too many requests from your connection. Please try again later.",
    th: "มีการส่งคำขอจากเครือข่ายของคุณมากเกินไป กรุณาลองใหม่ภายหลัง",
  },
} as const;

const ERRORS: Record<QuoteErrorCode, { en: string; th: string }> = {
  pickOne: { en: "Pick at least one option", th: "กรุณาเลือกอย่างน้อยหนึ่งข้อ" },
  pickBusiness: { en: "Pick your type of business", th: "กรุณาเลือกประเภทธุรกิจ" },
  pickLocations: { en: "Pick how many locations", th: "กรุณาเลือกจำนวนสาขา" },
  pickBudget: { en: "Pick a budget range", th: "กรุณาเลือกช่วงงบประมาณ" },
  pickTimeline: { en: "Pick a timeline", th: "กรุณาเลือกระยะเวลา" },
  name: { en: "Enter your name", th: "กรุณากรอกชื่อ" },
  company: { en: "Enter your business name", th: "กรุณากรอกชื่อธุรกิจ" },
  email: { en: "Enter a valid email", th: "กรุณากรอกอีเมลให้ถูกต้อง" },
  phoneNeeded: { en: "Add your phone number or LINE ID", th: "กรุณากรอกเบอร์โทรหรือ LINE ID" },
  tooLong: { en: "That's too long", th: "ข้อความยาวเกินไป" },
  pickContact: { en: "Pick how we should contact you", th: "กรุณาเลือกช่องทางติดต่อ" },
};

const STEP_FIELDS: Field[][] = [
  ["services"],
  ["businessType", "locations", "currentWebsite"],
  ["budget", "timeline", "details"],
  ["name", "company", "email", "phone", "contactPref"],
];

function Choice({
  name,
  option,
  lang,
  type,
  checked,
  onChange,
}: {
  name: string;
  option: Option;
  lang: Lang;
  type: "radio" | "checkbox";
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${
        checked ? "border-green-600 bg-green-50 text-green-900" : "border-white/80 bg-white/70 hover:bg-white/90"
      }`}
    >
      <input
        type={type}
        name={name}
        value={option.value}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-green-600"
      />
      <span lang={lang}>{lang === "th" ? option.th : option.value}</span>
    </label>
  );
}

function SubmitButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary px-6 py-2.5" disabled={pending}>
      {pending ? T.sending[lang] : T.send[lang]}
    </button>
  );
}

export function QuoteWizard({ initialLang }: { initialLang: Lang }) {
  const [state, action] = useActionState(submitQuote, {});
  const [lang, setLang] = useState<Lang>(initialLang);
  const [step, setStep] = useState(0);
  const [services, setServices] = useState<string[]>([]);
  const [single, setSingle] = useState<Record<string, string>>({ contactPref: "LINE" });
  const [stepError, setStepError] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Keep ?lang in the URL so the page heading (rendered on the server) switches too.
  function chooseLang(l: Lang) {
    setLang(l);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", l);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Server-side validation errors: jump back to the first step that has one.
  useEffect(() => {
    if (!state.errors) return;
    const first = STEP_FIELDS.findIndex((fields) => fields.some((f) => state.errors?.[f]));
    if (first >= 0) setStep(first);
  }, [state.errors]);

  const langSwitch = (
    <div className="flex justify-end gap-1 text-xs font-semibold" role="group" aria-label="Language">
      {(["en", "th"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => chooseLang(l)}
          className={`rounded-md px-2.5 py-1 ${lang === l ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
          lang={l}
        >
          {l === "en" ? "EN" : "ไทย"}
        </button>
      ))}
    </div>
  );

  if (state.ok) {
    return (
      <div className="py-10 text-center" lang={lang}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
          ✓
        </div>
        <h2 className="text-xl font-semibold">{T.doneTitle[lang]}</h2>
        <p className="mt-2 text-slate-600">{T.doneText[lang]}</p>
      </div>
    );
  }

  const fieldError = (f: Field) => {
    const code = state.errors?.[f];
    return code ? ERRORS[code][lang] : null;
  };

  function next() {
    const missing =
      (step === 0 && services.length === 0 && ERRORS.pickOne[lang]) ||
      (step === 1 && (!single.businessType || !single.locations) && T.needBoth[lang]) ||
      (step === 2 && (!single.budget || !single.timeline) && T.needBoth[lang]) ||
      "";
    setStepError(missing);
    if (!missing) setStep((s) => s + 1);
  }

  const radios = (name: string, options: Option[]) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <Choice
          key={o.value}
          type="radio"
          name={name}
          option={o}
          lang={lang}
          checked={single[name] === o.value}
          onChange={() => setSingle((s) => ({ ...s, [name]: o.value }))}
        />
      ))}
    </div>
  );

  return (
    <form action={action} noValidate lang={lang}>
      <input type="hidden" name="lang" value={lang} />
      <div className="mb-6">
        <div className="mb-3">{langSwitch}</div>
        <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
          <span>
            {T.step[lang]} {step + 1} {T.of[lang]} {STEP_FIELDS.length}
          </span>
          <span>{T.stepTitles[lang][step]}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100">
          <div
            className="h-1.5 rounded-full bg-green-600 transition-all"
            style={{ width: `${((step + 1) / STEP_FIELDS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Honeypot for bots; hidden from people and screen readers. */}
      <input type="text" name="fax" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <section hidden={step !== 0} className="space-y-3">
        <h2 className="text-lg font-semibold">{T.q1[lang]}</h2>
        <p className="text-sm text-slate-500">{T.q1hint[lang]}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {QUOTE_SERVICES.map((o) => (
            <Choice
              key={o.value}
              type="checkbox"
              name="services"
              option={o}
              lang={lang}
              checked={services.includes(o.value)}
              onChange={(c) => setServices((s) => (c ? [...s, o.value] : s.filter((x) => x !== o.value)))}
            />
          ))}
        </div>
        {fieldError("services") && <p className="text-sm text-rose-600">{fieldError("services")}</p>}
      </section>

      <section hidden={step !== 1} className="space-y-5">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{T.q2[lang]}</h2>
          {radios("businessType", QUOTE_BUSINESS_TYPES)}
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold">{T.q3[lang]}</h3>
          {radios("locations", QUOTE_LOCATIONS)}
        </div>
        <div>
          <label htmlFor="currentWebsite" className="label">
            {T.website[lang]}
          </label>
          <input id="currentWebsite" name="currentWebsite" className="input py-2.5" placeholder="yourbusiness.com" />
        </div>
      </section>

      <section hidden={step !== 2} className="space-y-5">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{T.q4[lang]}</h2>
          {radios("budget", QUOTE_BUDGETS)}
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold">{T.q5[lang]}</h3>
          {radios("timeline", QUOTE_TIMELINES)}
        </div>
        <div>
          <label htmlFor="details" className="label">
            {T.details[lang]}
          </label>
          <textarea id="details" name="details" rows={4} maxLength={4000} className="input" placeholder={T.detailsPh[lang]} />
        </div>
      </section>

      <section hidden={step !== 3} className="space-y-4">
        <h2 className="text-lg font-semibold">{T.q6[lang]}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["name", "text", "name"],
              ["company", "text", "organization"],
              ["email", "email", "email"],
              ["phone", "text", "tel"],
            ] as const
          ).map(([name, type, auto]) => (
            <div key={name}>
              <label htmlFor={name} className="label">
                {T[name][lang]}
              </label>
              <input id={name} name={name} type={type} autoComplete={auto} className="input py-2.5" />
              {fieldError(name) && <p className="mt-1 text-sm text-rose-600">{fieldError(name)}</p>}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{T.reach[lang]}</h3>
          {radios("contactPref", QUOTE_CONTACT_PREFS)}
        </div>
        <p className="text-xs text-slate-500">{T.privacy[lang]}</p>
      </section>

      {(stepError || state.error) && (
        <p className="mt-4 text-sm text-rose-600">{stepError || (state.error === "rateLimited" ? T.rateLimited[lang] : state.error)}</p>
      )}

      <div className="mt-6 flex items-center justify-between">
        {step > 0 ? (
          <button type="button" className="btn-ghost" onClick={() => setStep((s) => s - 1)}>
            {T.back[lang]}
          </button>
        ) : (
          <span />
        )}
        {step < STEP_FIELDS.length - 1 ? (
          <button type="button" className="btn-primary px-6 py-2.5" onClick={next}>
            {T.next[lang]}
          </button>
        ) : (
          <SubmitButton lang={lang} />
        )}
      </div>
    </form>
  );
}
