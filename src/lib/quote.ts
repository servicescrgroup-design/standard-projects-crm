/**
 * The public "Get a quote" questionnaire for Standard Projects (Chiang Mai): options in English and
 * Thai, validation, and how answers become a lead. Answers are stored in English (the `value`) so the
 * CRM reads the same whichever language the customer used.
 */

export type Lang = "en" | "th";
export type Option = { value: string; th: string };

export const QUOTE_SERVICES: Option[] = [
  { value: "Website", th: "เว็บไซต์" },
  { value: "Business system (POS, stock, consignment, bookings)", th: "ระบบธุรกิจ (POS สต็อก ฝากขาย การจอง)" },
  { value: "Staff, HR & rewards tools", th: "เครื่องมือสำหรับพนักงาน HR และระบบรางวัล" },
  { value: "AI workflow automation", th: "ระบบงานอัตโนมัติด้วย AI" },
  { value: "Improve something I already have", th: "ปรับปรุงเว็บไซต์หรือระบบที่มีอยู่" },
  { value: "Not sure yet", th: "ยังไม่แน่ใจ" },
];

export const QUOTE_BUSINESS_TYPES: Option[] = [
  { value: "Retail", th: "ค้าปลีก" },
  { value: "Hospitality & wellness", th: "บริการและเวลเนส" },
  { value: "Rental & booking", th: "เช่าและจอง" },
  { value: "Export & trade", th: "ส่งออกและการค้า" },
  { value: "Other", th: "อื่นๆ" },
];

export const QUOTE_LOCATIONS: Option[] = [
  { value: "Online only", th: "ออนไลน์เท่านั้น" },
  { value: "1 location", th: "1 สาขา" },
  { value: "2–3 locations", th: "2–3 สาขา" },
  { value: "4+ locations", th: "4 สาขาขึ้นไป" },
];

/** estimateMinor is a mid-range guess in satang, used only to rank the lead in the CRM. */
export const QUOTE_BUDGETS: (Option & { estimateMinor: number })[] = [
  { value: "Under ฿30,000", th: "ต่ำกว่า ฿30,000", estimateMinor: 2_000_000 },
  { value: "฿30,000 – ฿80,000", th: "฿30,000 – ฿80,000", estimateMinor: 5_500_000 },
  { value: "฿80,000 – ฿200,000", th: "฿80,000 – ฿200,000", estimateMinor: 14_000_000 },
  { value: "฿200,000+", th: "฿200,000 ขึ้นไป", estimateMinor: 25_000_000 },
  { value: "Not sure yet", th: "ยังไม่แน่ใจ", estimateMinor: 0 },
];

export const QUOTE_TIMELINES: Option[] = [
  { value: "As soon as possible", th: "เร็วที่สุด" },
  { value: "Within 1–3 months", th: "ภายใน 1–3 เดือน" },
  { value: "In 3+ months", th: "มากกว่า 3 เดือน" },
  { value: "Just exploring", th: "กำลังศึกษาข้อมูล" },
];

export const QUOTE_CONTACT_PREFS: Option[] = [
  { value: "LINE", th: "LINE" },
  { value: "Phone", th: "โทรศัพท์" },
  { value: "Email", th: "อีเมล" },
];

export type QuoteAnswers = {
  services: string[];
  businessType: string;
  locations: string;
  currentWebsite: string;
  budget: string;
  timeline: string;
  details: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  contactPref: string;
  lang: Lang;
};

export type QuoteErrorCode =
  | "pickOne"
  | "pickBusiness"
  | "pickLocations"
  | "pickBudget"
  | "pickTimeline"
  | "name"
  | "company"
  | "email"
  | "phoneNeeded"
  | "tooLong"
  | "pickContact";

const has = (list: Option[], v: string) => list.some((o) => o.value === v);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns field → error code for anything invalid (codes are translated in the UI). Empty means valid. */
export function validateQuote(a: QuoteAnswers): Partial<Record<keyof QuoteAnswers, QuoteErrorCode>> {
  const e: Partial<Record<keyof QuoteAnswers, QuoteErrorCode>> = {};
  if (a.services.length === 0 || !a.services.every((s) => has(QUOTE_SERVICES, s))) e.services = "pickOne";
  if (!has(QUOTE_BUSINESS_TYPES, a.businessType)) e.businessType = "pickBusiness";
  if (!has(QUOTE_LOCATIONS, a.locations)) e.locations = "pickLocations";
  if (!has(QUOTE_BUDGETS, a.budget)) e.budget = "pickBudget";
  if (!has(QUOTE_TIMELINES, a.timeline)) e.timeline = "pickTimeline";
  if (!a.name.trim() || a.name.length > 120) e.name = "name";
  if (!a.company.trim() || a.company.length > 160) e.company = "company";
  if (!EMAIL_RE.test(a.email.trim()) || a.email.length > 200) e.email = "email";
  if (!has(QUOTE_CONTACT_PREFS, a.contactPref)) e.contactPref = "pickContact";
  else if (a.contactPref !== "Email" && !a.phone.trim()) e.phone = "phoneNeeded";
  if (a.phone.length > 60) e.phone = "tooLong";
  if (a.currentWebsite.length > 200) e.currentWebsite = "tooLong";
  if (a.details.length > 4000) e.details = "tooLong";
  return e;
}

export function parseQuoteForm(fd: FormData): QuoteAnswers {
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  return {
    services: fd.getAll("services").map(String),
    businessType: s("businessType"),
    locations: s("locations"),
    currentWebsite: s("currentWebsite"),
    budget: s("budget"),
    timeline: s("timeline"),
    details: s("details"),
    name: s("name"),
    company: s("company"),
    email: s("email").toLowerCase(),
    phone: s("phone"),
    contactPref: s("contactPref"),
    lang: s("lang") === "th" ? "th" : "en",
  };
}

/** The note logged on the lead, so whoever picks it up sees every answer in one place. */
export function quoteSummary(a: QuoteAnswers): string {
  const reach = a.contactPref === "LINE" ? `LINE: ${a.phone}` : a.contactPref === "Phone" ? `Phone: ${a.phone}` : "Email";
  return [
    `Quote request${a.lang === "th" ? " (filled in Thai)" : ""}`,
    `Needs: ${a.services.join(", ")}`,
    `Business: ${a.businessType} · ${a.locations}`,
    `Budget: ${a.budget} · Timeline: ${a.timeline}`,
    a.currentWebsite && `Current website: ${a.currentWebsite}`,
    `Prefers: ${reach}`,
    a.details && `\n${a.details}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Lead fields from a valid quote. The budget becomes an estimated value so the Today queue ranks it. */
export function quoteToLead(a: QuoteAnswers) {
  return {
    company: a.company.trim(),
    contactName: a.name.trim(),
    email: a.email.trim().toLowerCase(),
    phone: a.phone || null,
    website: a.currentWebsite || null,
    industry: a.businessType,
    serviceInterest: a.services.join(", "),
    value: QUOTE_BUDGETS.find((b) => b.value === a.budget)?.estimateMinor ?? 0,
    source: "QUOTE",
  };
}
