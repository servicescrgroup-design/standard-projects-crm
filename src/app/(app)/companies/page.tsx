import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { leadWhere, type LeadFilterParams } from "@/lib/server/leadFilters";
import { canAssignTo, leadScope } from "@/lib/access";
import { computeCAC } from "@/lib/acquisition";
import { STAGE_LABELS, STAGE_PILL, WON_STAGES, type Stage } from "@/lib/domain";
import { DealsToolbar } from "@/components/deals/DealsToolbar";
import { AcquisitionWidget } from "@/components/companies/AcquisitionWidget";
import { CompaniesTable, type CompanyRow } from "@/components/companies/CompaniesTable";

export const dynamic = "force-dynamic";

type Search = LeadFilterParams & { view?: string; sort?: string; dir?: string; page?: string; per?: string };
const SORTABLE: Record<string, (dir: Prisma.SortOrder) => Prisma.LeadOrderByWithRelationInput[]> = {
  company: (d) => [{ company: d }],
  stage: (d) => [{ stage: d }, { company: "asc" }],
  contact: (d) => [{ contactName: { sort: d, nulls: "last" } }],
  segment: (d) => [{ segment: { sort: d, nulls: "last" } }, { company: "asc" }],
  owner: (d) => [{ owner: { name: d } }, { company: "asc" }],
  priority: (d) => [{ priority: { sort: d, nulls: "last" } }, { company: "asc" }],
  updated: () => [{ updatedAt: "desc" }],
  value: () => [{ value: "desc" }],
  due: () => [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }],
};

/** Best external link for a company: LinkedIn if we have it, else the website or first social link. */
function bestLink(website: string | null, social: string | null): CompanyRow["link"] {
  const links = (social ?? "").split(/[;\s,]+/).filter((s) => /^https?:\/\//i.test(s));
  const linkedin = links.find((l) => /linkedin\.com/i.test(l));
  const href = linkedin ?? website ?? links[0];
  if (!href) return null;
  return { href, label: href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 40) };
}

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;
  const view = params.view === "gallery" ? "gallery" : "list";
  const sort = params.sort && SORTABLE[params.sort] ? params.sort : "priority";
  const dir: Prisma.SortOrder = params.dir === "desc" ? "desc" : "asc";
  const per = [25, 50, 100].includes(Number(params.per)) ? Number(params.per) : 25;
  const where = leadWhere(user, params);
  const total = await db.lead.count({ where });
  const pages = Math.max(1, Math.ceil(total / per));
  const page = Math.min(pages, Math.max(1, Number(params.page) || 1));
  const now = new Date();

  const [leads, everyone, spends, won] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: SORTABLE[sort](dir),
      skip: (page - 1) * per,
      take: per,
      select: { id: true, company: true, location: true, website: true, socialLinks: true, stage: true, contactName: true, phone: true, segment: true, industry: true, priority: true, owner: { select: { name: true } } },
    }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, teamId: true } }),
    db.acquisitionSpend.findMany({ orderBy: [{ month: "desc" }, { source: "asc" }] }),
    db.lead.findMany({ where: { AND: [leadScope(user), { stage: { in: WON_STAGES } }] }, select: { source: true, stageChangedAt: true } }),
  ]);
  const cac = computeCAC(spends, won.map((w) => ({ source: w.source, wonAt: w.stageChangedAt })), now);

  const rows: CompanyRow[] = leads.map((l) => ({
    id: l.id,
    company: l.company,
    area: l.location,
    link: bestLink(l.website, l.socialLinks),
    stageLabel: STAGE_LABELS[l.stage as Stage] ?? l.stage,
    stagePill: STAGE_PILL[l.stage as Stage] ?? "",
    contact: l.contactName,
    phone: l.phone,
    position: [l.segment, l.industry].filter(Boolean).join(" · ") || null,
    owner: l.owner?.name ?? null,
    priority: l.priority,
  }));

  const href = (patch: Record<string, string | number | null>) => {
    const sp = new URLSearchParams(Object.entries(params).filter(([, v]) => typeof v === "string" && v) as [string, string][]);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, String(v));
    }
    return `/companies?${sp.toString()}`;
  };
  const sortHref = Object.fromEntries(Object.keys(SORTABLE).map((k) => [k, href({ sort: k, dir: sort === k && dir === "asc" ? "desc" : "asc", page: null })]));
  const pageList = Array.from(new Set([1, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages))).sort((a, b) => a - b);
  const canAssign = user.role !== "REP";

  return (
    <div className="space-y-5">
      <AcquisitionWidget
        average={cac.average}
        channels={cac.channels}
        months={cac.months}
        hasSpend={cac.hasSpend}
        newCustomers={cac.newCustomers}
        history={spends.map((s) => ({ source: s.source, month: s.month, amount: s.amount }))}
        isOwner={user.role === "OWNER"}
      />
      <DealsToolbar people={everyone.filter((p) => canAssignTo(user, p)).map((p) => ({ id: p.id, name: p.name }))} canAssign={canAssign} isOwner={user.role === "OWNER"} views={["list", "gallery"]} placeholder="Search companies…" groupable={false} />
      <CompaniesTable rows={rows} view={view} canAssign={canAssign} people={everyone.filter((p) => canAssignTo(user, p)).map((p) => ({ id: p.id, name: p.name }))} sortHref={sortHref} sort={sort} dir={dir} />
      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Pagination">
        <span className="text-ink-2">
          {total ? `${(page - 1) * per + 1}–${Math.min(page * per, total)} of ${total.toLocaleString("en-GB")}` : "0 companies"}
        </span>
        <div className="flex items-center gap-1">
          <Link aria-disabled={page === 1} href={href({ page: page - 1 })} className={`btn-ghost px-2.5 py-1.5 ${page === 1 ? "pointer-events-none opacity-40" : ""}`}>Previous</Link>
          {pageList.map((p, i) => (
            <span key={p} className="flex items-center">
              {i > 0 && p - pageList[i - 1] > 1 && <span className="px-1 text-ink-3">…</span>}
              <Link href={href({ page: p })} aria-current={p === page ? "page" : undefined} className={`min-w-8 rounded-lg px-2 py-1.5 text-center ${p === page ? "bg-ink text-white" : "hover:bg-hover"}`}>{p}</Link>
            </span>
          ))}
          <Link aria-disabled={page === pages} href={href({ page: page + 1 })} className={`btn-ghost px-2.5 py-1.5 ${page === pages ? "pointer-events-none opacity-40" : ""}`}>Next</Link>
        </div>
        <div className="flex items-center gap-2 text-ink-2">
          Rows per page
          {[25, 50, 100].map((n) => (
            <Link key={n} href={href({ per: n === 25 ? null : n, page: null })} className={`rounded-md px-2 py-1 ${per === n ? "bg-line-soft font-semibold text-ink" : "hover:bg-hover"}`}>{n}</Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
