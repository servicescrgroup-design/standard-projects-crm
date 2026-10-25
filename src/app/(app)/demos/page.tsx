import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { demoScope, loadDemoViews, requestOrigin } from "@/lib/server/demos";
import { DemosBoard } from "@/components/demos/DemosBoard";

export const dynamic = "force-dynamic";

/** The team's demo board: every demo being built or waiting on the client. */
export default async function DemosPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const user = await requireUser();
  const { open } = await searchParams;
  const [demos, team] = await Promise.all([
    loadDemoViews(demoScope(user), await requestOrigin()),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return <DemosBoard demos={demos} team={team} me={{ id: user.id, name: user.name }} openId={open ?? null} />;
}
