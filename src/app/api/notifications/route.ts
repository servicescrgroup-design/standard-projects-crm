import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { assignInboundLeads } from "@/lib/server/assignment";

export const dynamic = "force-dynamic";

/**
 * The bell polls this every minute. While anyone has the CRM open, it also hands out new website
 * enquiries (at most once a minute across everyone), so they don't wait for the 10-minute job.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in again" }, { status: 401 });

  const last = await db.appSetting.findUnique({ where: { key: "assignment.lastPoll" } });
  const lastAt = typeof last?.value === "number" ? last.value : 0;
  if (Date.now() - lastAt > 60_000) {
    await db.appSetting.upsert({ where: { key: "assignment.lastPoll" }, create: { key: "assignment.lastPoll", value: Date.now() }, update: { value: Date.now() } });
    await assignInboundLeads(20).catch(() => 0);
  }

  const [unread, items] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return NextResponse.json({
    unread,
    items: items.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, href: n.href, read: !!n.readAt, at: n.createdAt.toISOString() })),
  });
}
