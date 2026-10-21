import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const store = new Map<string, Record<string, unknown>>();
vi.mock("../server/db", () => ({
  db: {
    twilioConnection: {
      findUnique: async ({ where }: { where: { userId: string } }) => store.get(where.userId) ?? null,
      upsert: async ({ where, create, update }: { where: { userId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const row = store.has(where.userId) ? { ...store.get(where.userId), ...update } : create;
        store.set(where.userId, row);
        return row;
      },
      delete: async ({ where }: { where: { userId: string } }) => store.delete(where.userId),
    },
  },
}));
vi.mock("../server/crypto", () => ({ encryptSecret: (s: string) => `enc(${s})`, decryptSecret: (s: string) => s.replace(/^enc\((.*)\)$/, "$1") }));
vi.mock("../server/session", () => ({ sessionSecret: () => "test-session-secret-0123456789" }));

const { connectTwilio, disconnectTwilio, validateCreds } = await import("../server/twilio");

const creds = { accountSid: `AC${"1".repeat(32)}`, apiKeySid: `SK${"2".repeat(32)}`, apiKeySecret: "s".repeat(32), callerId: "+1 512 555 0100", record: false };
type Call = { url: string; method: string; auth: string | null; body: string | null };
let calls: Call[];

function mockTwilio(opts: { owned?: boolean; verified?: boolean; status?: number } = {}) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, method: init?.method ?? "GET", auth: headers.authorization ?? null, body: init?.body ? String(init.body) : null });
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
    if (opts.status) return json({ message: "Authenticate" }, opts.status);
    if (url.endsWith(`/Accounts/${creds.accountSid}.json`)) return json({ status: "active" });
    if (url.includes("/IncomingPhoneNumbers.json")) return json({ incoming_phone_numbers: opts.owned === false ? [] : [{ sid: "PN1" }] });
    if (url.includes("/OutgoingCallerIds.json")) return json({ outgoing_caller_ids: opts.verified ? [{ sid: "PNV" }] : [] });
    if (url.endsWith("/Applications.json") && init?.method === "POST") return json({ sid: `AP${"9".repeat(32)}` }, 201);
    if (url.includes("/Applications/") && init?.method === "POST") return json({ sid: `AP${"9".repeat(32)}` });
    if (url.includes("/Applications/") && init?.method === "DELETE") return new Response(null, { status: 204 });
    return json({ message: "unexpected" }, 404);
  }));
}

beforeEach(() => store.clear());
afterEach(() => vi.unstubAllGlobals());

describe("connect Twilio", () => {
  it("validates the shape of the details before calling Twilio", () => {
    expect(validateCreds({ ...creds, accountSid: "AC123" })).toMatch(/Account SID/);
    expect(validateCreds({ ...creds, apiKeySid: "XX" })).toMatch(/API key SID/);
    expect(validateCreds(creds)).toBeNull();
  });

  it("checks the account and number, creates the TwiML app and stores the secret encrypted", async () => {
    mockTwilio();
    const r = await connectTwilio("u1", "Grok Bot", creds, "https://crm.example/api/voice/twiml");
    expect(r.callerId).toBe("+15125550100");
    expect(calls.every((c) => c.auth === `Basic ${Buffer.from(`${creds.apiKeySid}:${creds.apiKeySecret}`).toString("base64")}`)).toBe(true);
    const create = calls.find((c) => c.url.endsWith("/Applications.json"))!;
    expect(new URLSearchParams(create.body!).get("VoiceUrl")).toBe("https://crm.example/api/voice/twiml");
    expect(store.get("u1")).toMatchObject({ appSid: `AP${"9".repeat(32)}`, callerId: "+15125550100", apiKeySecret: `enc(${creds.apiKeySecret})` });
  });

  it("accepts a verified caller ID instead of a bought number", async () => {
    mockTwilio({ owned: false, verified: true });
    await expect(connectTwilio("u1", "A", creds, "https://x/api/voice/twiml")).resolves.toEqual({ callerId: "+15125550100" });
  });

  it("refuses a number that isn't in the account", async () => {
    mockTwilio({ owned: false, verified: false });
    await expect(connectTwilio("u1", "A", creds, "https://x/api/voice/twiml")).rejects.toThrow(/isn't a number in this Twilio account/);
    expect(store.has("u1")).toBe(false);
  });

  it("explains bad credentials", async () => {
    mockTwilio({ status: 401 });
    await expect(connectTwilio("u1", "A", creds, "https://x/api/voice/twiml")).rejects.toThrow(/didn't accept those details/);
  });

  it("reuses the existing app on reconnect and deletes it on disconnect", async () => {
    mockTwilio();
    await connectTwilio("u1", "A", creds, "https://x/api/voice/twiml");
    await connectTwilio("u1", "A", { ...creds, record: true }, "https://x/api/voice/twiml");
    expect(calls.some((c) => c.url.includes(`/Applications/AP${"9".repeat(32)}.json`) && c.method === "POST")).toBe(true);
    expect(store.get("u1")).toMatchObject({ record: true });
    await disconnectTwilio("u1");
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
    expect(store.has("u1")).toBe(false);
  });
});
