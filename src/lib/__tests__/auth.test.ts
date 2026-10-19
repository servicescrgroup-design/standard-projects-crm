import { describe, expect, it } from "vitest";
import {
  hashPassword,
  hashToken,
  newInviteToken,
  passwordProblem,
  readSession,
  signSession,
  verifyPassword,
} from "../auth";

const SECRET = "test-secret-test-secret-test-secret";

describe("passwords", () => {
  it("verifies the right password and rejects others", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("wrong password!!", stored)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "garbage")).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("enforces a minimum length", () => {
    expect(passwordProblem("short")).toMatch(/at least/);
    expect(passwordProblem("long enough pass")).toBeNull();
  });
});

describe("sessions", () => {
  const now = 1_800_000_000_000;

  it("round-trips a valid session", () => {
    const token = signSession("user1", "hash-a", SECRET, now);
    expect(readSession(token, SECRET, now + 1000)?.userId).toBe("user1");
  });

  it("rejects tampering, wrong secret and expiry", () => {
    const token = signSession("user1", "hash-a", SECRET, now);
    expect(readSession(token.replace("user1", "user2"), SECRET, now)).toBeNull();
    expect(readSession(token, "another-secret-another-secret", now)).toBeNull();
    expect(readSession(token, SECRET, now + 31 * 24 * 3600 * 1000)).toBeNull();
    expect(readSession("nonsense", SECRET, now)).toBeNull();
    expect(readSession(undefined, SECRET, now)).toBeNull();
  });

  it("stamps the password so a password change invalidates old sessions", () => {
    const a = readSession(signSession("u", "hash-a", SECRET, now), SECRET, now);
    const b = readSession(signSession("u", "hash-b", SECRET, now), SECRET, now);
    expect(a?.stamp).not.toBe(b?.stamp);
  });
});

describe("invite tokens", () => {
  it("stores only a hash", () => {
    const { token, tokenHash } = newInviteToken();
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).not.toContain(token);
  });
});
