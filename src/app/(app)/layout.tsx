import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { buildQueue } from "@/lib/queue";
import { OPEN_STAGES } from "@/lib/domain";
import { BottomNav, SideNav } from "@/components/Nav";
import { signOut } from "../actions";

const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", TEAM_LEAD: "Team lead", REP: "Sales rep" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // "Today" badge counts only the viewer's own leads, whatever their role.
  const mine = await db.lead.findMany({ where: { ownerId: user.id, stage: { in: OPEN_STAGES } } });
  const dueCount = buildQueue(mine).length;

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 px-2">
          <div className="text-lg font-bold tracking-tight">Standard Projects</div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Sales workspace</div>
        </div>
        <SideNav dueCount={dueCount} showSettings={user.role === "OWNER"} />
        <div className="mt-auto flex items-center gap-3 border-t border-slate-100 px-2 pt-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
            {user.name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="text-xs text-slate-500">{ROLE_LABEL[user.role] ?? user.role}</div>
          </div>
          <form action={signOut}>
            <button className="text-xs text-slate-500 hover:text-slate-900" title="Switch user">
              Switch
            </button>
          </form>
        </div>
      </aside>
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="font-bold">Standard Projects</span>
        <form action={signOut}>
          <button className="text-xs text-slate-500">
            {user.name} · Switch
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 pb-24 md:p-8">{children}</main>
      <BottomNav dueCount={dueCount} showSettings={user.role === "OWNER"} />
    </div>
  );
}
