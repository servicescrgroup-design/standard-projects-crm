import Link from "next/link";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { leadScope, teamScope } from "@/lib/access";
import { STAGES, STAGE_LABELS, formatGBP, isStage, type Stage } from "@/lib/domain";
import { createLead } from "../../actions";

export const dynamic = "force-dynamic";

type Search = { q?: string; stage?: string; owner?: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const { q = "", stage = "", owner = "" } = await searchParams;
  const isManager = user.role !== "REP";

  const filters = [leadScope(user)] as object[];
  if (q) filters.push({ OR: [{ company: { contains: q } }, { contactName: { contains: q } }, { email: { contains: q } }] });
  if (isStage(stage)) filters.push({ stage });
  if (isManager && owner) filters.push({ ownerId: owner === "none" ? null : owner });

  const [leads, people] = await Promise.all([
    db.lead.findMany({ where: { AND: filters }, include: { owner: true }, orderBy: { updatedAt: "desc" }, take: 500 }),
    db.user.findMany({ where: teamScope(user), orderBy: { name: "asc" } }),
  ]);
  const assignable = user.role === "OWNER" ? await db.user.findMany({ orderBy: { name: "asc" } }) : people;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Leads</h1>
          <p className="text-sm text-slate-500">
            {user.role === "REP" ? "Your leads." : user.role === "TEAM_LEAD" ? "Your team's leads and the unassigned pool." : "Every lead in the business."}
          </p>
        </div>
      </div>

      <details className="card group p-4">
        <summary className="cursor-pointer list-none font-medium text-blue-700">+ Add lead</summary>
        <form action={createLead} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Company name *</label>
            <input name="company" required className="input" />
          </div>
          <div>
            <label className="label">Contact name</label>
            <input name="contactName" className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" type="tel" className="input" />
          </div>
          <div>
            <label className="label">Website</label>
            <input name="website" className="input" placeholder="example.co.uk" />
          </div>
          <div>
            <label className="label">Industry</label>
            <input name="industry" className="input" placeholder="Construction & property" />
          </div>
          <div>
            <label className="label">One-off value (£)</label>
            <input name="value" inputMode="decimal" className="input" />
          </div>
          <div>
            <label className="label">Monthly value (£)</label>
            <input name="monthlyValue" inputMode="decimal" className="input" />
          </div>
          {isManager && (
            <div>
              <label className="label">Assign to</label>
              <select name="ownerId" className="input" defaultValue={user.id}>
                <option value="">Unassigned</option>
                {assignable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <button className="btn-primary">Save lead</button>
            <span className="ml-3 text-xs text-slate-500">Only the company name is required. It goes straight into Today.</span>
          </div>
        </form>
      </details>

      <form className="card flex flex-wrap gap-2 p-3">
        <input name="q" defaultValue={q} placeholder="Search company, contact or email" className="input min-w-48 flex-1" />
        <select name="stage" defaultValue={stage} className="input w-auto">
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        {isManager && (
          <select name="owner" defaultValue={owner} className="input w-auto">
            <option value="">Everyone</option>
            <option value="none">Unassigned</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <button className="btn-ghost">Filter</button>
      </form>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-2 text-sm text-slate-500">{leads.length} leads</div>
        <ul className="divide-y divide-slate-100">
          {leads.map((l) => (
            <li key={l.id}>
              <Link href={`/leads/${l.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{l.company}</div>
                  <div className="truncate text-sm text-slate-500">{[l.contactName, l.industry].filter(Boolean).join(" · ")}</div>
                </div>
                <span className="chip">{STAGE_LABELS[l.stage as Stage] ?? l.stage}</span>
                <span className="w-24 text-right text-sm tabular-nums text-slate-600">
                  {l.monthlyValue ? `${formatGBP(l.monthlyValue)}/mo` : l.value ? formatGBP(l.value) : "—"}
                </span>
                {isManager && (
                  <span className={`w-28 truncate text-right text-sm ${l.owner ? "text-slate-600" : "font-medium text-amber-700"}`}>
                    {l.owner?.name ?? "Unassigned"}
                  </span>
                )}
              </Link>
            </li>
          ))}
          {leads.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500">No leads match.</li>}
        </ul>
      </div>
    </div>
  );
}
