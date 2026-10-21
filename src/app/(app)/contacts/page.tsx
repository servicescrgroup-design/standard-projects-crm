import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ArrowDown, ArrowUp, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { leadScope } from "@/lib/access";
import { leadWhere, leadWhereWithCountry } from "@/lib/server/leadFilters";
import { DAY_MS, STAGES, STAGE_LABELS, isStage, type Stage } from "@/lib/domain";
import { websiteDomain } from "@/lib/matching";
import { pctChange } from "@/lib/analytics";
import { countryOfLead } from "@/lib/countries";
import { Avatar, ContactsTable, type ContactRow } from "@/components/contacts/ContactsTable";
import { AddContactButton } from "@/components/contacts/AddContactButton";
import { MultiSelect, Select } from "@/components/ui/Select";

export const dynamic = "force-dynamic";

type Params = { q?: string; cat?: string | string[]; country?: string | string[]; range?: string; stage?: string; email?: string; sort?: string; page?: string };

const PAGE_SIZE = 25;
const RANGES: Record<string, { label: string; days: number | null }> = {
  all: { label: "All time", days: null },
  "30": { label: "Last 30 days", days: 30 },
  "7": { label: "Last 7 days", days: 7 },
};
const NO_CATEGORY = "Uncategorised";
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
const HAS_CONTACT: Prisma.LeadWhereInput = { OR: [{ contactName: { not: null } }, { email: { not: null } }, { phone: { not: null } }] };

function statusOf(stage: string): ContactRow["status"] {
  if (stage === "WON" || stage === "MAINTENANCE") return { label: "Customer", tone: "customer" };
  if (stage === "LOST") return { label: "Lost", tone: "lost" };
  return { label: STAGE_LABELS[stage as Stage] ?? stage, tone: "open" };
}

/** People to talk to: the contact on each lead you can see, with category tabs, filters and paging. */
export default async function ContactsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  const p = await searchParams;
  const cats = list(p.cat);
  const countries = list(p.country);
  const range = RANGES[p.range ?? ""] ? (p.range as string) : "all";
  const stage = isStage(p.stage) ? p.stage : undefined;
  const emailOnly = p.email === "1";
  const sort = p.sort === "recent" ? "recent" : "company";
  const now = Date.now();

  // URL helper that keeps every other filter.
  const href = (patch: Partial<Record<keyof Params, string | string[] | undefined>>) => {
    const next = { q: p.q, cat: cats, country: countries, range: range === "all" ? undefined : range, stage, email: emailOnly ? "1" : undefined, sort: sort === "company" ? undefined : sort, page: undefined, ...patch };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) for (const x of list(v as string | string[] | undefined)) qs.append(k, x);
    const s = qs.toString();
    return s ? `/contacts?${s}` : "/contacts";
  };
  const toggled = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const scope: Prisma.LeadWhereInput = { AND: [leadScope(user), HAS_CONTACT] };
  const filters: Prisma.LeadWhereInput[] = [leadWhere(user, { q: p.q, stage }), HAS_CONTACT];
  if (cats.length) {
    const named = cats.filter((c) => c !== NO_CATEGORY);
    filters.push({ OR: [...(named.length ? [{ segment: { in: named } }] : []), ...(cats.includes(NO_CATEGORY) ? [{ segment: null }] : [])] });
  }
  if (countries.length) {
    const byCountry = await leadWhereWithCountry(user, { country: countries.join(",") });
    filters.push(byCountry);
  }

  if (RANGES[range].days) filters.push({ createdAt: { gte: new Date(now - RANGES[range].days! * DAY_MS) } });
  if (emailOnly) filters.push({ email: { not: null } });
  const where: Prisma.LeadWhereInput = { AND: filters };

  const [total, last30, prev30, withEmail, contactedThisWeek, segments, locations, matching] = await Promise.all([
    db.lead.count({ where: scope }),
    db.lead.count({ where: { AND: [scope, { createdAt: { gte: new Date(now - 30 * DAY_MS) } }] } }),
    db.lead.count({ where: { AND: [scope, { createdAt: { gte: new Date(now - 60 * DAY_MS), lt: new Date(now - 30 * DAY_MS) } }] } }),
    db.lead.count({ where: { AND: [scope, { email: { not: null } }] } }),
    db.lead.findMany({ where: { AND: [scope, { lastContactAt: { gte: new Date(now - 7 * DAY_MS) } }] }, select: { owner: { select: { name: true } } }, take: 500 }),
    db.lead.groupBy({ by: ["segment"], where: scope, _count: { _all: true } }),
    db.lead.findMany({ where: scope, select: { location: true, industry: true, phone: true, company: true }, take: 8000 }),
    db.lead.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(matching / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(p.page) || 1));
  const leads = await db.lead.findMany({
    where,
    orderBy: sort === "company" ? [{ company: "asc" }] : [{ createdAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true, company: true, contactName: true, email: true, phone: true, website: true, location: true, industry: true,
      segment: true, needs: true, whyFit: true, stage: true, owner: { select: { name: true } },
    },
  });

  const categories = segments
    .map((s) => ({ name: s.segment ?? NO_CATEGORY, count: s._count._all }))
    .sort((a, b) => b.count - a.count);
  const countryCounts = new Map<string, number>();
  const countryFlags = new Map<string, string>();
  for (const l of locations) {
    const found = countryOfLead(l);
    const c = found?.name;
    if (c) countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1);
    if (found) countryFlags.set(found.name, found.flag);
  }
  const countryOptions = [...countryCounts.keys()].sort((a, b) => a.localeCompare(b));
  const activeOwners = [...new Set(contactedThisWeek.map((l) => l.owner?.name).filter((n): n is string => !!n))];
  const growth = pctChange(last30, prev30);

  const openStages: string[] = STAGES.filter((s) => s !== "LOST");
  const rows: ContactRow[] = leads.map((l) => ({
    id: l.id,
    company: l.company,
    domain: websiteDomain(l.website) ?? (l.email?.split("@")[1] ?? null),
    contactName: l.contactName,
    email: l.email,
    phone: l.phone,
    location: l.location,
    country: (() => {
      const c = countryOfLead(l);
      return c ? { name: c.name, flag: c.flag } : null;
    })(),
    about: l.industry ?? l.segment,
    aboutDetail: l.needs ?? l.whyFit ?? l.location,
    status: statusOf(l.stage),
    progress: l.stage === "LOST" ? 1 : (openStages.indexOf(l.stage) + 1) / openStages.length,
    stageLabel: STAGE_LABELS[l.stage as Stage] ?? l.stage,
    owner: l.owner?.name ?? null,
  }));

  const chip = "inline-flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700";
  const countryLabel = countries.length <= 2 ? countries.join(", ") : `${countries.slice(0, 2).join(", ")}, +${countries.length - 2}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <div className="flex gap-2">
          {user.role === "OWNER" && (
            <Link href="/settings#import" className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-hover">
              <Upload className="h-4 w-4" /> Import
            </Link>
          )}
          <AddContactButton />
        </div>
      </div>

      {/* Category tabs: industries, multi-select */}
      <nav aria-label="Categories" className="-mb-px flex gap-1 overflow-x-auto border-b border-line">
        <Link href={href({ cat: [] })} className={`shrink-0 border-b-2 px-3 pb-3 pt-1 text-sm font-medium ${cats.length === 0 ? "border-indigo-600 text-indigo-700" : "border-transparent text-ink-2 hover:text-ink"}`}>
          All <span className="ml-1 text-xs text-ink-3">{total.toLocaleString("en-GB")}</span>
        </Link>
        {categories.map((c) => {
          const on = cats.includes(c.name);
          return (
            <Link
              key={c.name}
              href={href({ cat: toggled(cats, c.name) })}
              aria-pressed={on}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-3 pt-1 text-sm font-medium ${on ? "border-indigo-600 text-indigo-700" : "border-transparent text-ink-2 hover:text-ink"}`}
            >
              <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px] ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-line"}`}>{on ? "✓" : ""}</span>
              {c.name} <span className="text-xs text-ink-3">{c.count.toLocaleString("en-GB")}</span>
            </Link>
          );
        })}
      </nav>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-ink-2">Total contacts</p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p className="text-3xl font-semibold tracking-tight">{total.toLocaleString("en-GB")}</p>
            {growth !== null && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${growth >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`} title="New contacts in the last 30 days compared with the 30 days before">
                {growth >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(growth)}%
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-3">{last30.toLocaleString("en-GB")} added in the last 30 days</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-ink-2">Reachable by email</p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p className="text-3xl font-semibold tracking-tight">{withEmail.toLocaleString("en-GB")}</p>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{total ? Math.round((withEmail / total) * 100) : 0}% of contacts</span>
          </div>
          <p className="mt-1 text-xs text-ink-3">The rest have a phone number only</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-ink-2">Contacted this week</p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p className="text-3xl font-semibold tracking-tight">{contactedThisWeek.length.toLocaleString("en-GB")}</p>
            <span className="flex -space-x-2">
              {activeOwners.slice(0, 5).map((n) => <Avatar key={n} name={n} size="sm" />)}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-3">{activeOwners.length ? `By ${activeOwners.length} teammate${activeOwners.length === 1 ? "" : "s"}` : "No calls or emails logged in 7 days"}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {range !== "all" && (
          <Link href={href({ range: undefined })} className={chip}>{RANGES[range].label} <X className="h-4 w-4" /></Link>
        )}
        {countries.length > 0 && (
          <Link href={href({ country: [] })} className={chip} title={countries.join(", ")}>{countryLabel} <X className="h-4 w-4" /></Link>
        )}
        {stage && <Link href={href({ stage: undefined })} className={chip}>{STAGE_LABELS[stage]} <X className="h-4 w-4" /></Link>}
        {emailOnly && <Link href={href({ email: undefined })} className={chip}>Has email <X className="h-4 w-4" /></Link>}

        <details className="relative">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-hover">
            <SlidersHorizontal className="h-4 w-4" /> {range === "all" && !countries.length && !stage && !emailOnly ? "Filters" : "More filters"}
          </summary>
          <form action="/contacts" className="absolute left-0 z-20 mt-2 w-80 space-y-3 rounded-xl border border-line bg-white p-4 shadow-[var(--shadow-menu)]">
            {p.q && <input type="hidden" name="q" value={p.q} />}
            {cats.map((c) => <input key={c} type="hidden" name="cat" value={c} />)}
            {sort !== "company" && <input type="hidden" name="sort" value={sort} />}
            <div>
              <span className="label">Added</span>
              <Select name="range" ariaLabel="Added" defaultValue={range} options={Object.entries(RANGES).map(([k, r]) => ({ value: k, label: r.label }))} />
            </div>
            <div>
              <span className="label">Stage</span>
              <Select name="stage" ariaLabel="Stage" defaultValue={stage ?? ""} options={[{ value: "", label: "Any stage" }, ...STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))]} />
            </div>
            <div>
              <span className="label">Countries</span>
              <MultiSelect
                name="country"
                ariaLabel="Countries"
                placeholder="All countries"
                defaultValues={countries}
                options={[...countryOptions].sort((a, b) => (countryCounts.get(b) ?? 0) - (countryCounts.get(a) ?? 0)).map((c) => ({ value: c, label: `${countryFlags.get(c) ?? ""} ${c}`.trim(), hint: String(countryCounts.get(c) ?? 0) }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="email" value="1" defaultChecked={emailOnly} className="accent-indigo-600" /> Only contacts with an email
            </label>
            <div className="flex justify-end gap-2">
              <Link href="/contacts" className="rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-hover">Reset</Link>
              <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Apply</button>
            </div>
          </form>
        </details>

        <form action="/contacts" className="relative ml-auto w-full sm:w-80">
          {cats.map((c) => <input key={c} type="hidden" name="cat" value={c} />)}
          {countries.map((c) => <input key={c} type="hidden" name="country" value={c} />)}
          {range !== "all" && <input type="hidden" name="range" value={range} />}
          {stage && <input type="hidden" name="stage" value={stage} />}
          {emailOnly && <input type="hidden" name="email" value="1" />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input name="q" defaultValue={p.q} placeholder="Search" aria-label="Search contacts" className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </form>
      </div>

      <div>
        <ContactsTable sequences={await db.sequence.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })} rows={rows} sort={sort} sortHref={href({ sort: sort === "company" ? "recent" : undefined })} />
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-3">
          {page > 1 ? (
            <Link href={href({ page: String(page - 1) })} className="rounded-lg border border-line px-4 py-2 text-sm font-medium shadow-sm hover:bg-hover">Previous</Link>
          ) : (
            <span className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-3">Previous</span>
          )}
          <span className="text-center text-sm text-ink-2">
            Page {page} of {pages} <span className="hidden text-ink-3 sm:inline">· {matching.toLocaleString("en-GB")} contact{matching === 1 ? "" : "s"}</span>
          </span>
          {page < pages ? (
            <Link href={href({ page: String(page + 1) })} className="rounded-lg border border-line px-4 py-2 text-sm font-medium shadow-sm hover:bg-hover">Next</Link>
          ) : (
            <span className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-3">Next</span>
          )}
        </div>
      </div>
    </div>
  );
}
