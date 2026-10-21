import Link from "next/link";
import { Select } from "@/components/ui/Select";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { canAssignTo, leadScope, teamScope } from "@/lib/access";
import {
  PRIORITIES,
  SEGMENTS,
  SOURCES,
  SOURCE_LABELS,
  STAGES,
  STAGE_LABELS,
  formatMoney,
  isPriority,
  isSource,
  isStage,
  type Source,
  type Stage,
} from "@/lib/domain";
import { LeadTable } from "@/components/LeadTable";
import { createLead } from "../../actions";
import { DuplicateWarning } from "@/components/DuplicateWarning";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type Search = { q?: string; stage?: string; owner?: string; priority?: string; segment?: string; source?: string; page?: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;
  const { q = "", stage = "", owner = "", priority = "", segment = "", source = "" } = params;
  const page = Math.max(1, Number(params.page) || 1);
  const isManager = user.role !== "REP";

  const filters: Prisma.LeadWhereInput[] = [leadScope(user)];
  if (q)
    filters.push({
      OR: [
        { company: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { location: { contains: q, mode: "insensitive" } },
      ],
    });
  if (isStage(stage)) filters.push({ stage });
  if (isPriority(priority)) filters.push({ priority });
  if ((SEGMENTS as readonly string[]).includes(segment)) filters.push({ segment });
  if (isSource(source)) filters.push({ source });
  if (isManager && owner) filters.push({ ownerId: owner === "none" ? null : owner });
  const where = { AND: filters };

  const [total, leads, people, everyone] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      include: { owner: true },
      // Strongest prospects first, then most recently touched.
      orderBy: [{ priority: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.user.findMany({ where: teamScope(user), orderBy: { name: "asc" } }),
    db.user.findMany({ orderBy: { name: "asc" } }),
  ]);
  const assignable = everyone.filter((p) => canAssignTo(user, p));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => {
    const sp = new URLSearchParams(Object.entries({ q, stage, owner, priority, segment, source }).filter(([, v]) => v));
    if (n > 1) sp.set("page", String(n));
    return `/leads?${sp.toString()}`;
  };

  const rows = leads.map((l) => ({
    id: l.id,
    company: l.company,
    subtitle: [l.segment, l.location, l.contactName, l.phone].filter(Boolean).join(" · "),
    stageLabel: STAGE_LABELS[l.stage as Stage] ?? l.stage,
    priority: l.priority,
    sourceLabel: l.source !== "MANUAL" ? (SOURCE_LABELS[l.source as Source] ?? l.source) : null,
    valueLabel: l.monthlyValue ? `${formatMoney(l.monthlyValue)}/mo` : l.value ? formatMoney(l.value) : "—",
    ownerName: l.owner?.name ?? null,
    phone: l.phone,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Leads</h1>
        <p className="text-sm text-ink-3">
          {user.role === "REP"
            ? "Your leads."
            : user.role === "TEAM_LEAD"
              ? "Your team's leads and the unassigned pool."
              : "Every lead in the business."}{" "}
          Strongest prospects (priority A) first.
        </p>
      </div>

      <details className="card group p-4">
        <summary className="cursor-pointer list-none font-medium text-brand-700">+ Add lead</summary>
        <form action={createLead} className="mt-4 grid gap-3 sm:grid-cols-2">
          <DuplicateWarning />
          <div>
            <label className="label" htmlFor="nl-company">Company name *</label>
            <input id="nl-company" name="company" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="nl-contact">Contact name</label>
            <input id="nl-contact" name="contactName" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="nl-email">Email</label>
            <input id="nl-email" name="email" type="email" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="nl-phone">Phone or LINE ID</label>
            <input id="nl-phone" name="phone" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="nl-segment">Segment</label>
            <Select id="nl-segment" name="segment" defaultValue="" options={[{ value: "", label: "—" }, ...SEGMENTS.map((s) => ({ value: s, label: s }))]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="nl-priority">Priority</label>
              <Select id="nl-priority" name="priority" defaultValue="B" options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
            </div>
            <div>
              <label className="label" htmlFor="nl-source">Source</label>
              <Select id="nl-source" name="source" defaultValue="MANUAL" options={SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="nl-website">Website</label>
            <input id="nl-website" name="website" className="input" placeholder="example.com" />
          </div>
          <div>
            <label className="label" htmlFor="nl-location">Area</label>
            <input id="nl-location" name="location" className="input" placeholder="Nimman, Old City…" />
          </div>
          <div>
            <label className="label" htmlFor="nl-value">One-off value (฿)</label>
            <input id="nl-value" name="value" inputMode="decimal" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="nl-monthly">Monthly care plan (฿)</label>
            <input id="nl-monthly" name="monthlyValue" inputMode="decimal" className="input" />
          </div>
          {isManager && (
            <div>
              <label className="label" htmlFor="nl-owner">Assign to</label>
              <Select id="nl-owner" name="ownerId" defaultValue={user.id} options={[{ value: "", label: "Unassigned" }, ...assignable.map((p) => ({ value: p.id, label: p.name }))]} />
            </div>
          )}
          <div className="sm:col-span-2">
            <button className="btn-primary">Save lead</button>
            <span className="ml-3 text-xs text-ink-3">Only the company name is required.</span>
          </div>
        </form>
      </details>

      <form className="card flex flex-wrap gap-2 p-3">
        <input name="q" defaultValue={q} placeholder="Search name, phone, email or area" className="input min-w-48 flex-1" aria-label="Search" />
        <Select name="priority" ariaLabel="Priority" autoSubmit defaultValue={priority ?? ""} className="w-auto min-w-36" options={[{ value: "", label: "Any priority" }, ...PRIORITIES.map((p) => ({ value: p, label: `Priority ${p}` }))]} />
        <Select name="segment" ariaLabel="Industry" autoSubmit defaultValue={segment ?? ""} className="w-auto min-w-40" options={[{ value: "", label: "All industries" }, ...SEGMENTS.map((s) => ({ value: s, label: s }))]} />
        <Select name="stage" ariaLabel="Stage" autoSubmit defaultValue={stage ?? ""} className="w-auto min-w-36" options={[{ value: "", label: "All stages" }, ...STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))]} />
        <Select name="source" ariaLabel="Source" autoSubmit defaultValue={source ?? ""} className="w-auto min-w-36" options={[{ value: "", label: "All sources" }, ...SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))]} />
        {isManager && (
          <Select name="owner" ariaLabel="Owner" autoSubmit defaultValue={owner ?? ""} className="w-auto min-w-36" options={[{ value: "", label: "Everyone" }, { value: "none", label: "Unassigned" }, ...people.map((p) => ({ value: p.id, label: p.name }))]} />
        )}
        <button className="btn-ghost">Filter</button>
        {(q || stage || owner || priority || segment || source) && (
          <Link href="/leads" className="btn">
            Clear
          </Link>
        )}
      </form>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-2 text-sm text-ink-3">
          <span>
            {total.toLocaleString("en-GB")} lead{total === 1 ? "" : "s"}
            {pages > 1 && ` · page ${page} of ${pages}`}
          </span>
          {pages > 1 && (
            <span className="flex gap-2">
              {page > 1 && (
                <Link className="btn-ghost px-2.5 py-1 text-xs" href={pageHref(page - 1)}>
                  ← Previous
                </Link>
              )}
              {page < pages && (
                <Link className="btn-ghost px-2.5 py-1 text-xs" href={pageHref(page + 1)}>
                  Next →
                </Link>
              )}
            </span>
          )}
        </div>
        <LeadTable rows={rows} canAssign={isManager} people={assignable.map((p) => ({ id: p.id, name: p.name }))} />
      </div>
    </div>
  );
}
