import Link from "next/link";
import { Info } from "lucide-react";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { scopedActivities } from "@/lib/server/activityQuery";
import { canSendEmail, leadScope } from "@/lib/access";
import { ActivityFeed } from "@/components/ActivityFeed";
import { SearchBox } from "@/components/SearchBox";
import { DraftButtons } from "@/components/email/EmailComposer";
import { EnrollmentApprovals } from "@/components/outreach/EnrollmentApprovals";

export const dynamic = "force-dynamic";

export default async function EmailsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const canSend = canSendEmail(user);
  const [emails, awaiting, mailboxes] = await Promise.all([
    scopedActivities(user, ["EMAIL_OUT", "EMAIL_IN", "PROPOSAL"], q),
    // Managers see everything awaiting approval on leads they can see; reps see their own.
    db.emailDraft.findMany({
      where: { status: { in: ["AWAITING_APPROVAL", "FAILED"] }, lead: leadScope(user), ...(canSend ? {} : { authorId: user.id }) },
      include: { lead: { select: { id: true, company: true } }, author: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    db.mailbox.count({ where: { userId: user.id } }),
  ]);
  const pendingEnrollments = canSend
    ? await db.sequenceEnrollment.findMany({
        where: { status: "PENDING_APPROVAL", lead: leadScope(user) },
        orderBy: { createdAt: "asc" },
        take: 200,
        include: { lead: { select: { id: true, company: true, email: true } }, sequence: { select: { name: true } } },
      })
    : [];
  const requesters = await db.user.findMany({ where: { id: { in: [...new Set(pendingEnrollments.map((e) => e.enrolledById))] } }, select: { id: true, name: true } });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <p>
          Every email with your leads: synced from connected Gmail and Outlook mailboxes every 10 minutes, sent from the CRM, or logged by hand.
          Mail that doesn&rsquo;t match a lead is never imported.{" "}
          {mailboxes === 0 && (
            <Link href="/settings#email" className="font-medium text-brand-700 underline">Connect your mailbox</Link>
          )}
        </p>
      </div>

      <EnrollmentApprovals
        rows={pendingEnrollments.map((e) => ({ id: e.id, company: e.lead.company, leadId: e.lead.id, email: e.lead.email, sequence: e.sequence.name, by: requesters.find((u) => u.id === e.enrolledById)?.name ?? "—" }))}
      />

      {awaiting.length > 0 && (
        <section className="card">
          <h2 className="border-b border-line-soft px-5 py-3 font-semibold">
            {canSend ? "Awaiting your approval" : "Your emails awaiting approval"} <span className="font-normal text-ink-3">· {awaiting.length}</span>
          </h2>
          <ul className="divide-y divide-line-soft">
            {awaiting.map((d) => (
              <li key={d.id} className="space-y-2 px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link href={`/leads/${d.lead.id}`} className="font-semibold hover:text-brand-700">{d.lead.company}</Link>
                  <span className={`chip ${d.status === "FAILED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                    {d.status === "FAILED" ? "Failed to send" : "Draft – awaiting approval"}
                  </span>
                  <span className="text-xs text-ink-3">to {d.to} · by {d.author.name}</span>
                </div>
                <p className="text-sm font-medium">{d.subject || "(reply)"}</p>
                <p className="line-clamp-3 whitespace-pre-line text-sm text-ink-2">{d.body}</p>
                {d.error && <p className="text-xs text-rose-600">{d.error}</p>}
                {canSend && <DraftButtons draftId={d.id} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <SearchBox q={q} placeholder="Search emails, subjects or companies" />
      <ActivityFeed items={emails} empty="No emails yet." />
    </div>
  );
}
