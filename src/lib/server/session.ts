import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { passwordStamp, readSession, signSession, SESSION_DAYS } from "../auth";

export const SESSION_COOKIE = "spcrm_session";

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (at least 32 characters)");
  return secret;
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
