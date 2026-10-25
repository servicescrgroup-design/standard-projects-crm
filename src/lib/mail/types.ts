/** Provider-agnostic email layer: Gmail and Outlook (Microsoft Graph) both implement MailProvider. */

export const MAIL_PROVIDERS = ["GMAIL", "OUTLOOK"] as const;
export type MailProviderId = (typeof MAIL_PROVIDERS)[number];
export const PROVIDER_NAMES: Record<MailProviderId, string> = { GMAIL: "Gmail", OUTLOOK: "Outlook" };

/** Gmail label / Outlook category put on every email sent from the CRM. */
export const OUTREACH_LABEL = "Standard Projects/Outreach Sent";

export function isMailProvider(v: unknown): v is MailProviderId {
  return v === "GMAIL" || v === "OUTLOOK";
}

/** URL slug ↔ provider id (/api/email/connect/gmail). */
export function providerFromSlug(slug: string): MailProviderId | null {
  const up = slug.toUpperCase();
  return isMailProvider(up) ? up : null;
}

export type MailMessage = {
  id: string;
  threadId: string;
  direction: "in" | "out";
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  snippet: string;
  date: Date;
  webLink: string;
  /** Bounce-backs: the addresses the server couldn't deliver to (Gmail's X-Failed-Recipients). */
  failedRecipients?: string[];
};

export type OutgoingMail = {
  fromAddress: string;
  fromName: string;
  to: string[];
  subject: string;
  body: string; // plain text
  /** Reply in this thread: the provider message id being replied to. */
  replyToMessageId?: string | null;
  threadId?: string | null;
};

export type SentMail = { id: string; threadId: string; webLink: string };

export type TokenSet = { accessToken: string; expiresIn: number; refreshToken?: string };

export interface MailProvider {
  id: MailProviderId;
  /** Address of the connected mailbox and a starting cursor ("from now on"). */
  profile(token: string): Promise<{ address: string; cursor: string }>;
  /** Messages added since the cursor (bounded), plus the next cursor. */
  listNewMessages(token: string, cursor: string | null, mailboxAddress: string): Promise<{ messages: MailMessage[]; cursor: string }>;
  sendMessage(token: string, mail: OutgoingMail): Promise<SentMail>;
  /** Gmail label / Outlook category, created when missing. Returns a cacheable label id (Gmail) or null. */
  applyLabel(token: string, messageId: string, label: string, cachedLabelId: string | null): Promise<string | null>;
  getThread(token: string, threadId: string, mailboxAddress: string): Promise<MailMessage[]>;
}

/** OAuth details per provider (endpoints, scopes). */
export type OAuthConfig = {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: string | undefined;
  clientSecret: string | undefined;
  extraAuthParams: Record<string, string>;
};
