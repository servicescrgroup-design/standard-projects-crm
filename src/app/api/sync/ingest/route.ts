import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { ingestSyncItems, type SyncItem } from "@/lib/server/activities";

/**
 * Auto-capture endpoint. A sync worker (Gmail push / Calendar watch, or a scheduled poll) posts
 * a user's new messages and events here; they're matched to leads and logged as activities.
 *
 *   POST /api/sync/ingest
 *   Authorization: Bearer $SYNC_INGEST_SECRET
 *   { "userEmail": "rep@example.com", "items": [ { "kind": "email", ... } | { "kind": "event", ... } ] }
 *
 * Safe to re-send: items are de-duplicated by their Gmail/Calendar id.
 */
function authorised(req: Request): boolean {
  const secret = process.env.SYNC_INGEST_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validItem(i: unknown): i is SyncItem {
  if (!i || typeof i !== "object") return false;
  const o = i as Record<string, unknown>;
  if (typeof o.externalId !== "string" || !o.externalId) return false;
  if (o.kind === "email")
    return (
      (o.direction === "in" || o.direction === "out") &&
      typeof o.from === "string" &&
      Array.isArray(o.to) &&
      typeof o.occurredAt === "string" &&
      !Number.isNaN(Date.parse(o.occurredAt))
    );
  if (o.kind === "event")
    return Array.isArray(o.attendees) && typeof o.start === "string" && !Number.isNaN(Date.parse(o.start));
  return false;
}

export async function POST(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { userEmail?: unknown; items?: unknown } | null;
  if (!body || typeof body.userEmail !== "string" || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "Expected { userEmail, items[] }" }, { status: 400 });
  }
  const items = body.items.filter(validItem);
  const rejected = body.items.length - items.length;

  try {
    const result = await ingestSyncItems(body.userEmail, items);
    return NextResponse.json({ ...result, rejected });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
