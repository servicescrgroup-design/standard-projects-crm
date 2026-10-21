import "server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "./session";

/**
 * Key for mailbox tokens: EMAIL_TOKEN_KEY (32 bytes, base64) if set, otherwise derived from the
 * session secret. If that underlying secret changes, connected mailboxes simply need reconnecting.
 */
function tokenKey(): Buffer {
  const explicit = process.env.EMAIL_TOKEN_KEY;
  if (explicit) {
    const key = Buffer.from(explicit, "base64");
    if (key.length === 32) return key;
  }
  return Buffer.from(hkdfSync("sha256", sessionSecret(), "spcrm", "mailbox-tokens-v1", 32));
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext>, base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(sealed: string): string {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unreadable token");
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** Signs a small JSON payload for a short-lived cookie (OAuth state). */
export function signPayload(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", sessionSecret()).update(`oauth.${body}`).digest("base64url");
  return `${body}.${mac}`;
}

export function readSignedPayload<T>(value: string | undefined): T | null {
  if (!value) return null;
  const [body, mac] = value.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", sessionSecret()).update(`oauth.${body}`).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
