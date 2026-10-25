import Link from "next/link";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { canManagePeople, canSendEmail, leadScope } from "@/lib/access";
import { ensureOutreachDefaults } from "@/lib/server/sequences";
import { enrollmentLabel } from "@/lib/sequences";
import { SequencesBoard, type SequenceView, type TemplateView } from "@/components/outreach/SequencesBoard";
import { TemplatesBoard } from "@/components/outreach/TemplatesBoard";
import { SEGMENTS } from "@/lib/domain";

export const dynamic = "force-dynamic";

/** Outreach: automatic email sequences and reusable templates. */
export default async function OutreachPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { tab } = await searchParams;
  await ensureOutreachDefaults(user.id);
  const canEdit = canSendEmail(user);

  const [templates, sequences, counts, recent, segments, replyStats] = await Promise.all([
    db.emailTemplate.findMany({ orderBy: [{ language: "asc" }, { category: "asc" }, { name: "asc" }] }),
    db.sequence.findMany({ orderBy: { createdAt: "asc" }, include: { steps: { orderBy: { position: "asc" }, include: { template: { select: { name: true } } } } } }),
    db.sequenceEnrollment.groupBy({ by: ["sequenceId", "status"], where: { lead: leadScope(user) }, _count: { _all: true } }),
    db.sequenceEnrollment.findMany({
      where: { lead: leadScope(user) },
      orderBy: { updatedAt: "desc" },
      take: 60,
      include: { lead: { select: { id: true, company: true } }, sequence: { select: { name: true, steps: { select: { id: true } } } } },
    }),
    db.lead.groupBy({ by: ["segment"], where: { segment: { not: null } }, _count: { _all: true } }),
    // Per template: emails sent, and how many got a reply within 14 days.
    db.$queryRaw<{ templateId: string; sent: bigint; replied: bigint }[]>`
      SELECT d."templateId", COUNT(*) AS sent,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM "Activity" a WHERE a."leadId" = d."leadId" AND a.type = 'EMAIL_IN'
            AND a."occurredAt" > d."sentAt" AND a."occurredAt" < d."sentAt" + INTERVAL '14 days'
        )) AS replied
      FROM "EmailDraft" d
      WHERE d.status = 'SENT' AND d."templateId" IS NOT NULL AND d."sentAt" IS NOT NULL
      GROUP BY d."templateId"`,
  ]);
  const stats = new Map(replyStats.map((r) => [r.templateId, { sent: Number(r.sent), replied: Number(r.replied) }]));
  // Industries for the template creator: the ones leads actually have (most common first), then the standard list.
  const industries = [...new Set([...segments.sort((a, b) => b._count._all - a._count._all).map((s) => s.segment!), ...SEGMENTS])];
  const enrollers = await db.user.findMany({ where: { id: { in: [...new Set(recent.map((r) => r.enrolledById))] } }, select: { id: true, name: true } });

  const tplViews: TemplateView[] = templates.map((t) => ({ id: t.id, name: t.name, category: t.category, language: t.language, subject: t.subject, body: t.body, countries: t.countries, industries: t.industries, stats: stats.get(t.id) ?? null }));
  const seqViews: SequenceView[] = sequences.map((s) => {
    const stat = (st: string) => counts.find((c) => c.sequenceId === s.id && c.status === st)?._count._all ?? 0;
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      active: s.active,
      steps: s.steps.map((st) => ({ templateId: st.templateId, waitDays: st.waitDays, templateName: st.template.name })),
      stats: { active: stat("ACTIVE"), pending: stat("PENDING_APPROVAL"), replied: stat("REPLIED"), completed: stat("COMPLETED"), stopped: stat("STOPPED") + stat("FAILED") },
    };
  });
  const tabs = [
    { id: "sequences", label: "Sequences" },
    { id: "templates", label: "Templates" },
  ];
  const current = tab === "templates" ? "templates" : "sequences";

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-ink-2">
        Send a series of personal-looking emails from your own Gmail or Outlook, days apart, that stop the moment someone replies. Add leads from a lead page,
        or tick them on Companies or Contacts and choose <b>Add to sequence</b>. Emails go out every 10 minutes, at most {`${25}`} per mailbox per run and 120 a day.
      </p>
      <nav className="flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <Link key={t.id} href={`/outreach?tab=${t.id}`} className={`-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium ${current === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-ink-2 hover:text-ink"}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {current === "sequences" ? (
        <>
          <SequencesBoard sequences={seqViews} templates={tplViews} canEdit={canEdit} canRunNow={canManagePeople(user)} />
          <section className="card">
            <h2 className="border-b border-line-soft px-4 py-3 font-semibold">Recent activity</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-2">
                    <th className="px-4 py-2 font-medium">Lead</th>
                    <th className="px-3 py-2 font-medium">Sequence</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Progress</th>
                    <th className="px-3 py-2 font-medium">Next email</th>
                    <th className="px-3 py-2 font-medium">Started by</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-b border-line-soft last:border-0">
                      <td className="px-4 py-2"><Link href={`/leads/${r.lead.id}#email`} className="font-medium hover:text-brand-700">{r.lead.company}</Link></td>
                      <td className="px-3 py-2 text-ink-2">{r.sequence.name}</td>
                      <td className="px-3 py-2">
                        <span className={`pill ${r.status === "REPLIED" ? "bg-emerald-50 text-emerald-700" : r.status === "ACTIVE" ? "bg-brand-50 text-brand-700" : r.status === "PENDING_APPROVAL" ? "bg-amber-50 text-amber-700" : r.status === "FAILED" ? "bg-rose-50 text-rose-700" : "bg-line-soft text-ink-2"}`}>{enrollmentLabel(r.status)}</span>
                        {r.stopReason && r.status !== "REPLIED" && <div className="mt-0.5 text-xs text-ink-3">{r.stopReason}</div>}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink-2">{Math.min(r.stepIndex, r.sequence.steps.length)} / {r.sequence.steps.length} sent</td>
                      <td className="px-3 py-2 text-ink-2">{r.status === "ACTIVE" && r.nextRunAt ? r.nextRunAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="px-3 py-2 text-ink-2">{enrollers.find((u) => u.id === r.enrolledById)?.name ?? "—"}</td>
                    </tr>
                  ))}
                  {recent.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-3">No one is in a sequence yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <TemplatesBoard templates={tplViews} canEdit={canEdit} industries={industries} />
      )}
    </div>
  );
}
