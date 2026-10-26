import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

const mailboxIdsOf = cache(async (userId: string) => (await db.mailbox.findMany({ where: { userId }, select: { id: true } })).map((m) => m.id));

/**
 * Emails are private to their mailbox: an email synced from (or sent through) someone's Gmail/Outlook is
 * only shown to that person, or to whoever wrote it. Calls, notes, meetings and hand-logged activity
 * have no mailbox and stay visible to everyone who can see the lead.
 */
export async function visibleActivityWhere(viewer: { id: string }): Promise<Prisma.ActivityWhereInput> {
  const mine = await mailboxIdsOf(viewer.id);
  return { OR: [{ mailboxId: null }, { userId: viewer.id }, ...(mine.length ? [{ mailboxId: { in: mine } }] : [])] };
}
