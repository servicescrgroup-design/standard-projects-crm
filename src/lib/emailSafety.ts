/**
 * Keeping outreach safe: spotting "no thanks" replies and bounce-backs, and deciding when a lead must not be
 * emailed. Pure, unit-tested.
 */

export type EmailFlags = {
  email: string | null;
  emailOptOutAt: Date | null;
  emailBouncedAt: Date | null;
};

/** Why this lead can't be emailed, or null when it can. */
export function emailBlockReason(lead: EmailFlags): string | null {
  if (lead.emailOptOutAt) return "They asked not to be emailed";
  if (lead.emailBouncedAt) return "Their email address bounced";
  return null;
}

// Phrases that mean "stop emailing me", in the languages we write in. Checked only against the start of the
// reply (their own words, before any quoted email), so our own opt-out line further down never triggers it.
const OPT_OUT_PATTERNS = [
  /\bno,? thanks?\b/, /\bno,? thank you\b/, /\bnot interested\b/, /\bunsubscribe\b/, /\bremove (me|us)\b/, /\btake (me|us) off\b/,
  /\bstop (emailing|sending|contacting)\b/, /\bdo ?n[o']t (email|contact|write)\b/, /^stop\b/, /\bopt[ -]?out\b/,
  /\bnein,? danke\b/, /\bkein interesse\b/, /\babmelden\b/, /\bbitte keine (e-?mails?|werbung|nachrichten)\b/, /\bnicht interessiert\b/,
  /\bno,? gracias\b/, /\bno (me|nos) interesa\b/, /\bdarme de baja\b/,
  /\bno,? grazie\b/, /\bnon (mi|ci) interessa\b/, /\bcancellatemi\b/,
  /\bnon,? merci\b/, /\bpas intéress/, /\bdésabonner\b/, /\bdésinscri(re|vez)\b/,
  /ไม่สนใจ/, /ไม่ต้องส่ง/, /ยกเลิกการส่ง/, /ไม่ต้องการ/,
];

// Where a reply's quoted original starts ("On Mon, 3 Jun … wrote:", "Am … schrieb", "-----Original Message-----", "From:").
const QUOTE_START = /(\bon .{3,80}wrote:|\bam .{3,80}schrieb|\bel .{3,80}escribió|\bil .{3,80}scritto|\ble .{3,80}a écrit|-{3,}\s*original|^\s*from:|\n\s*from:|\n>)/i;

/** The reply's own words: lower-cased, before any quoted email, first 200 characters. */
export function replyLead(text: string): string {
  const cut = text.split(QUOTE_START)[0] ?? text;
  return cut.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200);
}

/** True when a reply says they don't want more emails. */
export function isOptOutReply(snippet: string, subject = ""): boolean {
  const own = replyLead(snippet);
  const subj = subject.toLowerCase().replace(/^(re|aw|antw|r|rif|rv|tr|fw|fwd|wg)\s*:\s*/g, "");
  return OPT_OUT_PATTERNS.some((p) => p.test(own)) || /^(unsubscribe|stop|remove me|abmelden)\b/.test(subj.trim());
}

const BOUNCE_SENDER = /(mailer-daemon|postmaster|mail delivery (subsystem|system)|microsoftexchange|maildelivery)/i;
const BOUNCE_SUBJECT =
  /(delivery status notification \(failure\)|undeliverable|undelivered mail|mail delivery failed|returned mail|delivery failure|failure notice|message not delivered|address not found|unzustellbar|nicht zustellbar|non recapitabile|no se puede entregar|non remis|échec de (la )?remise)/i;
// Temporary problems (full mailbox, server busy) that the sending server keeps retrying: not a bounce.
const TEMPORARY = /(\(delay\)|delayed|verzögert|will retry|will keep trying|temporar|mailbox (is )?full|over quota)/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export type BounceInput = { from: string; subject: string; snippet: string; failedRecipients?: string[] };

/**
 * If this message is a bounce-back, the addresses that failed and a short reason; otherwise null.
 * `ownAddress` (the mailbox) is never reported as failed.
 */
export function bounceInfo(m: BounceInput, ownAddress: string): { addresses: string[]; reason: string } | null {
  const looksLikeBounce = BOUNCE_SENDER.test(m.from) || BOUNCE_SUBJECT.test(m.subject);
  if (!looksLikeBounce || TEMPORARY.test(`${m.subject} ${m.snippet}`)) return null;
  const own = ownAddress.toLowerCase();
  const found = [...(m.failedRecipients ?? []), ...(`${m.snippet} ${m.subject}`.match(EMAIL_RE) ?? [])]
    .map((a) => a.toLowerCase().replace(/[.,;:>)]+$/, ""))
    .filter((a) => a !== own && !BOUNCE_SENDER.test(a));
  const addresses = [...new Set(found)];
  if (!addresses.length) return null;
  const reason = /does not exist|doesn't exist|not found|no such user|unknown user|user unknown|invalid recipient|nicht gefunden|existiert nicht/i.test(m.snippet)
    ? "The address doesn't exist"
    : /domain|dns|host not found|couldn't be found/i.test(m.snippet)
      ? "The email domain doesn't accept mail"
      : /blocked|rejected|spam|policy/i.test(m.snippet)
        ? "Their server rejected the email"
        : "The email couldn't be delivered";
  return { addresses, reason };
}

/** How someone agreed to receive emails (recorded as proof of consent). */
export const CONSENT_METHODS = [
  "They asked us to email them",
  "Agreed on a phone call",
  "Agreed in person",
  "Contacted us through our website",
  "Replied to us",
  "Existing customer",
] as const;

/** A syntactically plausible address (the MX check confirms the domain takes mail). */
export function looksLikeEmail(v: string | null | undefined): boolean {
  return !!v && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim());
}

export function emailDomain(v: string): string {
  return v.trim().toLowerCase().split("@")[1] ?? "";
}
