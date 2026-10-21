/**
 * Maps researched international prospects (imports/intl-leads/SPEC.md format) to CRM leads.
 * Pure so it can be unit-tested. externalRef is derived from the website domain (or name + city +
 * country when there is no site), so uploading the same file twice never creates duplicates.
 */
import type { ImportedLead } from "./notionImport";
import { nameKey } from "./notionImport";
import { domainOf } from "./reports";

export type ResearchRow = Record<string, unknown>;

const STATUS_NEED: Record<string, { interest: string; need: string }> = {
  none: { interest: "New website", need: "No website yet" },
  outdated: { interest: "Website redesign", need: "Outdated website" },
  "no-english": { interest: "English website", need: "No English version of their website" },
};

// Practical outreach guidance per country (not legal advice): where unsolicited B2B email is
// restricted, the lead is marked to be called or contacted via its contact form first.
const EMAIL_RESTRICTED = new Set(["Germany", "Austria"]);
const CONSENT_LIGHT = new Set(["Australia", "Canada", "New Zealand", "Japan"]);

export function outreachNote(country: string | null): string {
  if (country && EMAIL_RESTRICTED.has(country)) {
    return "Outreach: call or use their contact form first. Unsolicited marketing email to businesses in " + country + " needs prior consent.";
  }
  if (country && CONSENT_LIGHT.has(country)) {
    return "Outreach: email only their published business address, about their website, with your name, company and an unsubscribe line.";
  }
  return "Outreach: email OK. Include your company name, address and a clear unsubscribe line.";
}

const str = (row: ResearchRow, key: string): string | null => {
  const v = row[key];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.toLowerCase() !== "null" ? t.slice(0, 1000) : null;
};
const num = (row: ResearchRow, key: string): number | null => {
  const v = typeof row[key] === "string" ? Number(row[key]) : row[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRIORITIES = new Set(["A", "B", "C"]);

/** True when the uploaded rows look like research rows rather than a Notion export. */
export function isResearchFile(rows: ResearchRow[]): boolean {
  const first = rows.find((r) => r && typeof r === "object");
  return !!first && "websiteStatus" in first && "company" in first && "country" in first;
}

export function researchRef(row: { website: string | null; company: string; city: string | null; country: string | null }): string {
  const d = domainOf(row.website);
  return d ? `research:${d}` : `research:${nameKey(row.company)}|${(row.city ?? "").toLowerCase()}|${(row.country ?? "").toLowerCase()}`;
}

export function mapResearchRow(row: ResearchRow): ImportedLead | null {
  const company = str(row, "company");
  if (!company) return null;
  const website = str(row, "website");
  const country = str(row, "country");
  const city = str(row, "city");
  const region = str(row, "region");
  const status = STATUS_NEED[str(row, "websiteStatus") ?? ""] ?? STATUS_NEED.outdated;
  const email = str(row, "email");
  const priority = str(row, "priority")?.toUpperCase() ?? null;
  const rating = num(row, "googleRating");
  const reviews = num(row, "googleReviews");

  return {
    externalRef: researchRef({ website, company, city, country }),
    company,
    contactName: null,
    email: email && EMAIL_RE.test(email) ? email.toLowerCase() : null,
    phone: str(row, "phone"),
    socialLinks: str(row, "socialLinks"),
    website,
    address: str(row, "address"),
    location: [city, region, country].filter(Boolean).join(", ") || null,
    industry: str(row, "industry"),
    segment: str(row, "niche"),
    serviceInterest: status.interest,
    priority: priority && PRIORITIES.has(priority) ? priority : "B",
    source: "COLD_OUTREACH",
    sourceLink: str(row, "sourceLink"),
    googleRating: rating !== null && rating >= 0 && rating <= 5 ? rating : null,
    googleReviews: reviews !== null && reviews >= 0 ? Math.round(reviews) : null,
    whyFit: str(row, "whyFit"),
    needs: status.need,
    offersToPitch: [status.interest],
    caseStudies: [],
    notes: outreachNote(country),
    budget: 0,
    value: 0,
    monthlyValue: 0,
    package: null,
    lostReason: null,
    stage: "NEW",
    nextFollowUpAt: null,
    lastContactAt: null,
    createdAt: null,
  };
}

export type ExistingForResearch = { company: string; website: string | null; externalRef: string | null };

/** New prospects only: skips anything already in the CRM by reference or website domain. */
export function planResearchImport(rows: ImportedLead[], existing: ExistingForResearch[]): { create: ImportedLead[]; skipped: number } {
  const refs = new Set(existing.map((e) => e.externalRef).filter(Boolean));
  const domains = new Set(existing.map((e) => domainOf(e.website)).filter(Boolean));
  const create: ImportedLead[] = [];
  let skipped = 0;
  for (const r of rows) {
    const d = domainOf(r.website);
    if (refs.has(r.externalRef) || (d && domains.has(d))) {
      skipped++;
      continue;
    }
    create.push(r);
    refs.add(r.externalRef);
    if (d) domains.add(d);
  }
  return { create, skipped };
}
