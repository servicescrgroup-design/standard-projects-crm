import "server-only";
import type { User } from "@prisma/client";
import { db } from "./db";
import { canSendEmail } from "../access";

const KEY = "email.agentsSendDirect";

/** Owner's choice: may sales agents send one-off emails from their own Gmail/Outlook without approval? */
export async function agentsSendDirect(): Promise<boolean> {
  const row = await db.appSetting.findUnique({ where: { key: KEY } });
  return (row?.value as { on?: boolean } | null)?.on === true;
}

export async function setAgentsSendDirect(on: boolean) {
  await db.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: { on } }, update: { value: { on } } });
}

/**
 * Whether this person's email goes out straight away (true) or waits for a manager (false). Managers always
 * send; agents send directly only when the owner allows it and they've connected their own mailbox.
 * Sequences still need approval either way.
 */
export async function canSendNow(user: User): Promise<boolean> {
  if (canSendEmail(user)) return true;
  if (!(await agentsSendDirect())) return false;
  return (await db.mailbox.count({ where: { userId: user.id, status: "ACTIVE" } })) > 0;
}
