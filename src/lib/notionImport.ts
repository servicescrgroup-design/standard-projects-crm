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

// ---------- Matching against leads already in the CRM ----------

export type ExistingLead = {
  id: string;
  company: string;
  phone: string | null;
  externalRef: string | null;
} & Partial<Record<keyof ImportedLead, unknown>>;

/** Thai numbers: compare the first 10 digits so "096 627 5499" and "0966275499" match. */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "").slice(0, 10);
  return digits.length >= 9 ? digits : null;
}

export function nameKey(company: string): string {
  return company.toLowerCase().replace(/\s+/g, " ").trim();
}

// Profile fields an import may fill in on an existing lead. Ownership, stage, dates and
// money the team has already entered are never overwritten.
const FILLABLE: (keyof ImportedLead)[] = [
  "contactName", "email", "phone", "socialLinks", "website", "address", "location", "industry", "segment",
  "serviceInterest", "priority", "sourceLink", "googleRating", "googleReviews", "whyFit", "needs",
  "offersToPitch", "caseStudies", "notes", "package", "lostReason",
];

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

/** What an import may change on an existing lead: the Notion link plus empty profile fields. */
export type LeadEnrichment = Partial<Omit<ImportedLead, "createdAt" | "nextFollowUpAt" | "lastContactAt" | "stage">>;

export type ImportPlan = {
  create: ImportedLead[];
  update: { id: string; data: LeadEnrichment }[];
  skipped: number; // already imported (same Notion page)
};

/**
 * Decides, per Notion row, whether to create a lead, enrich an existing one (matched by Notion page,
 * phone or company name, e.g. leads someone already typed in by hand), or skip it.
 */
export function planImport(rows: ImportedLead[], existing: ExistingLead[]): ImportPlan {
  const byRef = new Set(existing.map((e) => e.externalRef).filter(Boolean));
  const byPhone = new Map<string, ExistingLead>();
  const byName = new Map<string, ExistingLead>();
  for (const e of existing) {
    const p = phoneKey(e.phone);
    if (p && !byPhone.has(p)) byPhone.set(p, e);
    if (!byName.has(nameKey(e.company))) byName.set(nameKey(e.company), e);
  }

  const plan: ImportPlan = { create: [], update: [], skipped: 0 };
  const claimed = new Set<string>();
  for (const row of rows) {
    if (byRef.has(row.externalRef)) {
      plan.skipped++;
      continue;
    }
    const p = phoneKey(row.phone);
    const match = (p && byPhone.get(p)) || byName.get(nameKey(row.company));
    if (!match) {
      plan.create.push(row);
      byRef.add(row.externalRef);
      continue;
    }
    if (claimed.has(match.id) || match.externalRef) {
      // That lead is already linked to another Notion page (e.g. branches sharing one phone number),
      // so this row is a separate company: add it.
      plan.create.push(row);
      byRef.add(row.externalRef);
      continue;
    }
    claimed.add(match.id);
    const data: LeadEnrichment = { externalRef: row.externalRef };
    for (const k of FILLABLE) {
      if (isEmpty(match[k]) && !isEmpty(row[k])) (data as Record<string, unknown>)[k] = row[k];
    }
    plan.update.push({ id: match.id, data });
  }
  return plan;
}
