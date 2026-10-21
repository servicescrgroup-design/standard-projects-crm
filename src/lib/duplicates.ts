/** Spotting a lead that's already in the CRM before adding it again. Pure, unit-tested. */
import { normaliseEmail, websiteDomain } from "./matching";

export type DupCandidate = { company?: string | null; phone?: string | null; email?: string | null; website?: string | null };
export type DupExisting = { id: string; company: string; phone: string | null; email: string | null; website: string | null };

/** Last 9 digits, so "+66 96 627 5499", "096-627-5499" and "0966275499" match. */
export function phoneDigits(phone: string | null | undefined): string | null {
  const d = (phone ?? "").split(/[\/,;]/)[0].replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-9) : null;
}

/** "The Green-Leaf Spa Co., Ltd." → "green leaf spa" */
export function companyKey(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(the|co|company|ltd|limited|llc|inc|gmbh|plc|pty|bv|ag|sa|srl|corp|corporation)\b\.?/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export type DupMatch = { id: string; company: string; why: string[] };

export function findDuplicates(c: DupCandidate, existing: DupExisting[], limit = 5): DupMatch[] {
  const phone = phoneDigits(c.phone);
  const email = c.email ? normaliseEmail(c.email) : null;
  const domain = websiteDomain(c.website ?? null);
  const name = companyKey(c.company);
  const out: DupMatch[] = [];
  for (const e of existing) {
    const why: string[] = [];
    if (phone && phoneDigits(e.phone) === phone) why.push("same phone");
    if (email && e.email && normaliseEmail(e.email) === email) why.push("same email");
    if (domain && websiteDomain(e.website) === domain) why.push("same website");
    if (name.length >= 4 && companyKey(e.company) === name) why.push("same name");
    if (why.length) out.push({ id: e.id, company: e.company, why });
    if (out.length >= limit) break;
  }
  return out;
}
