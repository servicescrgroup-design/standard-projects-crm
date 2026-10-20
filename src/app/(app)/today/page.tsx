import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { QUEUE_SELECT, buildQueue } from "@/lib/queue";
import { OPEN_STAGES, STAGE_LABELS, type Stage } from "@/lib/domain";
import { TodayItem } from "@/components/TodayItem";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireUser();
  const leads = await db.lead.findMany({
    where: { ownerId: user.id, stage: { in: OPEN_STAGES } },
    select: { ...QUEUE_SELECT, company: true, contactName: true, phone: true, email: true },
  });
  const queue = buildQueue(leads);
  const allActive = queue.filter((q) => !q.needsDecision);
  // Show the top of the list; nobody works through hundreds in a day, and rendering them all is slow.
  const SHOW = 50;
  const active = allActive.slice(0, SHOW);
  const hidden = allActive.length - active.length;
  const decisions = queue.filter((q) => q.needsDecision);
  const replies = active.filter((q) => q.reasons[0]?.startsWith("They replied")).length;

  const toItem = (q: (typeof queue)[number]) => ({
    id: q.lead.id,
    company: q.lead.company,
    contactName: q.lead.contactName,
    phone: q.lead.phone,
    email: q.lead.email,
    stageLabel: STAGE_LABELS[q.lead.stage as Stage] ?? q.lead.stage,
    reasons: q.reasons,
    needsDecision: q.needsDecision,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {greeting}, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-slate-500">
          {allActive.length === 0
            ? "You're all caught up."
            : `${allActive.length} to do today, most important first.${replies ? ` ${replies} ${replies === 1 ? "has" : "have"} replied and ${replies === 1 ? "is" : "are"} waiting on you.` : ""}`}
        </p>
      </div>

      {active.length > 0 && (
        <ol className="space-y-3">
          {active.map((q, i) => (
            <TodayItem key={q.lead.id} item={toItem(q)} rank={i + 1} />
          ))}
        </ol>
      )}
      {hidden > 0 && (
        <p className="text-sm text-slate-500">
          Showing your top {SHOW}. {hidden.toLocaleString("en-GB")} more are due; they move up as you work through these.
        </p>
      )}

      {decisions.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Needs a decision ({decisions.length})
          </h2>
          <ol className="space-y-3">
            {decisions.map((q, i) => (
              <TodayItem key={q.lead.id} item={toItem(q)} rank={i + 1} />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
