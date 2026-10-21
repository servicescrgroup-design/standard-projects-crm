import "server-only";
import { createHmac } from "node:crypto";
import { db } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";
import { sessionSecret } from "./session";
import { toE164 } from "../phone";

const API = "https://api.twilio.com/2010-04-01";

export type TwilioCreds = { accountSid: string; apiKeySid: string; apiKeySecret: string };

/** Secret for signing per-call claims (see src/lib/voice.ts). */
export function callSecret(): string {
  return createHmac("sha256", sessionSecret()).update("voice-call-v1").digest("base64url");
}

/** Where Twilio fetches call instructions. Must be publicly reachable, so it's the production site. */
export function voiceWebhookUrl(requestOrigin: string): string {
  const base =
    process.env.APP_URL?.replace(/\/+$/, "") ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : requestOrigin);
  return `${base}/api/voice/twiml`;
}

export class TwilioError extends Error {}

async function twilio<T>(creds: TwilioCreds, path: string, init: { method?: string; form?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(`${API}/Accounts/${creds.accountSid}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Basic ${Buffer.from(`${creds.apiKeySid}:${creds.apiKeySecret}`).toString("base64")}`,
      ...(init.form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init.form ? new URLSearchParams(init.form) : undefined,
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new TwilioError("Twilio didn't accept those details. Check the Account SID, API key SID and secret.");
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new TwilioError(`Twilio: ${(data as { message?: string }).message ?? res.status}`);
  return data;
}

export function validateCreds(input: { accountSid: string; apiKeySid: string; apiKeySecret: string }): string | null {
  if (!/^AC[0-9a-f]{32}$/i.test(input.accountSid)) return "The Account SID starts with AC and has 34 characters.";
  if (!/^SK[0-9a-f]{32}$/i.test(input.apiKeySid)) return "The API key SID starts with SK and has 34 characters.";
  if (input.apiKeySecret.length < 20) return "Paste the API key secret (shown once when you create the key).";
  return null;
}

/**
 * Checks the agent's Twilio details, confirms the caller ID belongs to their account, creates (or reuses)
 * the TwiML app pointing at this CRM, and stores everything (secret encrypted).
 */
export async function connectTwilio(
  userId: string,
  userName: string,
  input: TwilioCreds & { callerId: string; record: boolean },
  webhookUrl: string,
): Promise<{ callerId: string }> {
  const problem = validateCreds(input);
  if (problem) throw new TwilioError(problem);
  const callerId = toE164(input.callerId, "US");
  if (!callerId) throw new TwilioError("Enter your Twilio phone number in international format, e.g. +1 512 555 0100.");
  const creds: TwilioCreds = { accountSid: input.accountSid, apiKeySid: input.apiKeySid, apiKeySecret: input.apiKeySecret };

  const account = await twilio<{ status?: string }>(creds, ".json");
  if (account.status && account.status !== "active") throw new TwilioError(`That Twilio account is ${account.status}.`);

  const [owned, verified] = await Promise.all([
    twilio<{ incoming_phone_numbers?: unknown[] }>(creds, `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(callerId)}`),
    twilio<{ outgoing_caller_ids?: unknown[] }>(creds, `/OutgoingCallerIds.json?PhoneNumber=${encodeURIComponent(callerId)}`),
  ]);
  if (!owned.incoming_phone_numbers?.length && !verified.outgoing_caller_ids?.length) {
    throw new TwilioError(`${callerId} isn't a number in this Twilio account (bought or verified caller ID).`);
  }

  const existing = await db.twilioConnection.findUnique({ where: { userId } });
  let appSid: string | null = null;
  if (existing && existing.accountSid === creds.accountSid) {
    // Keep the existing app, just make sure it points here.
    try {
      await twilio(creds, `/Applications/${existing.appSid}.json`, { method: "POST", form: { VoiceUrl: webhookUrl, VoiceMethod: "POST" } });
      appSid = existing.appSid;
    } catch {
      appSid = null;
    }
  }
  if (!appSid) {
    const app = await twilio<{ sid: string }>(creds, "/Applications.json", {
      method: "POST",
      form: { FriendlyName: `Standard Projects CRM · ${userName}`.slice(0, 64), VoiceUrl: webhookUrl, VoiceMethod: "POST" },
    });
    appSid = app.sid;
  }

  const data = { accountSid: creds.accountSid, apiKeySid: creds.apiKeySid, apiKeySecret: encryptSecret(creds.apiKeySecret), appSid, callerId, record: input.record };
  await db.twilioConnection.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return { callerId };
}

/** Removes the CRM's TwiML app from the agent's Twilio account (best effort) and forgets the details. */
export async function disconnectTwilio(userId: string) {
  const c = await db.twilioConnection.findUnique({ where: { userId } });
  if (!c) return;
  try {
    await twilio({ accountSid: c.accountSid, apiKeySid: c.apiKeySid, apiKeySecret: decryptSecret(c.apiKeySecret) }, `/Applications/${c.appSid}.json`, { method: "DELETE" });
  } catch {
    /* already gone or key revoked */
  }
  await db.twilioConnection.delete({ where: { userId } });
}

export async function twilioCredsFor(userId: string) {
  const c = await db.twilioConnection.findUnique({ where: { userId } });
  if (!c) return null;
  return { ...c, apiKeySecret: decryptSecret(c.apiKeySecret) };
}
