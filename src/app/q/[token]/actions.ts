"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { acceptQuote, declineQuote, recordView } from "@/lib/server/quotes";

export type PublicQuoteResult = { ok?: boolean; error?: string };

/** Public: at most a few accept/decline attempts per IP per hour (the token itself is the secret). */
async function limited(): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const key = `quote-answer:${ip}`;
  const recent = await db.loginAttempt.count({ where: { email: key, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (recent >= 20) return true;
  await db.loginAttempt.create({ data: { email: key } });
  return false;
}

export async function acceptQuoteAction(token: string, _prev: PublicQuoteResult, fd: FormData): Promise<PublicQuoteResult> {
  if (await limited()) return { error: "Too many attempts. Please try again later." };
  if (fd.get("agree") !== "on") return { error: "Please tick the box to confirm." };
  try {
    await acceptQuote(token, String(fd.get("name") ?? ""));
    revalidatePath(`/q/${token}`);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function declineQuoteAction(token: string, _prev: PublicQuoteResult, fd: FormData): Promise<PublicQuoteResult> {
  if (await limited()) return { error: "Too many attempts. Please try again later." };
  try {
    await declineQuote(token, String(fd.get("reason") ?? ""));
    revalidatePath(`/q/${token}`);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Called by the page in the customer's browser (not on the server render), so link previews in LINE,
 * Gmail etc. and page refreshes after answering don't count as the customer opening the quote.
 */
export async function recordViewAction(token: string): Promise<void> {
  await recordView(token);
}
