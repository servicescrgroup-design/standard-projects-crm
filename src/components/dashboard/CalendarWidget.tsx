"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Video } from "lucide-react";
import { freeSlots } from "@/lib/analytics";

export type CalendarMeeting = {
  id: string;
  leadId: string;
  company: string;
  start: string; // ISO
  summary: string | null;
  by: string | null;
  contact: string | null;
};

const MEETING_MINUTES = 60; // logged meetings have a start time only; assume an hour for free-time gaps

const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).replace(" ", " ").toLowerCase();
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const initials = (s: string | null) => (s ?? "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** Meeting link from a note: Google Meet, Zoom, Teams or a LINE call link. */
function meetingLink(summary: string | null): { href: string; label: string } | null {
  const url = summary?.match(/https?:\/\/[^\s)]+/)?.[0];
  if (!url) return null;
  if (/meet\.google\.com/.test(url)) return { href: url, label: "Google Meet" };
  if (/zoom\.us/.test(url)) return { href: url, label: "Zoom" };
  if (/teams\.microsoft/.test(url)) return { href: url, label: "Teams" };
  if (/line\.me/.test(url)) return { href: url, label: "LINE" };
  return { href: url, label: "Open link" };
}

/** Week strip + day agenda built from meetings logged in the CRM. */
export function CalendarWidget({ meetings, todayIso }: { meetings: CalendarMeeting[]; todayIso: string }) {
  const today = new Date(todayIso);
  const [selected, setSelected] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const all = useMemo(() => meetings.map((m) => ({ ...m, startDate: new Date(m.start) })), [meetings]);

  // Week (Mon–Sun) containing the selected day.
  const weekStart = new Date(selected);
  weekStart.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));

  const dayMeetings = all.filter((m) => sameDay(m.startDate, selected)).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const gaps = freeSlots(
    dayMeetings.map((m) => ({ start: m.startDate, end: new Date(m.startDate.getTime() + MEETING_MINUTES * 60_000) })),
    selected,
  );
  type Row = { kind: "meeting"; at: Date; m: (typeof dayMeetings)[number] } | { kind: "free"; at: Date; end: Date };
  const rows: Row[] = [
    ...dayMeetings.map((m) => ({ kind: "meeting" as const, at: m.startDate, m })),
    ...(dayMeetings.length ? gaps.map((g) => ({ kind: "free" as const, at: g.start, end: g.end })) : []),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const shift = (days: number) => setSelected((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
  const monthLabel = selected.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="card flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Calendar</h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-7)} className="btn px-1.5 py-1 text-ink-2 hover:bg-hover" aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-28 text-center text-xs font-medium text-ink-2">{monthLabel}</span>
          <button type="button" onClick={() => shift(7)} className="btn px-1.5 py-1 text-ink-2 hover:bg-hover" aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {week.map((d) => {
          const isSel = sameDay(d, selected);
          const isToday = sameDay(d, today);
          const has = all.some((m) => sameDay(m.startDate, d));
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => setSelected(d)}
              aria-pressed={isSel}
              aria-label={d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              className={`flex flex-col items-center gap-1 rounded-lg py-1.5 text-xs transition-colors duration-150 ${isSel ? "bg-brand-600 text-white" : "hover:bg-hover"}`}
            >
              <span className={isSel ? "text-white/80" : "text-ink-3"}>{d.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2)}</span>
              <span className={`text-sm font-semibold ${!isSel && isToday ? "text-brand-600" : ""}`}>{d.getDate()}</span>
              <span className={`h-1 w-1 rounded-full ${has ? (isSel ? "bg-white" : "bg-brand-500") : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>

      <div className="my-4 border-t border-line-soft" />

      <ul className="flex-1 space-y-2.5 overflow-y-auto">
        {rows.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-3">
            No meetings logged for this day.
            <Link href="/log" className="mt-2 flex items-center justify-center gap-1 text-brand-700 hover:underline">
              <Plus className="h-3.5 w-3.5" /> Log a meeting
            </Link>
          </li>
        )}
        {rows.map((r, i) =>
          r.kind === "free" ? (
            <li key={`f${i}`} className="flex gap-3 text-xs">
              <span className="w-14 shrink-0 pt-0.5 text-right text-ink-3">{time(r.at)}</span>
              <div className="flex-1 rounded-lg border border-dashed border-line px-3 py-2 text-ink-3">
                Available · {time(r.at)} – {time(r.end)}
              </div>
            </li>
          ) : (
            <li key={r.m.id} className="flex gap-3">
              <span className="w-14 shrink-0 pt-2 text-right text-xs text-ink-3">{time(r.at)}</span>
              <div className="flex-1 rounded-lg border border-line bg-white px-3 py-2 transition-colors hover:bg-hover">
                <Link href={`/leads/${r.m.leadId}`} className="block text-sm font-semibold hover:text-brand-700">
                  {r.m.summary?.replace(/https?:\/\/\S+/g, "").trim() || `Meeting with ${r.m.company}`}
                </Link>
                <div className="text-xs text-ink-3">
                  {r.m.company} · {time(r.at)}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex -space-x-1.5">
                    {[r.m.by, r.m.contact].filter(Boolean).map((p) => (
                      <span key={p} title={p!} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand-100 text-[10px] font-semibold text-brand-700">
                        {initials(p)}
                      </span>
                    ))}
                  </div>
                  {meetingLink(r.m.summary) && (
                    <a href={meetingLink(r.m.summary)!.href} target="_blank" rel="noopener noreferrer" className="btn-ghost px-2 py-1 text-xs">
                      <Video className="h-3.5 w-3.5" /> {meetingLink(r.m.summary)!.label}
                    </a>
                  )}
                </div>
              </div>
            </li>
          ),
        )}
      </ul>
      <p className="mt-3 text-[11px] text-ink-3">From meetings logged in the CRM. Free time assumes 1-hour meetings.</p>
    </div>
  );
}
