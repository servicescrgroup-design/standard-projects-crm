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

// Providers with a domain per country (hotmail.co.th, yahoo.de, gmx.at, …).
const FREE_MAIL_FAMILIES = ["hotmail", "outlook", "live", "msn", "yahoo", "ymail", "gmx", "yandex", "aol", "icloud", "proton", "zoho", "fastmail", "tutanota"];

// More single-domain providers common in our markets (US, UK, EU, Australia, Thailand, Asia).
const MORE_FREE_MAIL = [
  "mail.com", "mac.com", "rocketmail.com", "comcast.net", "verizon.net", "att.net", "sbcglobal.net", "cox.net", "charter.net", "earthlink.net", "juno.com",
  "shaw.ca", "rogers.com", "sympatico.ca", "bigpond.com", "bigpond.net.au", "optusnet.com.au", "iinet.net.au", "xtra.co.nz", "eircom.net",
  "ntlworld.com", "blueyonder.co.uk", "web.de", "t-online.de", "freenet.de", "arcor.de", "posteo.de", "bluewin.ch", "orange.fr", "free.fr",
  "laposte.net", "wanadoo.fr", "sfr.fr", "libero.it", "virgilio.it", "tiscali.it", "alice.it", "telefonica.net", "terra.com", "qq.com",
  "163.com", "126.com", "naver.com", "daum.net", "hanmail.net", "hey.com", "pm.me", "tuta.io", "duck.com",
];
for (const d of MORE_FREE_MAIL) FREE_MAIL.add(d);

export function isFreeMail(domain: string): boolean {
  const d = domain.toLowerCase();
  return FREE_MAIL.has(d) || FREE_MAIL_FAMILIES.includes(d.split(".")[0]);
}

/**
 * Big platforms: a lead's "website" is often just its Google, Facebook or booking page, and these companies
 * send everyone notification emails. A shared domain here never identifies a lead.
 */
const PLATFORM = [
  "google", "goo.gl", "g.page", "youtube.com", "facebook.com", "fb.com", "fb.me", "messenger.com", "instagram.com", "threads.net", "whatsapp.com", "wa.me",
  "line.me", "lin.ee", "linktr.ee", "linkedin.com", "twitter.com", "x.com", "tiktok.com", "pinterest.com", "tripadvisor", "yelp", "booking.com", "agoda.com",
  "airbnb", "expedia", "hotels.com", "trip.com", "wongnai.com", "grab.com", "foodpanda", "lineman", "shopee", "lazada", "amazon", "apple.com", "microsoft.com",
  "yellowpages", "restaurantji.com", "bit.ly", "business.site", "wixsite.com", "squarespace.com", "notion.so", "canva.site",
];

export function isPlatformDomain(domain: string | null): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase();
  return PLATFORM.some((p) => (p.includes(".") ? d === p || d.endsWith(`.${p}`) : d.split(".").includes(p)));
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
    if (isFreeMail(domain) || isPlatformDomain(domain)) continue;
    const hits = leads.filter((l) => {
      const leadEmailDomain = l.email ? emailDomain(normaliseEmail(l.email) ?? "") : null;
      const site = websiteDomain(l.website);
      return leadEmailDomain === domain || (site === domain && !isPlatformDomain(site));
    });
    if (hits.length === 1) return hits[0];
  }
  return null;
}
