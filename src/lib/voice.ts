/**
 * Twilio browser calling, without the Twilio server SDK: access tokens (HS256 JWT with a voice grant),
 * signed call parameters, and the TwiML that dials the lead. Server-side only (uses node:crypto).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

/**
 * Twilio Access Token for the Voice JavaScript SDK. Signed with the agent's API key secret.
 * See https://www.twilio.com/docs/iam/access-tokens (header cty "twilio-fpa;v=1").
 */
export function voiceAccessToken(opts: {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  appSid: string;
  identity: string;
  ttlSeconds?: number;
  now?: number;
}): string {
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  const header = { typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" };
  const payload = {
    jti: `${opts.apiKeySid}-${now}`,
    iss: opts.apiKeySid,
    sub: opts.accountSid,
    iat: now,
    exp: now + (opts.ttlSeconds ?? 3600),
    // Same claims as Twilio's own AccessToken + VoiceGrant (outgoing only).
    grants: {
      identity: opts.identity,
      voice: { outgoing: { application_sid: opts.appSid } },
    },
  };
  const body = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  return `${body}.${createHmac("sha256", opts.apiKeySecret).update(body).digest("base64url")}`;
}

/**
 * The browser passes this with each call; the TwiML webhook only dials numbers carrying a valid,
 * unexpired signature made by this server, so nobody else can use the agent's Twilio account through it.
 */
export type CallClaim = { userId: string; leadId: string; to: string; exp: number };

export function signCall(claim: CallClaim, secret: string): string {
  const body = b64url(JSON.stringify(claim));
  return `${body}.${createHmac("sha256", secret).update(`call.${body}`).digest("base64url")}`;
}

export function verifyCall(token: string | null | undefined, secret: string, now = Date.now()): CallClaim | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret).update(`call.${body}`).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claim = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as CallClaim;
    if (typeof claim.exp !== "number" || claim.exp < now) return null;
    if (!/^\+\d{8,15}$/.test(claim.to)) return null;
    return claim;
  } catch {
    return null;
  }
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** TwiML: dial the lead from the agent's Twilio number, optionally recording both sides. */
export function dialTwiml(opts: { to: string; callerId: string; record: boolean }): string {
  const record = opts.record ? ' record="record-from-answer-dual"' : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${xml(opts.callerId)}" answerOnBridge="true" timeout="40"${record}><Number>${xml(opts.to)}</Number></Dial></Response>`;
}

export function rejectTwiml(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${xml(message)}</Say><Hangup/></Response>`;
}
