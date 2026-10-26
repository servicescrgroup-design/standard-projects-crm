import { Mail } from "lucide-react";
import { EmailThreads } from "./EmailThreads";
import { DraftButtons, EmailComposer, type LeadTarget, type TemplateOption, type ThreadOption } from "./EmailComposer";
import type { MergeContext } from "@/lib/templates";

type EmailActivity = { id: string; type: string; subject: string | null; summary: string | null; threadId: string | null; webLink: string | null; source: string; occurredAt: Date; user?: { name: string } | null };
type Draft = { id: string; to: string; subject: string; body: string; status: string; error: string | null; author: { name: string }; updatedAt: Date };

const day = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Never");
const STATUS: Record<string, string> = { DRAFT: "Draft", AWAITING_APPROVAL: "Draft – awaiting approval", FAILED: "Failed to send" };

/** Every email thread with this lead, last contacted / replied dates, drafts awaiting approval and the composer. */
export function LeadEmailPanel({
  leadId, leadEmail, lastContactAt, lastReplyAt, emails, drafts, canSend, canSendNow = canSend, hasMailbox, templates = [], merge = {}, target, sequenceBox,
}: {
  leadId: string; leadEmail: string | null; lastContactAt: Date | null; lastReplyAt: Date | null;
  emails: EmailActivity[]; drafts: Draft[]; canSend: boolean; canSendNow?: boolean; hasMailbox: boolean;
  templates?: TemplateOption[]; merge?: MergeContext; target?: LeadTarget; sequenceBox?: React.ReactNode;
}) {
  // Group synced/sent emails into threads, newest thread first.
  const threads = new Map<string, EmailActivity[]>();
  for (const e of emails) {
    const key = e.threadId ?? `single:${e.id}`; // hand-logged emails have no thread
    threads.set(key, [...(threads.get(key) ?? []), e]);
  }
  const list = [...threads.values()]
    .map((msgs) => msgs.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()))
    .sort((a, b) => b[0].occurredAt.getTime() - a[0].occurredAt.getTime());
  const options: ThreadOption[] = list.filter((m) => m[0].threadId).map((m) => ({ activityId: m[0].id, subject: m.find((x) => x.subject)?.subject ?? "" }));

  return (
    <section id="email" className="card scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold"><Mail className="h-4 w-4 text-brand-600" /> Email</h2>
        <div className="flex gap-4 text-xs text-ink-2">
          <span>Last contacted: <b className="font-medium text-ink">{day(lastContactAt)}</b></span>
          <span>Last reply: <b className="font-medium text-ink">{day(lastReplyAt)}</b></span>
        </div>
      </div>

      <EmailThreads
        threads={list.map((msgs) =>
          [...msgs].reverse().map((m) => ({ id: m.id, type: m.type, subject: m.subject, summary: m.summary, webLink: m.webLink, source: m.source, at: m.occurredAt.toISOString(), by: m.user?.name ?? null })),
        )}
      />

      {drafts.length > 0 && (
        <div className="border-t border-line-soft">
          <h3 className="px-4 pt-3 text-sm font-semibold">Drafts</h3>
          <ul className="divide-y divide-line-soft">
            {drafts.map((d) => (
              <li key={d.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{d.subject || "(reply)"}</span>
                  <span className={`chip ${d.status === "FAILED" ? "bg-rose-50 text-rose-700" : d.status === "AWAITING_APPROVAL" ? "bg-amber-50 text-amber-700" : ""}`}>{STATUS[d.status] ?? d.status}</span>
                  <span className="text-xs text-ink-3">to {d.to} · by {d.author.name}</span>
                </div>
                <p className="line-clamp-3 whitespace-pre-line text-sm text-ink-2">{d.body}</p>
                {d.error && <p className="text-xs text-rose-600">{d.error}</p>}
                {canSend && <DraftButtons draftId={d.id} />}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sequenceBox && <div className="border-t border-line-soft p-4">{sequenceBox}</div>}

      <div className="border-t border-line-soft p-4">
        <h3 className="mb-3 text-sm font-semibold">Send email</h3>
        <EmailComposer leadId={leadId} defaultTo={leadEmail ?? ""} canSend={canSendNow} threads={options} hasMailbox={hasMailbox} templates={templates} merge={merge} target={target} />
      </div>
    </section>
  );
}
