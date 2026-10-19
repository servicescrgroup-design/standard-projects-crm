import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const MIN_PASSWORD_LENGTH = 10;
export const SESSION_DAYS = 30;
export const INVITE_DAYS = 7;
/** Failed sign-ins allowed per email in the throttle window before sign-in is blocked. */
export const MAX_FAILED_LOGINS = 8;
export const LOGIN_WINDOW_MINUTES = 15;

/** scrypt with a random salt, stored as "scrypt$<salt>$<hash>" (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  return null;
}

function hmac(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/**
 * Session cookie value: "<userId>.<expiresMs>.<pwStamp>.<signature>". The password stamp is a
 * short hash of the current password hash, so changing a password signs out every old session.
 */
export function signSession(userId: string, passwordHash: string, secret: string, now = Date.now()): string {
  const exp = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const body = `${userId}.${exp}.${passwordStamp(passwordHash)}`;
  return `${body}.${hmac(body, secret)}`;
}

export function passwordStamp(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 12);
}

/** Returns the session's user id and password stamp if the signature is valid and unexpired. */
export function readSession(token: string | undefined, secret: string, now = Date.now()) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, expRaw, stamp, sig] = parts;
  const expected = Buffer.from(hmac(`${userId}.${expRaw}.${stamp}`, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!(Number(expRaw) > now)) return null;
  return { userId, stamp };
}

/** One-time invite token. The raw token goes in the link; only its hash is stored. */
export function newInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
