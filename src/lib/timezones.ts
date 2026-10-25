/**
 * A lead's time zone, worked out from its country and (for the big countries) its state or province, so
 * sequence emails land during the customer's working day rather than ours.
 */

const COUNTRY_ZONES: Record<string, string> = {
  Thailand: "Asia/Bangkok", "United Kingdom": "Europe/London", Ireland: "Europe/Dublin", Germany: "Europe/Berlin",
  Austria: "Europe/Vienna", Switzerland: "Europe/Zurich", Netherlands: "Europe/Amsterdam", Belgium: "Europe/Brussels",
  Luxembourg: "Europe/Luxembourg", France: "Europe/Paris", Spain: "Europe/Madrid", Portugal: "Europe/Lisbon", Italy: "Europe/Rome",
  Denmark: "Europe/Copenhagen", Sweden: "Europe/Stockholm", Norway: "Europe/Oslo", Finland: "Europe/Helsinki", Iceland: "Atlantic/Reykjavik",
  Japan: "Asia/Tokyo", Singapore: "Asia/Singapore", "Hong Kong": "Asia/Hong_Kong", China: "Asia/Shanghai", "South Korea": "Asia/Seoul",
  Taiwan: "Asia/Taipei", Malaysia: "Asia/Kuala_Lumpur", Vietnam: "Asia/Ho_Chi_Minh", Laos: "Asia/Vientiane", Cambodia: "Asia/Phnom_Penh",
  Myanmar: "Asia/Yangon", Indonesia: "Asia/Jakarta", Philippines: "Asia/Manila", India: "Asia/Kolkata", "United Arab Emirates": "Asia/Dubai",
  Israel: "Asia/Jerusalem", "South Africa": "Africa/Johannesburg", Brazil: "America/Sao_Paulo", Mexico: "America/Mexico_City",
  "New Zealand": "Pacific/Auckland",
  // Big countries: the most common zone when the state isn't known.
  "United States": "America/New_York", Canada: "America/Toronto", Australia: "Australia/Sydney",
};

const US_STATES: Record<string, string> = {
  // Eastern
  CT: "America/New_York", DE: "America/New_York", DC: "America/New_York", FL: "America/New_York", GA: "America/New_York",
  ME: "America/New_York", MD: "America/New_York", MA: "America/New_York", NH: "America/New_York", NJ: "America/New_York",
  NY: "America/New_York", NC: "America/New_York", OH: "America/New_York", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", VT: "America/New_York", VA: "America/New_York", WV: "America/New_York", MI: "America/Detroit",
  IN: "America/Indiana/Indianapolis", KY: "America/New_York",
  // Central
  AL: "America/Chicago", AR: "America/Chicago", IL: "America/Chicago", IA: "America/Chicago", KS: "America/Chicago",
  LA: "America/Chicago", MN: "America/Chicago", MS: "America/Chicago", MO: "America/Chicago", NE: "America/Chicago",
  ND: "America/Chicago", OK: "America/Chicago", SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago", WI: "America/Chicago",
  // Mountain
  AZ: "America/Phoenix", CO: "America/Denver", ID: "America/Boise", MT: "America/Denver", NM: "America/Denver", UT: "America/Denver", WY: "America/Denver",
  // Pacific and beyond
  CA: "America/Los_Angeles", NV: "America/Los_Angeles", OR: "America/Los_Angeles", WA: "America/Los_Angeles",
  AK: "America/Anchorage", HI: "Pacific/Honolulu",
};

const US_STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};

const CA_PROVINCES: Record<string, string> = {
  BC: "America/Vancouver", "british columbia": "America/Vancouver", AB: "America/Edmonton", alberta: "America/Edmonton",
  SK: "America/Regina", saskatchewan: "America/Regina", MB: "America/Winnipeg", manitoba: "America/Winnipeg",
  ON: "America/Toronto", ontario: "America/Toronto", QC: "America/Toronto", quebec: "America/Toronto", québec: "America/Toronto",
  NB: "America/Halifax", "new brunswick": "America/Halifax", NS: "America/Halifax", "nova scotia": "America/Halifax",
  PE: "America/Halifax", "prince edward island": "America/Halifax", NL: "America/St_Johns", newfoundland: "America/St_Johns",
};

const AU_STATES: Record<string, string> = {
  NSW: "Australia/Sydney", "new south wales": "Australia/Sydney", ACT: "Australia/Sydney", VIC: "Australia/Melbourne", victoria: "Australia/Melbourne",
  QLD: "Australia/Brisbane", queensland: "Australia/Brisbane", SA: "Australia/Adelaide", "south australia": "Australia/Adelaide",
  WA: "Australia/Perth", "western australia": "Australia/Perth", TAS: "Australia/Hobart", tasmania: "Australia/Hobart",
  NT: "Australia/Darwin", "northern territory": "Australia/Darwin",
};

// Cities that often appear without a state.
const CITY_ZONES: Record<string, string> = {
  "los angeles": "America/Los_Angeles", "san francisco": "America/Los_Angeles", seattle: "America/Los_Angeles", portland: "America/Los_Angeles",
  "san diego": "America/Los_Angeles", "las vegas": "America/Los_Angeles", denver: "America/Denver", phoenix: "America/Phoenix",
  chicago: "America/Chicago", houston: "America/Chicago", dallas: "America/Chicago", austin: "America/Chicago", "new orleans": "America/Chicago",
  vancouver: "America/Vancouver", calgary: "America/Edmonton", edmonton: "America/Edmonton", winnipeg: "America/Winnipeg",
  perth: "Australia/Perth", brisbane: "Australia/Brisbane", adelaide: "Australia/Adelaide", melbourne: "Australia/Melbourne", hobart: "Australia/Hobart", darwin: "Australia/Darwin",
};

/** IANA time zone for a lead. Unknown countries default to Bangkok (where most local leads are). */
export function timeZoneFor(country: string | null, location: string | null): string {
  const parts = (location ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  const lower = parts.map((p) => p.toLowerCase());
  for (const p of lower) if (CITY_ZONES[p]) return CITY_ZONES[p];
  const lookup = (table: Record<string, string>, key: string) => table[key] ?? table[key.toUpperCase()];
  if (country === "United States") {
    for (const p of parts) {
      const code = US_STATE_NAMES[p.toLowerCase()] ?? (/^[A-Z]{2}$/.test(p) ? p : /^([A-Z]{2})\s+\d{5}/.exec(p)?.[1]);
      if (code && US_STATES[code]) return US_STATES[code];
    }
  }
  if (country === "Canada") for (const p of parts) { const z = lookup(CA_PROVINCES, p.toLowerCase()) ?? CA_PROVINCES[p]; if (z) return z; }
  if (country === "Australia") for (const p of parts) { const z = lookup(AU_STATES, p.toLowerCase()) ?? AU_STATES[p]; if (z) return z; }
  return (country && COUNTRY_ZONES[country]) || "Asia/Bangkok";
}

/** Weekday (0 = Sunday) and minutes past midnight in a time zone. */
export function localClock(zone: string, at: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** "Tue 09:14" in the lead's own time zone. */
export function localTimeLabel(zone: string, at: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}
