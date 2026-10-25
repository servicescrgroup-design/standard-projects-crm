import "server-only";
import { resolveMx, resolve4 } from "node:dns/promises";
import { emailDomain, looksLikeEmail } from "../emailSafety";

const cache = new Map<string, Promise<boolean>>();

/** Does this domain accept email? Looks for MX records (or an A record as fallback). Lookup failures count as yes. */
function domainTakesMail(domain: string): Promise<boolean> {
  let hit = cache.get(domain);
  if (!hit) {
    const lookup = async () => {
      try {
        const mx = await resolveMx(domain);
        if (mx.some((r) => r.exchange && r.exchange !== ".")) return true;
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code !== "ENOTFOUND" && code !== "ENODATA") return true; // timeout, server failure: don't punish the lead
      }
      try {
        return (await resolve4(domain)).length > 0;
      } catch {
        return false;
      }
    };
    hit = Promise.race([lookup(), new Promise<boolean>((r) => setTimeout(() => r(true), 4000))]);
    cache.set(domain, hit);
  }
  return hit;
}

/** Why an address can't receive email, or null when it looks deliverable. */
export async function undeliverableReason(address: string | null): Promise<string | null> {
  if (!looksLikeEmail(address)) return "The email address isn't valid";
  return (await domainTakesMail(emailDomain(address!))) ? null : "The email domain doesn't accept mail";
}
