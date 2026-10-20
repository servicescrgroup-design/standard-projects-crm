import Link from "next/link";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { leadWhere } from "@/lib/server/leadFilters";
import { STAGE_LABELS, STAGE_PILL, type Stage } from "@/lib/domain";
import { SearchBox } from "@/components/SearchBox";

export const dynamic = "force-dynamic";

const initials = (s: string) => s.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** People to talk to: the contact on each lead you can see. */
export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const leads = await db.lead.findMany({
    where: { AND: [leadWhere(user, { q }), { OR: [{ contactName: { not: null } }, { email: { not: null } }] }] },
    orderBy: [{ contactName: { sort: "asc", nulls: "last" } }],
    take: 300,
    select: { id: true, company: true, contactName: true, email: true, phone: true, stage: true, owner: { select: { name: true } } },
  });
  return (
    <div className="space-y-4">
      <SearchBox q={q} placeholder="Search name, company, phone or email" />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b border-line text-left text-[13px] text-ink-2"><th className="px-4 py-2.5 font-medium">Contact</th><th className="px-3 font-medium">Company</th><th className="px-3 font-medium">Email</th><th className="px-3 font-medium">Phone / LINE</th><th className="px-3 font-medium">Stage</th></tr></thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-line-soft last:border-0 hover:bg-hover">
                <td className="px-4 py-2.5"><span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-line-soft text-[11px] font-semibold text-ink-2">{initials(l.contactName ?? l.company)}</span>{l.contactName ?? <span className="text-ink-3">Unnamed</span>}</span></td>
                <td className="px-3"><Link href={`/leads/${l.id}`} className="hover:text-brand-700">{l.company}</Link></td>
                <td className="px-3">{l.email ? <a href={`mailto:${l.email}`} className="text-brand-700 hover:underline">{l.email}</a> : "—"}</td>
                <td className="px-3">{l.phone ? <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className="hover:text-brand-700">{l.phone}</a> : "—"}</td>
                <td className="px-3"><span className={`pill ${STAGE_PILL[l.stage as Stage] ?? ""}`}>{STAGE_LABELS[l.stage as Stage] ?? l.stage}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-3">No named contacts yet. Add a contact name on a lead and it appears here.</p>}
      </div>
      <p className="text-xs text-ink-3">Showing up to 300. Each lead currently holds one main contact.</p>
    </div>
  );
}
