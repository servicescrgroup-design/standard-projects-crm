import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { passwordStamp, readSession, signSession, SESSION_DAYS } from "../auth";

export const SESSION_COOKIE = "spcrm_session";

/**
 * Key for signing sign-in cookies. Uses SESSION_SECRET if set; otherwise derives one from a
 * server-only secret that's already configured (Supabase integration key or the database URL),
 * so no extra setup is needed. Changing that underlying secret signs everyone out.
 */
export function sessionSecret(): string {
  const explicit = process.env.SESSION_SECRET;
  if (explicit && explicit.length >= 32) return explicit;
  const base =
    process.env.SUPABASE_SECRET_KEY || process.env.POSTGRES_PASSWORD || process.env.POSTGRES_PRISMA_URL || "";
  if (base.length >= 16) return createHmac("sha256", base).update("spcrm-session-v1").digest("base64url");
  throw new Error("Set SESSION_SECRET (32+ characters) or the database connection variables");
}

export async function startSession(user: { id: string; passwordHash: string }) {
  (await cookies()).set(SESSION_COOKIE, signSession(user.id, user.passwordHash, sessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, sessionSecret());
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.userId } });
  // Removed users, or anyone whose password changed since signing in, are signed out.
  if (!user?.passwordHash || passwordStamp(user.passwordHash) !== session.stamp) return null;
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
