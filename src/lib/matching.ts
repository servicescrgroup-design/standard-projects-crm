/** Free mail providers: a shared domain here says nothing about which company someone works for. */
const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "live.co.uk",
  "yahoo.com",
  "yahoo.co.uk",
  "icloud.com",
  "me.com",
  "aol.com",
  "btinternet.com",
  "sky.com",
  "virginmedia.com",
  "talktalk.net",
  "protonmail.com",
  "proton.me",
]);

export function isFreeMail(domain: string): boolean {
  return FREE_MAIL.has(domain.toLowerCase());
}

export type MatchableLead = { id: string; email: string | null; website: string | null };

export function normaliseEmail(raw: string): string | null {
  // Accepts "Jane Smith <jane@acme.co.uk>" as well as bare addresses.
  const m = raw.match(/<([^>]+)>/);
  const addr = (m ? m[1] : raw).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr) ? addr : null;
}

export function emailDomain(email: string): string {
  return email.split("@")[1] ?? "";
}

export function websiteDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = new URL(website.includes("://") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Finds the lead an email/meeting belongs to. Exact address match wins; otherwise a company
 * domain match (from the lead's email or website). Free-mail and internal domains never match
 * by domain. Ambiguous domain matches (several leads) are skipped rather than guessed.
 */
export function matchLead(
  addresses: string[],
  leads: MatchableLead[],
  internalDomains: string[] = [],
): MatchableLead | null {
  const internal = new Set(internalDomains.map((d) => d.toLowerCase()));
  const external = addresses
    .map(normaliseEmail)
    .filter((a): a is string => !!a && !internal.has(emailDomain(a)));
  if (external.length === 0) return null;

  for (const addr of external) {
    const exact = leads.find((l) => l.email && normaliseEmail(l.email) === addr);
    if (exact) return exact;
  }

  for (const addr of external) {
    const domain = emailDomain(addr);
    if (FREE_MAIL.has(domain)) continue;
    const hits = leads.filter((l) => {
      const leadEmailDomain = l.email ? emailDomain(normaliseEmail(l.email) ?? "") : null;
      return leadEmailDomain === domain || websiteDomain(l.website) === domain;
    });
    if (hits.length === 1) return hits[0];
  }
  return null;
}
