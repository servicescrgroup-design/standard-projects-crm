"use server";

import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";

/** Remembers that this person has seen (or skipped) the first sign-in walkthrough. */
export async function completeTour(): Promise<void> {
  const user = await requireUser();
  const prefs = (user.preferences && typeof user.preferences === "object" ? user.preferences : {}) as Record<string, unknown>;
  if (prefs.tourDone === true) return;
  await db.user.update({ where: { id: user.id }, data: { preferences: { ...prefs, tourDone: true } } });
}
