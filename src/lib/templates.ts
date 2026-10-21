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

/** Added to every automated sequence email. */
export const OPT_OUT_LINE: Record<"en" | "th", string> = {
  en: "If you'd rather not hear from me again, just reply \"no thanks\" and I won't email you again.",
  th: "หากไม่ต้องการรับอีเมลจากเราอีก ตอบกลับว่า \"ไม่สนใจ\" ได้เลยครับ/ค่ะ แล้วเราจะไม่ส่งอีเมลมาอีก",
};
