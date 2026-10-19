import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { leadScope } from "@/lib/access";
import { OPEN_STAGES } from "@/lib/domain";
import { QuickLogForm } from "@/components/QuickLogForm";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const user = await requireUser();
  const leads = await db.lead.findMany({
    where: { AND: [leadScope(user), { stage: { in: OPEN_STAGES } }] },
    select: { id: true, company: true, contactName: true },
    orderBy: { company: "asc" },
  });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quick log</h1>
        <p className="text-sm text-slate-500">Just left a site or hung up? Log it in a few taps.</p>
      </div>
      <div className="card p-4">
        <QuickLogForm leads={leads} redirectTo="/today" />
      </div>
    </div>
  );
}
