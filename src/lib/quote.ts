/** The public "Get a quote" questionnaire: options, validation, and how answers become a lead. */

export const QUOTE_SERVICES = [
  "New website",
  "Website redesign",
  "CRM / sales system",
  "Back-office / admin system",
  "Not sure yet",
] as const;

export const QUOTE_BUSINESS_TYPES = [
  "Construction & building",
  "Trades (electrical, plumbing, etc.)",
  "Landscaping & gardening",
  "Cleaning & facilities",
  "Other",
] as const;

export const QUOTE_TEAM_SIZES = ["Just me", "2–5 people", "6–20 people", "21+ people"] as const;

export const QUOTE_BUDGETS = [
  { label: "Under £1,000", estimatePence: 75_000 },
  { label: "£1,000 – £3,000", estimatePence: 200_000 },
  { label: "£3,000 – £7,500", estimatePence: 500_000 },
  { label: "£7,500+", estimatePence: 1_000_000 },
  { label: "Not sure yet", estimatePence: 0 },
] as const;

export const QUOTE_TIMELINES = ["As soon as possible", "Within 1–3 months", "In 3+ months", "Just exploring"] as const;

export const QUOTE_CONTACT_PREFS = ["Phone", "Email"] as const;

export type QuoteAnswers = {
  services: string[];
  businessType: string;
  teamSize: string;
  currentWebsite: string;
  budget: string;
  timeline: string;
  details: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  contactPref: string;
};

const oneOf = (list: readonly string[], v: string) => list.includes(v);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns field → message for anything invalid. Empty object means valid. */
export function validateQuote(a: QuoteAnswers): Partial<Record<keyof QuoteAnswers, string>> {
  const errors: Partial<Record<keyof QuoteAnswers, string>> = {};
  if (a.services.length === 0 || !a.services.every((s) => oneOf(QUOTE_SERVICES, s)))
    errors.services = "Pick at least one option";
  if (!oneOf(QUOTE_BUSINESS_TYPES, a.businessType)) errors.businessType = "Pick your type of business";
  if (!oneOf(QUOTE_TEAM_SIZES, a.teamSize)) errors.teamSize = "Pick your team size";
  if (!QUOTE_BUDGETS.some((b) => b.label === a.budget)) errors.budget = "Pick a budget range";
  if (!oneOf(QUOTE_TIMELINES, a.timeline)) errors.timeline = "Pick a timeline";
  if (!a.name.trim() || a.name.length > 120) errors.name = "Enter your name";
  if (!a.company.trim() || a.company.length > 160) errors.company = "Enter your company name";
  if (!EMAIL_RE.test(a.email.trim()) || a.email.length > 200) errors.email = "Enter a valid email";
  if (a.phone.length > 40) errors.phone = "That phone number looks too long";
  if (a.currentWebsite.length > 200) errors.currentWebsite = "That web address looks too long";
  if (a.details.length > 4000) errors.details = "Please keep this under 4,000 characters";
  if (!oneOf(QUOTE_CONTACT_PREFS, a.contactPref)) errors.contactPref = "Pick how we should contact you";
  return errors;
}

export function parseQuoteForm(fd: FormData): QuoteAnswers {
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  return {
    services: fd.getAll("services").map(String),
    businessType: s("businessType"),
    teamSize: s("teamSize"),
    currentWebsite: s("currentWebsite"),
    budget: s("budget"),
    timeline: s("timeline"),
    details: s("details"),
    name: s("name"),
    company: s("company"),
    email: s("email").toLowerCase(),
    phone: s("phone"),
    contactPref: s("contactPref"),
  };
}

/** The note logged on the lead, so whoever picks it up sees every answer in one place. */
export function quoteSummary(a: QuoteAnswers): string {
  return [
    "Quote request",
    `Needs: ${a.services.join(", ")}`,
    `Business: ${a.businessType} · Team: ${a.teamSize}`,
    `Budget: ${a.budget} · Timeline: ${a.timeline}`,
    a.currentWebsite && `Current website: ${a.currentWebsite}`,
    `Prefers: ${a.contactPref}${a.phone ? ` · ${a.phone}` : ""}`,
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
    value: QUOTE_BUDGETS.find((b) => b.label === a.budget)?.estimatePence ?? 0,
    source: "QUOTE",
  };
}
