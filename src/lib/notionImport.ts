/**
 * Maps rows from the Notion "Customers CRM" database (Standard Projects) to CRM leads.
 * Pure and deterministic so it can be unit-tested and re-run: the Notion page URL is stored as
 * externalRef, so importing the same rows twice never creates duplicates.
 */

export type NotionCustomerRow = Record<string, unknown>;

export type ImportedLead = {
  externalRef: string;
  company: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  socialLinks: string | null;
  website: string | null;
  address: string | null;
  location: string | null;
  industry: string | null;
  segment: string | null;
  serviceInterest: string | null;
  priority: string | null;
  source: string;
  sourceLink: string | null;
  googleRating: number | null;
  googleReviews: number | null;
  whyFit: string | null;
  needs: string | null;
  offersToPitch: string[];
  caseStudies: string[];
  notes: string | null;
  budget: number;
  value: number;
  monthlyValue: number;
  package: string | null;
  lostReason: string | null;
  stage: string;
  nextFollowUpAt: Date | null;
  lastContactAt: Date | null;
  createdAt: Date | null;
};

const STAGE_MAP: Record<string, string> = {
  Lead: "NEW",
  Discovery: "MEETING_BOOKED",
  "Proposal Sent": "PROPOSAL_SENT",
  Negotiation: "NEGOTIATION",
  Won: "WON",
  "Maintenance Client": "MAINTENANCE",
  Lost: "LOST",
};

const SOURCE_MAP: Record<string, string> = {
  "Cold outreach": "COLD_OUTREACH",
  Referral: "REFERRAL",
  LINE: "LINE",
  Facebook: "FACEBOOK",
  Google: "GOOGLE",
  "Website inquiry": "WEBSITE",
};

const PRIORITIES = new Set(["A", "B", "C"]);

function text(row: NotionCustomerRow, key: string): string | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function num(row: NotionCustomerRow, key: string): number | null {
  const v = row[key];
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Baht amount → minor units (satang); missing or negative → 0. */
function bahtToMinor(row: NotionCustomerRow, key: string): number {
  const n = num(row, key);
  return n && n > 0 ? Math.round(n * 100) : 0;
}

function list(row: NotionCustomerRow, key: string): string[] {
  const v = row[key];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

function date(row: NotionCustomerRow, key: string): Date | null {
  const s = text(row, key);
  if (!s) return null;
  const d = new Date(s.length === 10 ? `${s}T09:00:00+07:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The Notion "Website" column holds either a URL or a research note such as
 * "none on Google listing". URLs go to `website`; notes are kept (they're a selling signal).
 */
export function splitWebsite(raw: string | null): { website: string | null; note: string | null } {
  if (!raw) return { website: null, note: null };
  const url = raw.match(/https?:\/\/[^\s;,)]+/i)?.[0] ?? null;
  const isPlainUrl = url !== null && raw.trim() === url;
  return { website: url, note: isPlainUrl ? null : raw };
}

/** Returns null for rows that can't become a lead (no page URL or no company name). */
export function mapNotionRow(row: NotionCustomerRow): ImportedLead | null {
  const externalRef = text(row, "url");
  const company = text(row, "Company");
  if (!externalRef || !company) return null;

  const email = text(row, "Email")?.toLowerCase() ?? null;
  const { website, note: websiteNote } = splitWebsite(text(row, "Website"));
  const priority = text(row, "Priority");
  const reviews = num(row, "Google reviews");
  const notes = [text(row, "Notes"), websiteNote && `Website: ${websiteNote}`].filter(Boolean).join("\n");

  return {
    externalRef,
    company: company.slice(0, 200),
    contactName: text(row, "Contact person"),
    email: email && EMAIL_RE.test(email) ? email : null,
    phone: text(row, "Phone or LINE ID"),
    socialLinks: text(row, "Social / LINE"),
    website,
    address: text(row, "Address"),
    location: text(row, "Area"),
    industry: text(row, "Industry"),
    segment: text(row, "Segment"),
    serviceInterest: text(row, "Niche"),
    priority: priority && PRIORITIES.has(priority) ? priority : null,
    source: SOURCE_MAP[text(row, "Source") ?? ""] ?? "COLD_OUTREACH",
    sourceLink: text(row, "Source link"),
    googleRating: num(row, "Google rating"),
    googleReviews: reviews === null ? null : Math.round(reviews),
    whyFit: text(row, "Why a fit"),
    needs: text(row, "Plan and needs"),
    offersToPitch: list(row, "Offers to pitch"),
    caseStudies: list(row, "Case studies to show"),
    notes: notes || null,
    budget: bahtToMinor(row, "Customer Budget (THB)"),
    value: bahtToMinor(row, "Quoted Price (THB)"),
    monthlyValue: bahtToMinor(row, "Monthly Care Plan (THB)"),
    package: text(row, "Package"),
    lostReason: text(row, "Lost reason"),
    stage: STAGE_MAP[text(row, "Stage") ?? ""] ?? "NEW",
    nextFollowUpAt: date(row, "date:Next follow-up:start"),
    lastContactAt: date(row, "date:Last contact:start"),
    createdAt: date(row, "createdTime"),
  };
}
