import { api, MailApiError } from "./http";
import { buildMime, base64url, decodeEntities, decodeHeader, parseAddressList } from "./mime";
import type { MailMessage, MailProvider } from "./types";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_PER_SYNC = 200;

type GmailHeader = { name: string; value: string };
type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: GmailHeader[] };
};

const header = (m: GmailMessage, name: string) =>
  decodeHeader(m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "");

export function gmailLink(address: string, threadId: string): string {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(address)}#all/${threadId}`;
}

function toMessage(m: GmailMessage, mailboxAddress: string): MailMessage {
  const from = parseAddressList(header(m, "From"))[0] ?? "";
  const sent = (m.labelIds ?? []).includes("SENT") || from === mailboxAddress.toLowerCase();
  return {
    id: m.id,
    threadId: m.threadId,
    direction: sent ? "out" : "in",
    from,
    to: parseAddressList(header(m, "To")),
    cc: parseAddressList(header(m, "Cc")),
    subject: header(m, "Subject"),
    snippet: decodeEntities(m.snippet ?? ""),
    date: new Date(Number(m.internalDate ?? Date.now())),
    webLink: gmailLink(mailboxAddress, m.threadId),
  };
}

const METADATA = "format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References";

async function getMessage(token: string, id: string) {
  return api<GmailMessage>(`${BASE}/messages/${id}?${METADATA}`, token);
}

async function findOrCreateLabel(token: string, name: string): Promise<string> {
  const { labels = [] } = await api<{ labels?: { id: string; name: string }[] }>(`${BASE}/labels`, token);
  const existing = labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  // Create the parent first so Gmail shows the label nested ("Standard Projects" › "Outreach Sent").
  const parent = name.includes("/") ? name.slice(0, name.lastIndexOf("/")) : null;
  if (parent && !labels.some((l) => l.name.toLowerCase() === parent.toLowerCase())) {
    await api(`${BASE}/labels`, token, { method: "POST", json: { name: parent, labelListVisibility: "labelShow", messageListVisibility: "show" } }).catch(() => null);
  }
  const created = await api<{ id: string }>(`${BASE}/labels`, token, {
    method: "POST",
    json: { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
  });
  return created.id;
}

export const gmail: MailProvider = {
  id: "GMAIL",

  async profile(token) {
    const p = await api<{ emailAddress: string; historyId: string }>(`${BASE}/profile`, token);
    return { address: p.emailAddress.toLowerCase(), cursor: p.historyId };
  },

  async listNewMessages(token, cursor, mailboxAddress) {
    if (!cursor) {
      const p = await this.profile(token);
      return { messages: [], cursor: p.cursor };
    }
    const ids: string[] = [];
    let next = cursor;
    let pageToken: string | undefined;
    try {
      do {
        const q = new URLSearchParams({ startHistoryId: cursor, historyTypes: "messageAdded", maxResults: "100" });
        if (pageToken) q.set("pageToken", pageToken);
        const page = await api<{ history?: { messagesAdded?: { message: { id: string; labelIds?: string[] } }[] }[]; historyId: string; nextPageToken?: string }>(
          `${BASE}/history?${q}`,
          token,
        );
        for (const h of page.history ?? []) {
          for (const a of h.messagesAdded ?? []) {
            const labels = a.message.labelIds ?? [];
            if (labels.includes("DRAFT") || labels.includes("SPAM") || labels.includes("CHAT")) continue;
            if (!ids.includes(a.message.id)) ids.push(a.message.id);
          }
        }
        next = page.historyId;
        pageToken = page.nextPageToken;
      } while (pageToken && ids.length < MAX_PER_SYNC);
    } catch (e) {
      // History older than about a week is gone: restart from now rather than failing forever.
      if (e instanceof MailApiError && e.status === 404) return { messages: [], cursor: (await this.profile(token)).cursor };
      throw e;
    }

    const messages: MailMessage[] = [];
    for (const id of ids.slice(0, MAX_PER_SYNC)) {
      try {
        messages.push(toMessage(await getMessage(token, id), mailboxAddress));
      } catch (e) {
        if (!(e instanceof MailApiError && e.status === 404)) throw e; // deleted since: skip
      }
    }
    return { messages, cursor: next };
  },

  async sendMessage(token, mail) {
    let inReplyTo: string | null = null;
    let references: string | null = null;
    let threadId = mail.threadId ?? undefined;
    if (mail.replyToMessageId) {
      const original = await getMessage(token, mail.replyToMessageId);
      inReplyTo = header(original, "Message-ID") || null;
      references = header(original, "References") || null;
      threadId = original.threadId;
    }
    const raw = base64url(buildMime({ ...mail, inReplyTo, references }));
    const sent = await api<{ id: string; threadId: string }>(`${BASE}/messages/send`, token, { method: "POST", json: { raw, ...(threadId ? { threadId } : {}) } });
    return { id: sent.id, threadId: sent.threadId, webLink: gmailLink(mail.fromAddress, sent.threadId) };
  },

  async applyLabel(token, messageId, label, cachedLabelId) {
    let labelId = cachedLabelId ?? (await findOrCreateLabel(token, label));
    try {
      await api(`${BASE}/messages/${messageId}/modify`, token, { method: "POST", json: { addLabelIds: [labelId] } });
    } catch (e) {
      if (!(e instanceof MailApiError) || !cachedLabelId) throw e;
      labelId = await findOrCreateLabel(token, label); // cached id went stale (label deleted)
      await api(`${BASE}/messages/${messageId}/modify`, token, { method: "POST", json: { addLabelIds: [labelId] } });
    }
    return labelId;
  },

  async getThread(token, threadId, mailboxAddress) {
    const t = await api<{ messages?: GmailMessage[] }>(`${BASE}/threads/${threadId}?${METADATA}`, token);
    return (t.messages ?? []).map((m) => toMessage(m, mailboxAddress));
  },
};
