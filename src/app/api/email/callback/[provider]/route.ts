import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";
import { encryptSecret, readSignedPayload } from "@/lib/server/crypto";
import { OAUTH_COOKIE, appOrigin, redirectUriFor } from "@/lib/server/appUrl";
import { PROVIDERS, exchangeCode } from "@/lib/mail/oauth";
import { providerFromSlug, type MailProviderId } from "@/lib/mail/types";
import { logConnect } from "@/lib/server/connectLog";

export const dynamic = "force-dynamic";

type OAuthState = { state: string; verifier: string; provider: MailProviderId; userId: string; exp: number };

/** Provider redirects back here. Verifies state, stores the encrypted refresh token, starts syncing from now. */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const origin = appOrigin(req);
  const back = (status: string) => {
    const res = NextResponse.redirect(`${origin}/settings?email=${status}#email`);
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/email/callback" });
    return res;
  };

  const url = new URL(req.url);
  const provider = providerFromSlug((await params).provider);
  const saved = readSignedPayload<OAuthState>((await cookies()).get(OAUTH_COOKIE)?.value);
  const user = await getCurrentUser();
  const who = { userId: user?.id ?? null, email: user?.email ?? null, provider, origin };
  if (!user) {
    await logConnect({ step: "callback", outcome: "not-signed-in", ...who });
    return NextResponse.redirect(`${origin}/login`);
  }
  const providerError = url.searchParams.get("error");
  if (providerError) {
    await logConnect({ step: "callback", outcome: "cancelled", ...who, detail: `provider error: ${providerError} ${url.searchParams.get("error_description") ?? ""}` });
    return back("cancelled");
  }
  const code = url.searchParams.get("code");
  const why = !provider ? "unknown provider" : !saved ? "no sign-in cookie (different browser/window or address, or blocked cookies)" : !code ? "no code returned"
    : saved.provider !== provider ? "provider mismatch" : saved.userId !== user.id ? `started as another user (${saved.userId})` : saved.exp < Date.now() ? "took longer than 10 minutes"
    : saved.state !== url.searchParams.get("state") ? "state mismatch" : null;
  if (why) {
    await logConnect({ step: "callback", outcome: "expired", ...who, detail: why });
    return back("expired");
  }
  if (!provider || !saved || !code) return back("expired"); // covered above; narrows the types

  try {
    const tokens = await exchangeCode(provider, code, redirectUriFor(origin, provider), saved.verifier);
    if (!tokens.refreshToken) {
      await logConnect({ step: "callback", outcome: "no-offline-access", ...who });
      return back("no-offline-access");
    }
    const { address, cursor } = await PROVIDERS[provider].profile(tokens.accessToken);
    if (!address) {
      await logConnect({ step: "callback", outcome: "failed", ...who, detail: "no address in profile" });
      return back("failed");
    }
    const data = {
      address,
      refreshToken: encryptSecret(tokens.refreshToken),
      accessToken: encryptSecret(tokens.accessToken),
      accessExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      cursor,
      status: "ACTIVE",
      lastError: null,
      labelId: null,
    };
    await db.mailbox.upsert({
      where: { userId_provider: { userId: user.id, provider } },
      create: { userId: user.id, provider, ...data },
      update: data,
    });
    await logConnect({ step: "callback", outcome: "connected", ...who, detail: address });
    return back(`connected-${provider.toLowerCase()}`);
  } catch (e) {
    await logConnect({ step: "callback", outcome: "failed", ...who, detail: (e as Error).message });
    return back("failed");
  }
}
