"use server";

import { headers } from "next/headers";
import { db } from "@/lib/server/db";
import { markInterested, recordDemoView } from "@/lib/server/demos";

/** Public: a few "go ahead" clicks per IP per hour (the token itself is the secret). */
async function limited(): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const key = `demo-answer:${ip}`;
  const recent = await db.loginAttempt.count({ where: { email: key, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (recent >= 20) return true;
  await db.loginAttempt.create({ data: { email: key } });
  return false;
}

export async function goAheadAction(token: string, note: string): Promise<{ ok?: boolean; error?: string }> {
  if (await limited()) return { error: "Too many attempts. Please try again later." };
  try {
    await markInterested(token, note);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Called from the client's browser only, so link previews (LINE, Gmail) don't count as opening it. */
export async function recordDemoViewAction(token: string): Promise<void> {
  await recordDemoView(token);
}
