/** Pure helpers for building and reading email (RFC 5322 / 2047). Unit-tested. */
import { normaliseEmail } from "../matching";

/** Header values must never carry line breaks (header injection). */
export function headerSafe(v: string): string {
  return v.replace(/[\r\n]+/g, " ").trim();
}

/** RFC 2047 encoding for non-ASCII header text. */
export function encodeHeader(v: string): string {
  const clean = headerSafe(v);
  return /^[\x20-\x7e]*$/.test(clean) ? clean : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

export function base64url(s: string | Buffer): string {
  return Buffer.from(s).toString("base64url");
}

/** "a@x.com, B <b@y.com>; c@z.com" → valid, de-duplicated lowercase addresses. */
export function parseAddressList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(/[,;]+/)) {
    const a = normaliseEmail(part);
    if (a && !out.includes(a)) out.push(a);
  }
  return out;
}

export function replySubject(subject: string): string {
  const s = headerSafe(subject) || "(no subject)";
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

export type MimeInput = {
  fromAddress: string;
  fromName: string;
  to: string[];
  subject: string;
  body: string;
  inReplyTo?: string | null; // Message-ID header of the email being answered
  references?: string | null;
  date?: Date;
};

/** A complete plain-text message, ready for Gmail's messages.send (as base64url "raw"). */
export function buildMime(m: MimeInput): string {
  const lines = [
    `From: ${encodeHeader(m.fromName)} <${headerSafe(m.fromAddress)}>`,
    `To: ${m.to.map(headerSafe).join(", ")}`,
    `Subject: ${encodeHeader(m.subject)}`,
    `Date: ${(m.date ?? new Date()).toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  if (m.inReplyTo) {
    lines.push(`In-Reply-To: ${headerSafe(m.inReplyTo)}`);
    lines.push(`References: ${headerSafe([m.references, m.inReplyTo].filter(Boolean).join(" "))}`);
  }
  const body = Buffer.from(m.body.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
  return `${lines.join("\r\n")}\r\n\r\n${body}`;
}

/** Decodes =?UTF-8?B?…?= / =?UTF-8?Q?…?= words in a received header. */
export function decodeHeader(v: string): string {
  return v.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_m, _cs, enc: string, text: string) => {
    try {
      if (enc.toUpperCase() === "B") return Buffer.from(text, "base64").toString("utf8");
      const bytes = text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_x, h: string) => String.fromCharCode(parseInt(h, 16)));
      return Buffer.from(bytes, "latin1").toString("utf8");
    } catch {
      return text;
    }
  });
}

/** HTML entities in Gmail snippets ("&#39;", "&amp;"). */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
