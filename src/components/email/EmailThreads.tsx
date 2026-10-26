"use client";

import { useState } from "react";
import { ChevronDown, CornerDownLeft, ExternalLink, Send } from "lucide-react";

export type ThreadMessage = { id: string; type: string; subject: string | null; summary: string | null; webLink: string | null; source: string; at: string; by: string | null };

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Every email with the lead, grouped into conversations: what we sent, what they replied, newest first. */
export function EmailThreads({ threads }: { threads: ThreadMessage[][] }) {
  const [open, setOpen] = useState<string | null>(threads[0]?.length > 1 ? threads[0][0].id : null);
  const all = threads.flat();
  const sent = all.filter((m) => m.type === "EMAIL_OUT").length;
  const replies = all.filter((m) => m.type === "EMAIL_IN").length;
  if (!threads.length) return <p className="px-4 py-3 text-sm text-ink-3">No emails with this lead yet. Use <b>Quick email</b> at the top to send the first one.</p>;

  return (
    <div>
      <div className="flex flex-wrap gap-2 px-4 pt-3 text-xs">
        <span className="chip"><Send className="mr-1 inline h-3 w-3" />{sent} sent</span>
        <span className={`chip ${replies ? "bg-emerald-50 text-emerald-700" : ""}`}><CornerDownLeft className="mr-1 inline h-3 w-3" />{replies} {replies === 1 ? "reply" : "replies"}</span>
      </div>
      <ul className="divide-y divide-line-soft">
        {threads.map((msgs) => {
          const latest = msgs[msgs.length - 1];
          const key = msgs[0].id;
          const isOpen = open === key;
          const theyReplied = msgs.some((m) => m.type === "EMAIL_IN");
          return (
            <li key={key}>
              <button type="button" onClick={() => setOpen(isOpen ? null : key)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-hover">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="truncate font-medium">{msgs.find((m) => m.subject)?.subject || "(no subject)"}</span>
                    <span className="chip">{msgs.length} message{msgs.length === 1 ? "" : "s"}</span>
                    {theyReplied ? <span className="chip bg-emerald-50 text-emerald-700">Replied</span> : <span className="chip text-ink-3">No reply yet</span>}
                  </div>
                  {!isOpen && latest.summary && <p className="mt-0.5 line-clamp-1 text-sm text-ink-2">{latest.type === "EMAIL_IN" ? "They wrote: " : "You wrote: "}{latest.summary}</p>}
                </div>
                <div className="flex shrink-0 items-start gap-2 text-xs text-ink-3">
                  {when(latest.at)}
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>
              {isOpen && (
                <ol className="space-y-2 px-4 pb-4">
                  {msgs.map((m) => {
                    const inbound = m.type === "EMAIL_IN";
                    return (
                      <li key={m.id} className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${inbound ? "bg-emerald-50 text-emerald-950" : "ml-auto bg-brand-50 text-ink"}`}>
                        <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
                          <span className="font-medium">{inbound ? "They replied" : `Sent${m.by ? ` by ${m.by}` : ""}`}</span>
                          <span>{when(m.at)}</span>
                        </div>
                        <p className="whitespace-pre-line">{m.summary || "(no preview)"}</p>
                        {m.webLink && (
                          <a href={m.webLink} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                            Open in {m.source === "OUTLOOK" ? "Outlook" : "Gmail"} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
