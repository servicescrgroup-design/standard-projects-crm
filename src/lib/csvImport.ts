/**
 * Maps rows from a spreadsheet (CSV) to CRM leads. Column names are matched loosely
 * ("Company", "Company name", "Business" …). Pure, so it can be unit-tested.
 */
import type { ImportedLead } from "./notionImport";
import { nameKey } from "./notionImport";
import { isPriority, isSource, isStage, toMinor } from "./domain";
import { normaliseEmail, websiteDomain } from "./matching";

const ALIASES: Record<string, string[]> = {
  company: ["company", "company name", "business", "business name", "organisation", "organization", "name"],
  contactName: ["contact", "contact name", "contact person", "full name", "person"],
  email: ["email", "e-mail", "email address"],
  phone: ["phone", "phone number", "telephone", "tel", "mobile"],
  website: ["website", "web", "url", "site", "homepage"],
  location: ["location", "city", "area", "region"],
  address: ["address", "street address"],
  industry: ["industry", "category", "type"],
  segment: ["segment", "niche"],
  priority: ["priority"],
  source: ["source", "lead source"],
  stage: ["stage", "status"],
  notes: ["notes", "note", "comments"],
  whyFit: ["why fit", "why", "reason"],
  value: ["value", "deal value", "amount"],
  country: ["country"],
};

const norm = (s: string) => s.toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();

export function columnMap(headers: string[]): Partial<Record<keyof typeof ALIASES, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const [field, names] of Object.entries(ALIASES)) {
    const hit = headers.find((h) => names.some((n) => norm(n) === norm(h)));
    if (hit) out[field] = hit;
  }
  return out;
}

export function csvRef(company: string, email: string | null, website: string | null): string {
  const d = websiteDomain(website);
  return `csv:${d ?? email ?? nameKey(company)}`;
}

export function mapCsvRows(rows: Record<string, string>[]): ImportedLead[] {
  if (rows.length === 0) return [];
  const cols = columnMap(Object.keys(rows[0]));
  const get = (r: Record<string, string>, f: keyof typeof ALIASES) => {
    const v = cols[f] ? r[cols[f]!]?.trim() : "";
    return v ? v.slice(0, 1000) : null;
  };
  const out: ImportedLead[] = [];
  for (const r of rows) {
    const company = get(r, "company");
    if (!company) continue;
    const email = normaliseEmail(get(r, "email") ?? "");
    const website = get(r, "website");
    const priority = get(r, "priority")?.toUpperCase() ?? null;
    const source = get(r, "source")?.toUpperCase().replace(/\s+/g, "_") ?? null;
    const stage = get(r, "stage")?.toUpperCase().replace(/\s+/g, "_") ?? null;
    const location = [get(r, "location"), get(r, "country")].filter(Boolean).join(", ") || null;
    out.push({
      externalRef: csvRef(company, email, website),
      company,
      contactName: get(r, "contactName"),
      email,
      phone: get(r, "phone"),
      socialLinks: null,
      website,
      address: get(r, "address"),
      location,
      industry: get(r, "industry"),
      segment: get(r, "segment"),
      serviceInterest: null,
      priority: priority && isPriority(priority) ? priority : null,
      source: source && isSource(source) ? source : "MANUAL",
      sourceLink: null,
      googleRating: null,
      googleReviews: null,
      whyFit: get(r, "whyFit"),
      needs: null,
      offersToPitch: [],
      caseStudies: [],
      notes: get(r, "notes"),
      budget: 0,
      value: toMinor(get(r, "value") ?? ""),
      monthlyValue: 0,
      package: null,
      lostReason: null,
      stage: stage && isStage(stage) ? stage : "NEW",
      nextFollowUpAt: null,
      lastContactAt: null,
      createdAt: null,
    });
  }
  return out;
}
