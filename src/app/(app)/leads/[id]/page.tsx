import Link from "next/link";
import { Select } from "@/components/ui/Select";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { canAssignTo, canSeeLead, canSendEmail } from "@/lib/access";
import {
  ACTIVITY_LABELS,
  OUTCOME_LABELS,
  PACKAGES,
  PRIORITIES,
  SEGMENTS,
  SOURCE_LABELS,
  STAGES,
  STAGE_LABELS,
  formatMoney,
  type ActivityType,
  type Outcome,
  type Source,
} from "@/lib/domain";
import { QuickLogForm } from "@/components/QuickLogForm";
import { LeadEmailPanel } from "@/components/email/LeadEmailPanel";
import { LeadComms } from "@/components/voice/LeadComms";
import { countryOf } from "@/lib/countries";
import { toE164 } from "@/lib/phone";
import { updateLead } from "../../../actions";

export const dynamic = "force-dynamic";

/** Splits "url1; url2" style link lists into clickable links. */
function links(raw: string | null): string[] {
  return (raw ?? "").split(/[;\s,]+/).filter((s) => /^https?:\/\//i.test(s));
}

const SOURCE_LABEL: Record<string, string> = { GMAIL: "Gmail", OUTLOOK: "Outlook", CALENDAR: "Calendar", BOT: "Bot", WEBSITE: "Website", QUOTE: "Quote form", MANUAL: "" };
const fmt = (d: Date | null) =>
  d ? d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const pounds = (p: number) => (p ? String(p / 100) : "");

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ call?: string; meeting?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const lead = await db.lead.findUnique({
    where: { id },
    include: { owner: true, activities: { include: { user: true }, orderBy: { occurredAt: "desc" } } },
  });
  if (!lead || !canSeeLead(user, lead)) notFound();

  const [candidates, drafts, myMailboxes, twilioConnected] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" } }),
    db.emailDraft.findMany({ where: { leadId: lead.id, status: { not: "SENT" } }, include: { author: { select: { name: true } } }, orderBy: { updatedAt: "desc" } }),
    db.mailbox.count({ where: { userId: user.id, status: "ACTIVE" } }),
    db.twilioConnection.count({ where: { userId: user.id } }),
  ]);
  const assignable = candidates.filter((c) => canAssignTo(user, c));
  const canAssign = user.role !== "REP";

  return (
    <div className="space-y-5">
      <Link href="/leads" className="text-sm text-ink-3 hover:text-ink">
        ← Leads
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{lead.company}</h1>
          <p className="text-ink-3">
            {[lead.contactName, lead.location, lead.industry].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LeadComms
            lead={{ id: lead.id, company: lead.company, contactName: lead.contactName, phone: lead.phone, e164: toE164(lead.phone, countryOf(lead.location)?.code ?? "TH") }}
            hasTwilio={twilioConnected > 0}
            autoOpen={sp.call ? "call" : sp.meeting ? "meeting" : null}
          />
          {lead.email && (
            <a className="btn-ghost" href="#email">
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
            <div className="text-xs text-ink-3">{k}</div>
            <div className="mt-0.5 font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="card p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Prospect profile</h2>
              {lead.priority && <span className="chip bg-brand-600 text-white">Priority {lead.priority}</span>}
              {lead.segment && <span className="chip">{lead.segment}</span>}
              <span className="chip bg-indigo-50 text-indigo-700">{SOURCE_LABELS[lead.source as Source] ?? lead.source}</span>
              {lead.googleRating !== null && (
                <span className="chip">
                  ★ {lead.googleRating} · {lead.googleReviews ?? 0} Google reviews
                </span>
              )}
            </div>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {lead.whyFit && (
                <div className="sm:col-span-2">
                  <dt className="label">Why a fit</dt>
                  <dd>{lead.whyFit}</dd>
                </div>
              )}
              {lead.offersToPitch.length > 0 && (
                <div>
                  <dt className="label">Offers to pitch</dt>
                  <dd className="flex flex-wrap gap-1">
                    {lead.offersToPitch.map((o) => (
                      <span key={o} className="chip bg-brand-50 text-brand-800">
                        {o}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {lead.caseStudies.length > 0 && (
                <div>
                  <dt className="label">Case studies to show</dt>
                  <dd className="flex flex-wrap gap-1">
                    {lead.caseStudies.map((c) => (
                      <span key={c} className="chip">
                        {c}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {lead.address && (
                <div>
                  <dt className="label">Address</dt>
                  <dd>
                    <a
                      className="text-brand-700 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.company} ${lead.address}`)}`}
                    >
                      {lead.address}
                    </a>
                  </dd>
                </div>
              )}
              {(lead.website || links(lead.socialLinks).length > 0) && (
                <div>
                  <dt className="label">Online</dt>
                  <dd className="flex flex-col gap-0.5">
                    {[lead.website, ...links(lead.socialLinks)].filter(Boolean).map((u) => (
                      <a key={u} href={u!} target="_blank" rel="noopener noreferrer" className="truncate text-brand-700 hover:underline">
                        {u!.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    ))}
                  </dd>
                </div>
              )}
              {lead.notes && (
                <div className="sm:col-span-2">
                  <dt className="label">Notes</dt>
                  <dd className="whitespace-pre-line">{lead.notes}</dd>
                </div>
              )}
              {lead.needs && (
                <div className="sm:col-span-2">
                  <dt className="label">Plan and needs</dt>
                  <dd className="whitespace-pre-line">{lead.needs}</dd>
                </div>
              )}
              {(lead.budget > 0 || lead.package) && (
                <div>
                  <dt className="label">Budget / package</dt>
                  <dd>{[lead.budget > 0 && formatMoney(lead.budget), lead.package].filter(Boolean).join(" · ")}</dd>
                </div>
              )}
              {lead.lostReason && (
                <div>
                  <dt className="label">Lost reason</dt>
                  <dd>{lead.lostReason}</dd>
                </div>
              )}
              {(lead.sourceLink || lead.externalRef?.startsWith("https://app.notion.com")) && (
                <div className="flex gap-4 sm:col-span-2">
                  {lead.sourceLink && (
                    <a href={lead.sourceLink} target="_blank" rel="noopener noreferrer" className="text-xs text-ink-3 hover:underline">
                      Where we found them ↗
                    </a>
                  )}
                  {lead.externalRef?.startsWith("https://app.notion.com") && (
                    <a href={lead.externalRef} target="_blank" rel="noopener noreferrer" className="text-xs text-ink-3 hover:underline">
                      Open in Notion ↗
                    </a>
                  )}
                </div>
              )}
            </dl>
          </section>

          <LeadEmailPanel
            leadId={lead.id}
            leadEmail={lead.email}
            lastContactAt={lead.lastContactAt}
            lastReplyAt={lead.lastReplyAt}
            emails={lead.activities.filter((a) => a.type === "EMAIL_IN" || a.type === "EMAIL_OUT")}
            drafts={drafts}
            canSend={canSendEmail(user)}
            hasMailbox={myMailboxes > 0}
          />

          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Log activity</h2>
            <QuickLogForm leadId={lead.id} />
          </section>

          <section className="card">
            <h2 className="border-b border-line-soft px-4 py-3 font-semibold">History</h2>
            <ul className="divide-y divide-line-soft">
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
                    {a.subject && <p className="mt-0.5 text-sm font-medium">{a.subject}</p>}
                    {a.summary && <p className="mt-0.5 whitespace-pre-line text-sm text-ink-2">{a.summary}</p>}
                    {a.webLink && (
                      <a href={a.webLink} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline">
                        Open in {a.source === "OUTLOOK" ? "Outlook" : "Gmail"}
                      </a>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs text-ink-3">
                    <div>{fmt(a.occurredAt)}</div>
                    <div>{a.user?.name}</div>
                  </div>
                </li>
              ))}
              {lead.activities.length === 0 && <li className="px-4 py-6 text-sm text-ink-3">Nothing logged yet.</li>}
            </ul>
          </section>
        </div>

        <section className="card h-fit p-4">
          <h2 className="mb-3 font-semibold">Details</h2>
          <form action={updateLead} className="space-y-3">
            <input type="hidden" name="leadId" value={lead.id} />
            <div>
              <label className="label">Stage</label>
              <Select name="stage" ariaLabel="Stage" defaultValue={lead.stage} options={STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))} />
              <p className="mt-1 text-xs text-ink-3">Moves forward automatically as you log. Change it here to override.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="ld-priority">Priority</label>
                <Select id="ld-priority" name="priority" defaultValue={lead.priority ?? ""} options={[{ value: "", label: "—" }, ...PRIORITIES.map((p) => ({ value: p, label: p }))]} />
              </div>
              <div>
                <label className="label" htmlFor="ld-segment">Industry</label>
                <Select
                  id="ld-segment"
                  name="segment"
                  defaultValue={lead.segment ?? ""}
                  options={[
                    { value: "", label: "—" },
                    ...[...SEGMENTS, ...(lead.segment && !(SEGMENTS as readonly string[]).includes(lead.segment) ? [lead.segment] : [])].map((s) => ({ value: s, label: s })),
                  ]}
                />
              </div>
              <div>
                <label className="label" htmlFor="ld-package">Package</label>
                <Select id="ld-package" name="package" defaultValue={lead.package ?? ""} options={[{ value: "", label: "—" }, ...PACKAGES.map((p) => ({ value: p, label: p }))]} />
              </div>
              <div>
                <label className="label" htmlFor="ld-budget">Their budget (฿)</label>
                <input id="ld-budget" name="budget" defaultValue={pounds(lead.budget)} inputMode="decimal" className="input" />
              </div>
            </div>
            {canAssign ? (
              <div>
                <label className="label">Owner</label>
                <Select
                  name="ownerId"
                  ariaLabel="Owner"
                  defaultValue={lead.ownerId ?? ""}
                  options={[
                    { value: "", label: "Unassigned" },
                    ...assignable.map((p) => ({ value: p.id, label: p.name })),
                    ...(lead.owner && !assignable.some((p) => p.id === lead.ownerId) ? [{ value: lead.owner.id, label: lead.owner.name }] : []),
                  ]}
                />
              </div>
            ) : (
              <div className="text-sm">
                <span className="text-ink-3">Owner: </span>
                {lead.owner?.name ?? "Unassigned"}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">One-off (฿)</label>
                <input name="value" defaultValue={pounds(lead.value)} inputMode="decimal" className="input" />
              </div>
              <div>
                <label className="label">Monthly care plan (฿)</label>
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
            <div>
              <label className="label" htmlFor="ld-needs">Plan and needs</label>
              <textarea id="ld-needs" name="needs" rows={2} defaultValue={lead.needs ?? ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="ld-notes">Notes</label>
              <textarea id="ld-notes" name="notes" rows={3} defaultValue={lead.notes ?? ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="ld-lost">Lost reason</label>
              <input id="ld-lost" name="lostReason" defaultValue={lead.lostReason ?? ""} className="input" />
            </div>
            <button className="btn-primary">Save changes</button>
          </form>
        </section>
      </div>
    </div>
  );
}
