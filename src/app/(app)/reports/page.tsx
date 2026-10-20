import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { runReportFor } from "@/lib/server/reportData";
import { DEFAULT_CONFIG, sanitizeConfig } from "@/lib/reports";
import { ReportEditor } from "@/components/reports/ReportEditor";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireUser();
  const [reports, initial] = await Promise.all([
    db.report.findMany({
      where: { OR: [{ ownerId: user.id }, { shared: true }] },
      orderBy: { updatedAt: "desc" },
      include: { owner: { select: { name: true } } },
    }),
    runReportFor(user, DEFAULT_CONFIG),
  ]);
  return (
    <ReportEditor
      initial={initial}
      reports={reports.map((r) => ({ id: r.id, title: r.title, config: sanitizeConfig(r.config), shared: r.shared, mine: r.ownerId === user.id, owner: r.owner.name }))}
    />
  );
}
