import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/session";
import { signPayload } from "@/lib/server/crypto";
import { OAUTH_COOKIE, appOrigin, redirectUriFor } from "@/lib/server/appUrl";
import { authorizeUrl, isProviderConfigured, newPkce } from "@/lib/mail/oauth";
import { providerFromSlug } from "@/lib/mail/types";

export const dynamic = "force-dynamic";

/** Starts "Connect Gmail" / "Connect Outlook": redirects to the provider's consent screen. */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const origin = appOrigin(req);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const provider = providerFromSlug((await params).provider);
  if (!provider) return NextResponse.redirect(`${origin}/settings?email=unknown#email`);
  if (!isProviderConfigured(provider)) return NextResponse.redirect(`${origin}/settings?email=not-configured#email`);
  // Google/Microsoft only send people back to the live address that's registered with them; on a preview
  // deployment they'd stop at a "redirect_uri_mismatch" error page and nothing would be saved.
  const live = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV === "preview" && live && !process.env.APP_URL) {
    return NextResponse.redirect(`${origin}/settings?email=use-live-site#email`);
  }

  const { verifier, challenge, state } = newPkce();
  const res = NextResponse.redirect(authorizeUrl(provider, redirectUriFor(origin, provider), state, challenge, user.email));
  res.cookies.set(OAUTH_COOKIE, signPayload({ state, verifier, provider, userId: user.id, exp: Date.now() + 10 * 60_000 }), {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    path: "/api/email/callback",
    maxAge: 600,
  });
  return res;
}
