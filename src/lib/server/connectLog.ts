import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

const KEY = "email.connectLog";

/**
 * Records each step of connecting a mailbox (never tokens or codes), so a failed connection can be explained:
 * printed to the server log and kept as the last 30 entries in AppSetting (server logs only last an hour).
 */
export async function logConnect(entry: { step: "start" | "callback"; outcome: string; userId?: string | null; email?: string | null; provider?: string | null; origin: string; detail?: string }) {
  const row = { at: new Date().toISOString(), ...entry, detail: entry.detail?.slice(0, 300) };
  console.log(`[mail-connect] ${JSON.stringify(row)}`);
  try {
    const prev = await db.appSetting.findUnique({ where: { key: KEY } });
    const list = Array.isArray(prev?.value) ? (prev!.value as Prisma.InputJsonValue[]) : [];
    const value = [row as Prisma.InputJsonObject, ...list].slice(0, 30);
    await db.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
  } catch {
    /* logging must never break connecting */
  }
}
