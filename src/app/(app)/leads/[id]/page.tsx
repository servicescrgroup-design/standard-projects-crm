import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { canAssignTo, canSeeLead } from "@/lib/access";
import {
  ACTIVITY_LABELS,
  OUTCOME_LABELS,
  STAGES,
  STAGE_LABELS,
  type ActivityType,
  type Outcome,
} from "@/lib/domain";
import { QuickLogForm } from "@/components/QuickLogForm";
import { updateLead } from "../../../actions";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = { GMAIL: "Gmail", CALENDAR: "Calendar", BOT: "Bot", WEBSITE: "Website", QUOTE: "Quote form", MANUAL: "" };
const fmt = (d: Date | null) =>
  d ? d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const pounds = (p: number) => (p ? String(p / 100) : "");

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: { owner: true, activities: { include: { user: true }, orderBy: { occurredAt: "desc" } } },
  });
  if (!lead || !canSeeLead(user, lead)) notFound();

  const candidates = await db.user.findMany({ orderBy: { name: "asc" } });
  const assignable = candidates.filter((c) => canAssignTo(user, c));
  const canAssign = user.role !== "REP";

  return (
    <div className="space-y-5">
      <Link href="/leads" className="text-sm text-slate-500 hover:text-slate-900">
        ← Leads
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{lead.company}</h1>
          <p className="text-slate-500">
            {[lead.contactName, lead.location, lead.industry].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex gap-2">
          {lead.phone && (
            <a className="btn-ghost" href={`tel:${lead.phone.replace(/\s/g, "")}`}>
              Call {lead.phone}
            </a>
          )}
          {lead.email && (
            <a className="btn-ghost" href={`mailto:${lead.email}`}>
              Email
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Stage", STAGE_LABELS[lead.stage as keyof typeof STAGE_LABELS] ?? lead.stage],
          ["Next follow-up", fmt(lead.nextFollowUpAt)],
          ["Last contact", fmt(lead.lastContactAt)],
          ["Unanswered touches", String(lead.unansweredTouches)],
        ].map(([k, v]) => (
          <div key={k} className="card p-3">
            <div className="text-xs text-slate-500">{k}</div>
            <div className="mt-0.5 font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Log activity</h2>
            <QuickLogForm leadId={lead.id} />
          </section>

          <section className="card">
            <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">History</h2>
            <ul className="divide-y divide-slate-100">
              {lead.activities.map((a) => (
                <li key={a.id} className="flex gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{ACTIVITY_LABELS[a.type as ActivityType] ?? a.type}</span>
                      {a.outcome && <span className="chip">{OUTCOME_LABELS[a.outcome as Outcome] ?? a.outcome}</span>}
                      {SOURCE_LABEL[a.source] && (
                        <span className="chip bg-indigo-50 text-indigo-700">Auto · {SOURCE_LABEL[a.source]}</span>
                      )}
                    </div>
                    {a.summary && <p className="mt-0.5 text-sm text-slate-600">{a.summary}</p>}
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-500">
                    <div>{fmt(a.occurredAt)}</div>
                    <div>{a.user?.name}</div>
                  </div>
                </li>
              ))}
              {lead.activities.length === 0 && <li className="px-4 py-6 text-sm text-slate-500">Nothing logged yet.</li>}
            </ul>
          </section>
        </div>

        <section className="card h-fit p-4">
          <h2 className="mb-3 font-semibold">Details</h2>
          <form action={updateLead} className="space-y-3">
            <input type="hidden" name="leadId" value={lead.id} />
            <div>
              <label className="label">Stage</label>
              <select name="stage" defaultValue={lead.stage} className="input">
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">Moves forward automatically as you log. Change it here to override.</p>
            </div>
            {canAssign ? (
              <div>
                <label className="label">Owner</label>
                <select name="ownerId" defaultValue={lead.ownerId ?? ""} className="input">
                  <option value="">Unassigned</option>
                  {assignable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  {lead.owner && !assignable.some((p) => p.id === lead.ownerId) && (
                    <option value={lead.owner.id}>{lead.owner.name}</option>
                  )}
                </select>
              </div>
            ) : (
              <div className="text-sm">
                <span className="text-slate-500">Owner: </span>
                {lead.owner?.name ?? "Unassigned"}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">One-off (£)</label>
                <input name="value" defaultValue={pounds(lead.value)} inputMode="decimal" className="input" />
              </div>
              <div>
                <label className="label">Monthly (£)</label>
                <input name="monthlyValue" defaultValue={pounds(lead.monthlyValue)} inputMode="decimal" className="input" />
              </div>
            </div>
            <div>
              <label className="label">Contact</label>
              <input name="contactName" defaultValue={lead.contactName ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input name="email" defaultValue={lead.email ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input name="phone" defaultValue={lead.phone ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Website</label>
              <input name="website" defaultValue={lead.website ?? ""} className="input" />
            </div>
            <button className="btn-primary">Save changes</button>
          </form>
        </section>
      </div>
    </div>
  );
}
