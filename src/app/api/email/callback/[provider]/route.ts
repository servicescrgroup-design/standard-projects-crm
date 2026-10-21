import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";
import { encryptSecret, readSignedPayload } from "@/lib/server/crypto";
import { OAUTH_COOKIE, appOrigin, redirectUriFor } from "@/lib/server/appUrl";
import { PROVIDERS, exchangeCode } from "@/lib/mail/oauth";
import { providerFromSlug, type MailProviderId } from "@/lib/mail/types";

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
  if (!user) return NextResponse.redirect(`${origin}/login`);
  if (url.searchParams.get("error")) return back("cancelled");
  const code = url.searchParams.get("code");
  if (!provider || !saved || !code || saved.provider !== provider || saved.userId !== user.id || saved.exp < Date.now() || saved.state !== url.searchParams.get("state")) {
    return back("expired");
  }

  try {
    const tokens = await exchangeCode(provider, code, redirectUriFor(origin, provider), saved.verifier);
    if (!tokens.refreshToken) return back("no-offline-access");
    const { address, cursor } = await PROVIDERS[provider].profile(tokens.accessToken);
    if (!address) return back("failed");
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
    return back(`connected-${provider.toLowerCase()}`);
  } catch {
    return back("failed");
  }
}
