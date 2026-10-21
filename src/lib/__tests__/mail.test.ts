import { describe, expect, it } from "vitest";
import { buildMime, decodeEntities, decodeHeader, encodeHeader, headerSafe, parseAddressList, replySubject } from "../mail/mime";
import { providerFromSlug } from "../mail/types";

describe("mime", () => {
  it("strips line breaks from headers (no header injection)", () => {
    expect(headerSafe("Hi\r\nBcc: evil@x.com")).toBe("Hi Bcc: evil@x.com");
    const raw = buildMime({ fromAddress: "a@x.com", fromName: "A", to: ["b@y.com"], subject: "Hi\nBcc: evil@x.com", body: "x" });
    expect(raw).not.toMatch(/^Bcc:/m);
  });

  it("encodes non-ASCII subjects and round-trips them", () => {
    const enc = encodeHeader("สวัสดี quote");
    expect(enc.startsWith("=?UTF-8?B?")).toBe(true);
    expect(decodeHeader(enc)).toBe("สวัสดี quote");
    expect(encodeHeader("Plain")).toBe("Plain");
    expect(decodeHeader("=?UTF-8?Q?Caf=C3=A9_menu?=")).toBe("Café menu");
  });

  it("builds a threaded reply with base64 body", () => {
    const raw = buildMime({ fromAddress: "a@x.com", fromName: "A", to: ["b@y.com"], subject: "Re: x", body: "Hello\nthere", inReplyTo: "<m1@y.com>", references: "<m0@y.com>" });
    expect(raw).toMatch(/^In-Reply-To: <m1@y\.com>$/m);
    expect(raw).toMatch(/^References: <m0@y\.com> <m1@y\.com>$/m);
    const body = raw.split("\r\n\r\n")[1];
    expect(Buffer.from(body, "base64").toString("utf8")).toBe("Hello\r\nthere");
  });

  it("parses address lists", () => {
    expect(parseAddressList("Jane <JANE@acme.com>, bob@x.org; nope, jane@acme.com")).toEqual(["jane@acme.com", "bob@x.org"]);
  });

  it("prefixes replies once and decodes snippets", () => {
    expect(replySubject("Quote")).toBe("Re: Quote");
    expect(replySubject("RE: Quote")).toBe("RE: Quote");
    expect(decodeEntities("It&#39;s &amp; done")).toBe("It's & done");
  });

  it("maps URL slugs to providers", () => {
    expect(providerFromSlug("gmail")).toBe("GMAIL");
    expect(providerFromSlug("outlook")).toBe("OUTLOOK");
    expect(providerFromSlug("yahoo")).toBeNull();
  });
});
