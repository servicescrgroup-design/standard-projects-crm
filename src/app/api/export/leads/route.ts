import { getCurrentUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { leadWhereWithCountry } from "@/lib/server/leadFilters";
import { toCsv } from "@/lib/csv";
import { STAGE_LABELS, type Stage } from "@/lib/domain";

/** CSV of the leads this person can see, narrowed by the same filters as the page they exported from. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in", { status: 401 });
  const p = Object.fromEntries(new URL(req.url).searchParams);
  const leads = await db.lead.findMany({
    where: await leadWhereWithCountry(user, p),
    include: { owner: { select: { name: true } } },
    orderBy: [{ priority: { sort: "asc", nulls: "last" } }, { company: "asc" }],
  });
  const csv = toCsv(
    ["Company", "Contact", "Email", "Phone / LINE", "Stage", "Priority", "Segment", "Industry", "Area", "Owner", "One-off value (THB)", "Monthly (THB)", "Next follow-up", "Last contact", "Source", "Website", "Social", "Notes", "Created"],
    leads.map((l) => [
      l.company, l.contactName, l.email, l.phone, STAGE_LABELS[l.stage as Stage] ?? l.stage, l.priority, l.segment, l.industry, l.location,
      l.owner?.name ?? "Unassigned", l.value / 100, l.monthlyValue / 100, l.nextFollowUpAt, l.lastContactAt, l.source, l.website, l.socialLinks, l.notes, l.createdAt,
    ]),
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="leads-${stamp}.csv"`, "cache-control": "no-store" },
  });
}
