import { createHash, randomBytes } from "node:crypto";
import { MailAuthError } from "./http";
import { gmail } from "./gmail";
import { outlook } from "./outlook";
import type { MailProvider, MailProviderId, OAuthConfig, TokenSet } from "./types";

export const PROVIDERS: Record<MailProviderId, MailProvider> = { GMAIL: gmail, OUTLOOK: outlook };

export function oauthConfig(id: MailProviderId): OAuthConfig {
  if (id === "GMAIL") {
    return {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // offline + consent = always return a refresh token
      extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    };
  }
  return {
    // "common" accepts work/school accounts from any organisation and personal Microsoft accounts.
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["openid", "email", "offline_access", "User.Read", "Mail.Read", "Mail.Send", "Mail.ReadWrite"],
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    extraAuthParams: { prompt: "select_account", response_mode: "query" },
  };
}

export function isProviderConfigured(id: MailProviderId): boolean {
  const c = oauthConfig(id);
  return !!c.clientId && !!c.clientSecret;
}

export function newPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, state: randomBytes(24).toString("base64url") };
}

export function authorizeUrl(id: MailProviderId, redirectUri: string, state: string, challenge: string, loginHint?: string): string {
  const c = oauthConfig(id);
  const q = new URLSearchParams({
    client_id: c.clientId ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: c.scopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...c.extraAuthParams,
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return `${c.authUrl}?${q}`;
}

async function tokenRequest(id: MailProviderId, params: Record<string, string>): Promise<TokenSet> {
  const c = oauthConfig(id);
  const res = await fetch(c.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId ?? "", client_secret: c.clientSecret ?? "", ...params }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) {
    // invalid_grant = the user revoked access or the refresh token expired.
    if (data.error === "invalid_grant") throw new MailAuthError("Access was revoked or expired");
    throw new Error(`Sign-in with the mail provider failed (${data.error ?? res.status})`);
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in ?? 3600 };
}

export function exchangeCode(id: MailProviderId, code: string, redirectUri: string, verifier: string) {
  return tokenRequest(id, { grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier });
}

export function refreshAccess(id: MailProviderId, refreshToken: string) {
  return tokenRequest(id, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    ...(id === "OUTLOOK" ? { scope: oauthConfig(id).scopes.join(" ") } : {}),
  });
}

/** Best effort: Google supports revoking; Microsoft has no per-app revoke endpoint for this flow. */
export async function revoke(id: MailProviderId, refreshToken: string) {
  if (id !== "GMAIL") return;
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
  }).catch(() => null);
}
