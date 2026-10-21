import "server-only";

/**
 * The site's public origin, used in OAuth redirect URIs (which must exactly match the ones registered
 * with Google and Microsoft). APP_URL wins; otherwise it comes from the request.
 */
export function appOrigin(req: Request): string {
  const fixed = process.env.APP_URL?.replace(/\/+$/, "");
  if (fixed) return fixed;
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export const OAUTH_COOKIE = "spcrm_oauth";
export const redirectUriFor = (origin: string, provider: string) => `${origin}/api/email/callback/${provider.toLowerCase()}`;
