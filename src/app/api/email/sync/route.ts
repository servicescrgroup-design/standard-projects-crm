import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/server/db";
import { syncAllMailboxes } from "@/lib/server/mailbox";
import { runDueSequences } from "@/lib/server/sequences";
import { assignInboundLeads } from "@/lib/server/assignment";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Scheduled job (every 10 minutes): assigns new enquiries, syncs mailboxes, sends due sequence emails.
 * Two ways to call it:
 *  - the database scheduler (pg_cron every 10 minutes) sends a one-time ticket it just created in
 *    "CronTicket" as the x-cron-ticket header, so no shared secret is needed;
 *  - Vercel Cron sends "Authorization: Bearer $CRON_SECRET" (daily fallback).
 */
async function authorised(req: Request): Promise<boolean> {
  const ticket = req.headers.get("x-cron-ticket") ?? "";
  if (UUID.test(ticket)) {
    const { count } = await db.cronTicket.updateMany({
      where: { id: ticket, usedAt: null, createdAt: { gt: new Date(Date.now() - 5 * 60_000) } },
      data: { usedAt: new Date() },
    });
    if (count === 1) return true;
  }
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

async function run(req: Request) {
  if (!(await authorised(req))) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  await db.cronTicket.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } } });
  // Order matters: hand out new enquiries, read replies (which stop sequences), then send what's due.
  const assigned = await assignInboundLeads();
  const mail = await syncAllMailboxes(25_000);
  const sequences = await runDueSequences(25_000);
  return NextResponse.json({ assigned, mail, sequences });
}

export const GET = run;
export const POST = run;
