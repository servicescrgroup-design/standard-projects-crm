import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { leadScope } from "@/lib/access";
import { QUEUE_SELECT, buildQueue } from "@/lib/queue";
import { OPEN_STAGES, WON_STAGES } from "@/lib/domain";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [mine, projects] = await Promise.all([
    // "Today" badge counts only the viewer's own leads, whatever their role.
    db.lead.findMany({ where: { ownerId: user.id, stage: { in: OPEN_STAGES } }, select: QUEUE_SELECT }),
    // Won and maintenance clients are the delivery projects.
    db.lead.findMany({
      where: { AND: [leadScope(user), { stage: { in: WON_STAGES } }] },
      select: { id: true, company: true },
      orderBy: { stageChangedAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      dueCount={buildQueue(mine).length}
      projects={projects}
      renderedAt={new Date().toISOString()}
      // The walkthrough starts by itself on a rep's or team lead's first sign-in; owners replay it from Help.
      showTour={user.role !== "OWNER" && (user.preferences as Record<string, unknown> | null)?.tourDone !== true}
    >
      {children}
    </AppShell>
  );
}
