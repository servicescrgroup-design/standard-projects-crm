/** Country detection from a free-text location ("Austin, TX, United States", "Nimman, Chiang Mai") plus flag emoji. */

const CODES: Record<string, string> = {
  thailand: "TH", "united states": "US", usa: "US", "u.s.a.": "US", us: "US", "united kingdom": "GB", uk: "GB", "great britain": "GB",
  england: "GB", scotland: "GB", wales: "GB", "northern ireland": "GB", germany: "DE", deutschland: "DE", australia: "AU",
  canada: "CA", ireland: "IE", "new zealand": "NZ", switzerland: "CH", austria: "AT", netherlands: "NL", "the netherlands": "NL",
  denmark: "DK", sweden: "SE", norway: "NO", finland: "FI", iceland: "IS", japan: "JP", france: "FR", italy: "IT", spain: "ES",
  portugal: "PT", belgium: "BE", luxembourg: "LU", singapore: "SG", "hong kong": "HK", china: "CN", "south korea": "KR", korea: "KR",
  taiwan: "TW", malaysia: "MY", vietnam: "VN", laos: "LA", cambodia: "KH", myanmar: "MM", indonesia: "ID", philippines: "PH",
  india: "IN", "united arab emirates": "AE", uae: "AE", israel: "IL", "south africa": "ZA", brazil: "BR", mexico: "MX",
};

const NAMES: Record<string, string> = {
  TH: "Thailand", US: "United States", GB: "United Kingdom", DE: "Germany", AU: "Australia", CA: "Canada", IE: "Ireland",
  NZ: "New Zealand", CH: "Switzerland", AT: "Austria", NL: "Netherlands", DK: "Denmark", SE: "Sweden", NO: "Norway", FI: "Finland",
  IS: "Iceland", JP: "Japan", FR: "France", IT: "Italy", ES: "Spain", PT: "Portugal", BE: "Belgium", LU: "Luxembourg", SG: "Singapore",
  HK: "Hong Kong", CN: "China", KR: "South Korea", TW: "Taiwan", MY: "Malaysia", VN: "Vietnam", LA: "Laos", KH: "Cambodia",
  MM: "Myanmar", ID: "Indonesia", PH: "Philippines", IN: "India", AE: "United Arab Emirates", IL: "Israel", ZA: "South Africa",
  BR: "Brazil", MX: "Mexico",
};

// Local leads often only name a Thai city or area.
export const THAI_PLACES = [
  "chiang mai", "chiangmai", "chiang rai", "chiangrai", "bangkok", "phuket", "pattaya", "krabi", "hua hin", "koh ", "samui", "nimman", "hang dong",
  "san sai", "mae rim", "saraphi", "doi ", "lamphun", "lampang", "nonthaburi", "khon kaen", "udon", "ayutthaya",
];
const THAI_SCRIPT = /[฀-๿]/;

export type Country = { code: string; name: string; flag: string };

export function flagOf(code: string): string {
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "";
}

/** The country a location refers to, or null when it can't be told. */
export function countryOf(location: string | null | undefined): Country | null {
  if (!location) return null;
  const parts = location.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  for (const part of [...parts].reverse()) {
    const code = CODES[part];
    if (code) return { code, name: NAMES[code], flag: flagOf(code) };
  }
  const lower = location.toLowerCase();
  if (THAI_SCRIPT.test(location) || THAI_PLACES.some((p) => lower.includes(p))) return { code: "TH", name: NAMES.TH, flag: flagOf("TH") };
  return null;
}

/** Every spelling that identifies this country at the end of a location ("United Kingdom", "UK", "England", …). */
export function countryAliases(name: string): string[] {
  const code = Object.entries(NAMES).find(([, n]) => n === name)?.[0];
  if (!code) return [name];
  return Object.entries(CODES).filter(([, c]) => c === code).map(([alias]) => alias);
}

// Free-text scan (e.g. Grok Bot's "plumbers | USA Seattle"). Skips "us", which is an ordinary word.
const TEXT_ALIASES = Object.keys(CODES)
  .filter((a) => a !== "us")
  .sort((a, b) => b.length - a.length);

function countryInText(text: string | null | undefined): Country | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const alias of TEXT_ALIASES) {
    const at = lower.search(new RegExp(`(^|[^a-z])${alias.replace(/[.]/g, "\\.")}([^a-z]|$)`));
    if (at >= 0) {
      const code = CODES[alias];
      return { code, name: NAMES[code], flag: flagOf(code) };
    }
  }
  return null;
}

/** International prefixes we can trust, plus Thai local mobiles (10 digits starting 06/08/09). */
const PHONE_PREFIX: [string, string][] = [
  ["+66", "TH"], ["+44", "GB"], ["+61", "AU"], ["+49", "DE"], ["+64", "NZ"], ["+353", "IE"], ["+41", "CH"], ["+43", "AT"],
  ["+31", "NL"], ["+45", "DK"], ["+46", "SE"], ["+47", "NO"], ["+81", "JP"], ["+33", "FR"], ["+39", "IT"], ["+34", "ES"], ["+65", "SG"],
];
function countryFromPhone(phone: string | null | undefined): Country | null {
  if (!phone) return null;
  const compact = phone.split(/[\/,;]/)[0].replace(/[^\d+]/g, "");
  const hit = PHONE_PREFIX.find(([p]) => compact.startsWith(p));
  const code = hit?.[1] ?? (/^0[689]\d{8}$/.test(compact) ? "TH" : null);
  return code ? { code, name: NAMES[code], flag: flagOf(code) } : null;
}

/** Best guess for a lead's country: its location, then country words in its industry/notes, then its phone number. */
export function countryOfLead(lead: { location?: string | null; industry?: string | null; phone?: string | null; company?: string | null }): Country | null {
  const thaiName = lead.company && (THAI_SCRIPT.test(lead.company) || THAI_PLACES.some((p) => lead.company!.toLowerCase().includes(p)));
  return (
    countryOf(lead.location) ??
    countryInText(lead.location) ??
    countryInText(lead.industry) ??
    countryFromPhone(lead.phone) ??
    (thaiName ? { code: "TH", name: NAMES.TH, flag: flagOf("TH") } : null)
  );
}
