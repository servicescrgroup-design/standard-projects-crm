/** Phone number helpers shared by the call panel and the Twilio webhook. Pure, unit-tested. */

/** Country calling codes for the countries the CRM works with (ISO code → dial code). */
export const DIAL_CODES: Record<string, string> = {
  TH: "66", US: "1", CA: "1", GB: "44", DE: "49", AU: "61", NZ: "64", IE: "353", CH: "41", AT: "43", NL: "31",
  DK: "45", SE: "46", NO: "47", FI: "358", JP: "81", FR: "33", IT: "39", ES: "34", PT: "351", BE: "32",
  SG: "65", HK: "852", MY: "60", VN: "84", LA: "856", KH: "855", MM: "95", ID: "62", PH: "63", IN: "91", AE: "971",
};

/**
 * Converts what someone typed ("096 627 5499", "+1 (512) 555-0100", "0049 89 1234") to E.164 ("+66966275499").
 * Local numbers use the lead's country (Thailand when unknown). Returns null if it can't be a phone number,
 * e.g. a LINE ID.
 */
export function toE164(raw: string | null | undefined, countryCode = "TH"): string | null {
  if (!raw) return null;
  // Only the first number when several are listed ("061 419 6922 / 061 615 5853").
  const first = raw.split(/[\/,;]| or /i)[0].trim();
  if (!/\d/.test(first) || /[a-z]{3,}/i.test(first.replace(/ext\.?|x\s*\d+$/i, ""))) return null;
  let digits = first.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+")) {
    const n = digits.slice(1).replace(/\D/g, "");
    return n.length >= 8 && n.length <= 15 ? `+${n}` : null;
  }
  const dial = DIAL_CODES[countryCode] ?? DIAL_CODES.TH;
  // North America: 10 digits, or 11 starting with 1.
  if (dial === "1") {
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return digits.length === 10 ? `+1${digits}` : null;
  }
  const national = digits.replace(/^0+/, "");
  if (national.length < 7 || national.length > 12) return null;
  return `+${dial}${national}`;
}

/** "00:03:07" style call timer. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
