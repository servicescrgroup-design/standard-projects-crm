import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { formatDuration, toE164 } from "../phone";
import { dialTwiml, rejectTwiml, signCall, verifyCall, voiceAccessToken } from "../voice";

describe("phone numbers", () => {
  it("converts Thai local numbers", () => {
    expect(toE164("096 627 5499")).toBe("+66966275499");
    expect(toE164("053-434-232")).toBe("+6653434232");
    expect(toE164("061 419 6922 / 061 615 5853")).toBe("+66614196922");
  });
  it("keeps international numbers and handles 00 prefixes", () => {
    expect(toE164("+1 (512) 555-0100", "TH")).toBe("+15125550100");
    expect(toE164("0049 89 123456")).toBe("+4989123456");
  });
  it("uses the lead's country for local numbers", () => {
    expect(toE164("(512) 555-0100", "US")).toBe("+15125550100");
    expect(toE164("020 7946 0958", "GB")).toBe("+442079460958");
    expect(toE164("089 123456", "DE")).toBe("+4989123456");
  });
  it("rejects things that aren't numbers", () => {
    expect(toE164("line: @standardprojects")).toBeNull();
    expect(toE164("123")).toBeNull();
    expect(toE164(null)).toBeNull();
  });
  it("formats call time", () => {
    expect(formatDuration(187)).toBe("03:07");
    expect(formatDuration(3725)).toBe("1:02:05");
  });
});

describe("twilio access token", () => {
  const opts = { accountSid: "AC123", apiKeySid: "SK456", apiKeySecret: "secret", appSid: "AP789", identity: "user_1", now: 1_760_000_000_000 };
  it("is an HS256 JWT with a voice grant, signed with the API key secret", () => {
    const token = voiceAccessToken(opts);
    const [h, p, sig] = token.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" });
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(payload).toMatchObject({ iss: "SK456", sub: "AC123", exp: 1_760_000_000 + 3600 });
    expect(payload.grants).toEqual({ identity: "user_1", voice: { outgoing: { application_sid: "AP789" } } });
    expect(sig).toBe(createHmac("sha256", "secret").update(`${h}.${p}`).digest("base64url"));
  });
});

describe("signed calls", () => {
  const claim = { userId: "u1", leadId: "l1", to: "+66966275499", exp: Date.now() + 60_000 };
  it("round-trips a valid claim", () => {
    expect(verifyCall(signCall(claim, "k"), "k")).toEqual(claim);
  });
  it("rejects tampering, wrong keys, expiry and bad numbers", () => {
    const t = signCall(claim, "k");
    const forged = `${Buffer.from(JSON.stringify({ ...claim, to: "+19005550100" })).toString("base64url")}.${t.split(".")[1]}`;
    expect(verifyCall(forged, "k")).toBeNull();
    expect(verifyCall(t, "other")).toBeNull();
    expect(verifyCall(signCall({ ...claim, exp: Date.now() - 1 }, "k"), "k")).toBeNull();
    expect(verifyCall(signCall({ ...claim, to: "12345" }, "k"), "k")).toBeNull();
    expect(verifyCall(undefined, "k")).toBeNull();
  });
});

describe("twiml", () => {
  it("dials the number from the caller id, escaping input", () => {
    expect(dialTwiml({ to: "+66966275499", callerId: "+15125550100", record: false })).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="+15125550100" answerOnBridge="true" timeout="40"><Number>+66966275499</Number></Dial></Response>',
    );
    expect(dialTwiml({ to: "+1", callerId: "+2", record: true })).toContain('record="record-from-answer-dual"');
    expect(rejectTwiml("a <b> & c")).toContain("a &lt;b&gt; &amp; c");
  });
});
