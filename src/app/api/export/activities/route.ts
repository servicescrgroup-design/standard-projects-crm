import { getCurrentUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { leadScope } from "@/lib/access";
import { toCsv } from "@/lib/csv";

/** CSV of logged activity on the leads this person can see. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in", { status: 401 });
  const rows = await db.activity.findMany({
    where: { lead: leadScope(user) },
    include: { lead: { select: { company: true } }, user: { select: { name: true } } },
    orderBy: { occurredAt: "desc" },
    take: 20000,
  });
  const csv = toCsv(
    ["When", "Company", "Type", "Outcome", "Note", "By", "Source"],
    rows.map((a) => [a.occurredAt, a.lead.company, a.type, a.outcome, a.summary, a.user?.name ?? "automatic", a.source]),
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="activity-${stamp}.csv"`, "cache-control": "no-store" },
  });
}
