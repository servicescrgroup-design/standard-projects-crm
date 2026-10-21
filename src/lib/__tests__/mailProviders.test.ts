import { afterEach, describe, expect, it, vi } from "vitest";
import { gmail } from "../mail/gmail";
import { outlook } from "../mail/outlook";
import { MailAuthError } from "../mail/http";

type Call = { url: string; init?: RequestInit };
function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const out = handler(url, init);
    if (out instanceof Response) return out;
    return new Response(out === undefined ? null : JSON.stringify(out), { status: out === undefined ? 202 : 200 });
  }));
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

const meta = (id: string, from: string, labels: string[]) => ({
  id, threadId: "t1", labelIds: labels, snippet: "It&#39;s great", internalDate: "1760000000000",
  payload: { headers: [{ name: "From", value: from }, { name: "To", value: "me@gmail.com" }, { name: "Subject", value: "Quote" }] },
});

describe("gmail provider", () => {
  it("reads history since the cursor, skipping drafts", async () => {
    mockFetch((url) => {
      if (url.includes("/history?")) return { historyId: "200", history: [{ messagesAdded: [{ message: { id: "m1", labelIds: ["INBOX"] } }, { message: { id: "d1", labelIds: ["DRAFT"] } }] }, { messagesAdded: [{ message: { id: "m2", labelIds: ["SENT"] } }] }] };
      if (url.includes("/messages/m1")) return meta("m1", "Jane <jane@acme.com>", ["INBOX"]);
      if (url.includes("/messages/m2")) return meta("m2", "me@gmail.com", ["SENT"]);
      throw new Error(`unexpected ${url}`);
    });
    const r = await gmail.listNewMessages("tok", "100", "me@gmail.com");
    expect(r.cursor).toBe("200");
    expect(r.messages.map((m) => [m.id, m.direction, m.from])).toEqual([["m1", "in", "jane@acme.com"], ["m2", "out", "me@gmail.com"]]);
    expect(r.messages[0].snippet).toBe("It's great");
    expect(r.messages[0].webLink).toContain("#all/t1");
  });

  it("restarts from now when the history cursor is too old", async () => {
    mockFetch((url) => (url.includes("/history?") ? new Response("{}", { status: 404 }) : { emailAddress: "Me@gmail.com", historyId: "999" }));
    expect(await gmail.listNewMessages("tok", "1", "me@gmail.com")).toEqual({ messages: [], cursor: "999" });
  });

  it("replies in-thread with In-Reply-To and labels the sent mail", async () => {
    const calls = mockFetch((url) => {
      if (url.includes("/messages/orig?")) return { ...meta("orig", "jane@acme.com", ["INBOX"]), payload: { headers: [{ name: "Message-ID", value: "<abc@acme.com>" }] } };
      if (url.endsWith("/messages/send")) return { id: "s1", threadId: "t1" };
      if (url.endsWith("/labels")) return { labels: [{ id: "L9", name: "Standard Projects/Outreach Sent" }] };
      if (url.includes("/modify")) return {};
      throw new Error(`unexpected ${url}`);
    });
    const sent = await gmail.sendMessage("tok", { fromAddress: "me@gmail.com", fromName: "Me", to: ["jane@acme.com"], subject: "Re: Quote", body: "Hi", replyToMessageId: "orig" });
    expect(sent).toMatchObject({ id: "s1", threadId: "t1" });
    const sendBody = JSON.parse(String(calls.find((c) => c.url.endsWith("/messages/send"))!.init!.body));
    expect(sendBody.threadId).toBe("t1");
    expect(Buffer.from(sendBody.raw, "base64url").toString()).toContain("In-Reply-To: <abc@acme.com>");
    expect(await gmail.applyLabel("tok", "s1", "Standard Projects/Outreach Sent", null)).toBe("L9");
  });

  it("raises an auth error on 401", async () => {
    mockFetch(() => new Response("{}", { status: 401 }));
    await expect(gmail.profile("bad")).rejects.toBeInstanceOf(MailAuthError);
  });
});

describe("outlook provider", () => {
  it("lists inbox and sent items since the cursor with immutable ids", async () => {
    const calls = mockFetch((url) => ({
      value: url.includes("/inbox/")
        ? [{ id: "i1", conversationId: "c1", subject: "Hi", bodyPreview: "x", from: { emailAddress: { address: "Jane@Acme.com" } }, toRecipients: [], receivedDateTime: "2026-10-21T01:00:00Z", webLink: "https://outlook/x" }]
        : [{ id: "o1", conversationId: "c1", subject: "Re: Hi", bodyPreview: "y", from: { emailAddress: { address: "me@outlook.com" } }, toRecipients: [{ emailAddress: { address: "jane@acme.com" } }], sentDateTime: "2026-10-21T02:00:00Z" }],
    }));
    const r = await outlook.listNewMessages("tok", "2026-10-21T00:00:00.000Z", "me@outlook.com");
    expect(r.messages.map((m) => [m.id, m.direction, m.from])).toEqual([["i1", "in", "jane@acme.com"], ["o1", "out", "me@outlook.com"]]);
    expect(calls.every((c) => (c.init?.headers as Record<string, string>).Prefer === 'IdType="ImmutableId"')).toBe(true);
    expect(decodeURIComponent(calls[0].url)).toContain("receivedDateTime ge 2026-10-20T23:58:00.000Z");
  });

  it("sends a new message via a draft and returns its link", async () => {
    mockFetch((url, init) => {
      if (url.endsWith("/me/messages") && init?.method === "POST") return { id: "d1", conversationId: "c9", webLink: "https://draft" };
      if (url.endsWith("/d1/send")) return undefined;
      if (url.includes("/messages/d1?")) return { webLink: "https://sent", conversationId: "c9" };
      throw new Error(`unexpected ${url}`);
    });
    const sent = await outlook.sendMessage("tok", { fromAddress: "me@outlook.com", fromName: "Me", to: ["jane@acme.com"], subject: "Hello", body: "Hi" });
    expect(sent).toEqual({ id: "d1", threadId: "c9", webLink: "https://sent" });
  });
});
