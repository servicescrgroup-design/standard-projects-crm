/** Email templates with merge fields ({{company}} …). Pure, unit-tested. */
import { countryOfLead } from "./countries";
import { websiteDomain } from "./matching";

export const MERGE_FIELDS = [
  { key: "first_name", label: "First name", example: "Ploy" },
  { key: "contact_name", label: "Contact name", example: "Khun Ploy" },
  { key: "company", label: "Company", example: "Green Leaf Spa" },
  { key: "city", label: "City / area", example: "Chiang Mai" },
  { key: "country", label: "Country", example: "Thailand" },
  { key: "website", label: "Website", example: "greenleafspa.com" },
  { key: "industry", label: "Industry", example: "Day spa" },
  { key: "why_fit", label: "Why they're a fit", example: "Facebook page only, 180 Google reviews" },
  { key: "pitch", label: "What to pitch", example: "New website" },
  { key: "agent_name", label: "Your name", example: "Richard" },
  { key: "agent_email", label: "Your email", example: "services.crgroup@gmail.com" },
] as const;
export type MergeKey = (typeof MERGE_FIELDS)[number]["key"];
export type MergeContext = Partial<Record<MergeKey, string>>;

export type LeadForMerge = {
  company: string;
  contactName: string | null;
  location: string | null;
  website: string | null;
  industry: string | null;
  segment: string | null;
  whyFit: string | null;
  serviceInterest: string | null;
  phone?: string | null;
};

/** "Khun Ploy Srisuk" → "Ploy"; titles like Khun/Mr/Dr are skipped. */
export function firstName(full: string | null | undefined): string {
  const words = (full ?? "").trim().split(/\s+/).filter(Boolean);
  const titles = /^(khun|k\.|mr\.?|mrs\.?|ms\.?|dr\.?|herr|frau|mme\.?|m\.)$/i;
  return words.find((w) => !titles.test(w)) ?? "";
}

export function leadMergeContext(lead: LeadForMerge, agent: { name: string; email: string }): MergeContext {
  const parts = (lead.location ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    first_name: firstName(lead.contactName),
    contact_name: lead.contactName ?? "",
    company: lead.company,
    city: parts[0] ?? "",
    country: countryOfLead(lead)?.name ?? "",
    website: websiteDomain(lead.website) ?? "",
    industry: lead.industry ?? lead.segment ?? "",
    why_fit: lead.whyFit ?? "",
    pitch: lead.serviceInterest ?? "a new website",
    agent_name: firstName(agent.name) || agent.name,
    agent_email: agent.email,
  };
}

/**
 * Replaces {{field}} and {{field|fallback}} (e.g. "Hi {{first_name|there}}"). Unknown or empty fields
 * use the fallback, or disappear. Lines that end up empty because of a missing field are dropped.
 */
export function renderTemplate(text: string, ctx: MergeContext): string {
  const out = text.replace(/\{\{\s*([a-z_]+)\s*(?:\|\s*([^}]*))?\}\}/gi, (_m, key: string, fallback?: string) => {
    const v = ctx[key.toLowerCase() as MergeKey];
    return v && v.trim() ? v : (fallback ?? "").trim();
  });
  return out.replace(/^[ \t]*[^\S\r\n]*\n(?=[ \t]*\n)/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Merge fields a template uses that this lead can't fill (to warn before sending). */
export function missingFields(text: string, ctx: MergeContext): MergeKey[] {
  const missing = new Set<MergeKey>();
  for (const m of text.matchAll(/\{\{\s*([a-z_]+)\s*(\|[^}]*)?\}\}/gi)) {
    const key = m[1].toLowerCase() as MergeKey;
    if (!m[2] && !(ctx[key] ?? "").trim()) missing.add(key);
  }
  return [...missing];
}

export type TemplateLanguage = "en" | "th" | "de";

export const TEMPLATE_LANGUAGES: { value: TemplateLanguage; label: string; short: string }[] = [
  { value: "en", label: "English", short: "EN" },
  { value: "th", label: "ภาษาไทย", short: "TH" },
  { value: "de", label: "Deutsch", short: "DE" },
];

/** A stored language code, falling back to English for anything unknown. */
export function templateLanguage(value: string | null | undefined): TemplateLanguage {
  return TEMPLATE_LANGUAGES.some((l) => l.value === value) ? (value as TemplateLanguage) : "en";
}

export function languageInfo(value: string | null | undefined) {
  return TEMPLATE_LANGUAGES.find((l) => l.value === templateLanguage(value))!;
}

/** Added to every automated sequence email. */
export const OPT_OUT_LINE: Record<TemplateLanguage, string> = {
  en: "If you'd rather not hear from me again, just reply \"no thanks\" and I won't email you again.",
  th: "หากไม่ต้องการรับอีเมลจากเราอีก ตอบกลับว่า \"ไม่สนใจ\" ได้เลยครับ/ค่ะ แล้วเราจะไม่ส่งอีเมลมาอีก",
  de: "Falls Sie keine weiteren E-Mails von mir wünschen, antworten Sie einfach mit „Nein danke“ – dann schreibe ich Ihnen nicht mehr.",
};

/** The language a template for this country is usually written in. */
export function languageForCountry(country: string | null | undefined): TemplateLanguage {
  if (country === "Thailand") return "th";
  if (country === "Germany" || country === "Austria" || country === "Switzerland") return "de";
  return "en";
}

export type TargetedTemplate = { countries: string[]; industries: string[] };
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * How well a template suits a lead: 3 = written for its country and industry, 2 = its country, 1 = its industry,
 * 0 = a general template, -1 = written for a different country or industry.
 */
export function templateFit(t: TargetedTemplate, lead: { country: string | null; industry: string | null }): number {
  const forCountry = t.countries.length > 0;
  const forIndustry = t.industries.length > 0;
  const countryOk = !forCountry || (!!lead.country && t.countries.some((c) => same(c, lead.country!)));
  const industryOk = !forIndustry || (!!lead.industry && t.industries.some((i) => same(i, lead.industry!)));
  if (!countryOk || !industryOk) return -1;
  return (forCountry ? 2 : 0) + (forIndustry ? 1 : 0);
}

/** Templates ordered best-first for a lead (ties keep their original order). */
export function rankTemplates<T extends TargetedTemplate>(templates: T[], lead: { country: string | null; industry: string | null }): (T & { fit: number })[] {
  return templates.map((t, i) => ({ ...t, fit: templateFit(t, lead), i })).sort((a, b) => b.fit - a.fit || a.i - b.i).map(({ i: _i, ...t }) => t as T & { fit: number });
}

/** "Germany · Restaurant", "All countries · Café", or "" for a general template. */
export function targetLabel(t: TargetedTemplate): string {
  if (!t.countries.length && !t.industries.length) return "";
  const c = t.countries.length ? t.countries.join(", ") : "All countries";
  return t.industries.length ? `${c} · ${t.industries.join(", ")}` : c;
}

type Starter = { subject: string; body: string };
const STARTERS: Record<TemplateLanguage, Record<string, (industry: string) => Starter>> = {
  en: {
    Intro: (ind) => ({
      subject: "Quick idea for {{company}}'s website",
      body: `Hi {{first_name|there}},\n\nI came across {{company}} while looking at ${ind ? ind.toLowerCase() + " businesses" : "businesses"} in {{city|your area}}.\n\nWe're Standard Projects, a small studio that builds fast, mobile-friendly websites${ind ? ` for ${ind.toLowerCase()} businesses` : ""}: online booking or enquiry forms, and showing up properly on Google and Google Maps.\n\nWould a free 15-minute call next week be useful? I can share a few ideas specific to {{company}}.\n\nBest regards,\n{{agent_name}}\nStandard Projects · standardprojects.org`,
    }),
    "Follow-up": (ind) => ({
      subject: "Re: Quick idea for {{company}}'s website",
      body: `Hi {{first_name|there}},\n\nJust bringing this back to the top of your inbox. Happy to send a couple of example sites we've built for ${ind ? ind.toLowerCase() + " businesses" : "businesses like yours"} if that's easier than a call.\n\n{{agent_name}}`,
    }),
  },
  de: {
    Intro: (ind) => ({
      subject: "Kurze Idee zur Website von {{company}}",
      body: `Guten Tag,\n\nich bin auf {{company}} gestoßen und habe mir Ihren Online-Auftritt angesehen.\n\nWir sind Standard Projects, ein kleines Studio für schnelle, mobilfreundliche Websites${ind ? ` – auch für Betriebe im Bereich ${ind}` : ""}: mit Online-Buchung oder Kontaktformular und besserer Sichtbarkeit bei Google und Google Maps.\n\nHätten Sie nächste Woche Zeit für ein kostenloses, 15-minütiges Gespräch? Gern auch auf Englisch.\n\nMit freundlichen Grüßen\n{{agent_name}}\nStandard Projects · standardprojects.org`,
    }),
    "Follow-up": () => ({
      subject: "Re: Kurze Idee zur Website von {{company}}",
      body: `Guten Tag,\n\nich wollte meine letzte Nachricht kurz wieder nach oben holen. Gern schicke ich Ihnen ein paar Beispiele von Websites, die wir für ähnliche Unternehmen umgesetzt haben.\n\nViele Grüße\n{{agent_name}}`,
    }),
  },
  th: {
    Intro: (ind) => ({
      subject: "ไอเดียเว็บไซต์สำหรับ {{company}}",
      body: `สวัสดีครับ/ค่ะ คุณ{{first_name|ผู้ดูแล}}\n\nทาง Standard Projects ได้เห็น {{company}}${ind ? ` (${ind})` : ""} และคิดว่าเว็บไซต์ที่ดีจะช่วยให้ลูกค้าหาร้านเจอและจองได้ง่ายขึ้น\n\nสะดวกคุยสั้นๆ 15 นาทีในสัปดาห์หน้าไหมครับ/คะ? ไม่มีค่าใช้จ่ายและไม่มีข้อผูกมัด\n\nขอบคุณครับ/ค่ะ\n{{agent_name}}\nStandard Projects · standardprojects.org`,
    }),
    "Follow-up": () => ({
      subject: "Re: ไอเดียเว็บไซต์สำหรับ {{company}}",
      body: `สวัสดีครับ/ค่ะ คุณ{{first_name|ผู้ดูแล}}\n\nขออนุญาตติดตามอีเมลก่อนหน้านี้ หากสะดวก เราสามารถส่งตัวอย่างเว็บไซต์ที่เคยทำให้ธุรกิจคล้ายกันไปให้ดูก่อนได้เลยครับ/ค่ะ\n\n{{agent_name}}`,
    }),
  },
};

/** A first draft for a new country/industry template, in that country's language. */
export function starterTemplate(opts: { country: string | null; industry: string | null; category: string }): Starter & { language: TemplateLanguage; name: string } {
  const language = languageForCountry(opts.country);
  const make = STARTERS[language][opts.category] ?? STARTERS[language].Intro;
  const name = [opts.category, opts.country, opts.industry].filter(Boolean).join(" – ");
  return { ...make(opts.industry ?? ""), language, name };
}
