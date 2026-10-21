import { api, MailApiError } from "./http";
import type { MailMessage, MailProvider } from "./types";

const BASE = "https://graph.microsoft.com/v1.0/me";
// Immutable ids stay the same when a draft is sent or a message moves folder, so the id we log is stable.
const IMMUTABLE = { Prefer: 'IdType="ImmutableId"' };
const SELECT = "id,conversationId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,webLink";
const MAX_PER_FOLDER = 200;
const OVERLAP_MS = 2 * 60 * 1000; // re-read the last two minutes; duplicates are skipped by message id

type Recipient = { emailAddress?: { address?: string } };
type GraphMessage = {
  id: string;
  conversationId: string;
  subject?: string;
  bodyPreview?: string;
  from?: Recipient;
  toRecipients?: Recipient[];
  ccRecipients?: Recipient[];
  receivedDateTime?: string;
  sentDateTime?: string;
  webLink?: string;
  categories?: string[];
};

/** Query string with spaces as %20 (Graph's OData parser is happiest with that). */
const query = (params: Record<string, string>) =>
  Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");

const addr = (r?: Recipient) => (r?.emailAddress?.address ?? "").toLowerCase();
const recipients = (to: string[]) => to.map((address) => ({ emailAddress: { address } }));

function toMessage(m: GraphMessage, mailboxAddress: string, folder?: "inbox" | "sent"): MailMessage {
  const from = addr(m.from);
  const out = folder ? folder === "sent" : from === mailboxAddress.toLowerCase();
  return {
    id: m.id,
    threadId: m.conversationId,
    direction: out ? "out" : "in",
    from,
    to: (m.toRecipients ?? []).map(addr).filter(Boolean),
    cc: (m.ccRecipients ?? []).map(addr).filter(Boolean),
    subject: m.subject ?? "",
    snippet: m.bodyPreview ?? "",
    date: new Date((out ? m.sentDateTime : m.receivedDateTime) ?? m.receivedDateTime ?? Date.now()),
    webLink: m.webLink ?? "https://outlook.office.com/mail/",
  };
}

async function listFolder(token: string, folder: "inbox" | "sentitems", since: string): Promise<GraphMessage[]> {
  const field = folder === "inbox" ? "receivedDateTime" : "sentDateTime";
  const q = query({ $filter: `${field} ge ${since}`, $orderby: `${field} asc`, $select: SELECT, $top: "50" });
  let url: string | undefined = `${BASE}/mailFolders/${folder}/messages?${q}`;
  const out: GraphMessage[] = [];
  while (url && out.length < MAX_PER_FOLDER) {
    const page: { value: GraphMessage[]; "@odata.nextLink"?: string } = await api(url, token, { headers: IMMUTABLE });
    out.push(...page.value);
    url = page["@odata.nextLink"];
  }
  return out;
}

export const outlook: MailProvider = {
  id: "OUTLOOK",

  async profile(token) {
    const me = await api<{ mail?: string | null; userPrincipalName?: string }>(`${BASE}?$select=mail,userPrincipalName`, token);
    return { address: (me.mail || me.userPrincipalName || "").toLowerCase(), cursor: new Date().toISOString() };
  },

  async listNewMessages(token, cursor, mailboxAddress) {
    const started = new Date();
    if (!cursor) return { messages: [], cursor: started.toISOString() };
    const since = new Date(new Date(cursor).getTime() - OVERLAP_MS).toISOString();
    const [inbox, sent] = await Promise.all([listFolder(token, "inbox", since), listFolder(token, "sentitems", since)]);
    return {
      messages: [...inbox.map((m) => toMessage(m, mailboxAddress, "inbox")), ...sent.map((m) => toMessage(m, mailboxAddress, "sent"))],
      cursor: started.toISOString(),
    };
  },

  async sendMessage(token, mail) {
    const body = { contentType: "Text", content: mail.body };
    let draft: GraphMessage;
    if (mail.replyToMessageId) {
      draft = await api<GraphMessage>(`${BASE}/messages/${mail.replyToMessageId}/createReply`, token, { method: "POST", headers: IMMUTABLE, json: {} });
      draft = await api<GraphMessage>(`${BASE}/messages/${draft.id}`, token, {
        method: "PATCH",
        headers: IMMUTABLE,
        json: { body, toRecipients: recipients(mail.to), subject: mail.subject },
      });
    } else {
      draft = await api<GraphMessage>(`${BASE}/messages`, token, {
        method: "POST",
        headers: IMMUTABLE,
        json: { subject: mail.subject, body, toRecipients: recipients(mail.to) },
      });
    }
    await api(`${BASE}/messages/${draft.id}/send`, token, { method: "POST", headers: IMMUTABLE });

    // The sent copy keeps the same immutable id; it can take a moment to appear in Sent Items.
    let webLink = draft.webLink ?? "https://outlook.office.com/mail/sentitems";
    for (let i = 0; i < 2; i++) {
      try {
        const sent = await api<GraphMessage>(`${BASE}/messages/${draft.id}?$select=webLink,conversationId`, token, { headers: IMMUTABLE });
        webLink = sent.webLink ?? webLink;
        break;
      } catch (e) {
        if (!(e instanceof MailApiError && e.status === 404)) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    return { id: draft.id, threadId: draft.conversationId, webLink };
  },

  async applyLabel(token, messageId, label) {
    const m = await api<GraphMessage>(`${BASE}/messages/${messageId}?$select=categories`, token, { headers: IMMUTABLE });
    const categories = m.categories ?? [];
    if (!categories.includes(label)) {
      await api(`${BASE}/messages/${messageId}`, token, { method: "PATCH", headers: IMMUTABLE, json: { categories: [...categories, label] } });
    }
    return null;
  },

  async getThread(token, threadId, mailboxAddress) {
    const q = query({ $filter: `conversationId eq '${threadId.replace(/'/g, "''")}'`, $select: SELECT, $top: "50" });
    const page = await api<{ value: GraphMessage[] }>(`${BASE}/messages?${q}`, token, { headers: IMMUTABLE });
    return page.value.map((m) => toMessage(m, mailboxAddress)).sort((a, b) => a.date.getTime() - b.date.getTime());
  },
};
