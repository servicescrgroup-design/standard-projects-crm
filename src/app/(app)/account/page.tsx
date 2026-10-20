import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";
const ROLE: Record<string, string> = { OWNER: "Owner (sees everything)", TEAM_LEAD: "Team lead (your team and unassigned leads)", REP: "Sales rep (your own leads)" };

export default async function AccountPage() {
  const user = await requireUser();
  const team = user.teamId ? await db.team.findUnique({ where: { id: user.teamId } }) : null;
  return (
    <div className="card max-w-xl divide-y divide-line-soft">
      {[["Name", user.name], ["Email", user.email], ["Role", ROLE[user.role] ?? user.role], ["Team", team?.name ?? "No team"]].map(([k, v]) => (
        <div key={k} className="flex gap-4 px-5 py-3.5 text-sm"><span className="w-24 text-ink-2">{k}</span><span className="font-medium">{v}</span></div>
      ))}
      <p className="px-5 py-3.5 text-sm text-ink-2">To change your password, ask the owner for a reset link. Your current password keeps working until you use it.</p>
    </div>
  );
}
