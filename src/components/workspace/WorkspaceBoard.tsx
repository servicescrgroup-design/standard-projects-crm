"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown, ArrowUp, ArrowUpRight, CalendarDays, FileText, Flame, Handshake, Mail, MessageSquareReply, Phone, Plus, Search, Target, Users, X,
} from "lucide-react";
import { moveLeadOnBoard, quickLog } from "@/app/actions";
import { formatMoney } from "@/lib/domain";
import { INTEREST_LABELS, nowPosition, scheduleLayout, type Interest, type TaskKind } from "@/lib/workspace";
import { toast } from "@/components/ui/Toaster";
import { Select } from "@/components/ui/Select";

export type WorkspaceData = {
  agent: { id: string; name: string; isSelf: boolean };
  people: { id: string; name: string }[];
  today: string;
  meetings: { id: string; start: string; company: string; contact: string | null; leadId: string; summary: string | null }[];
  stats: { deals: number; dealsDelta: number; won: number; wonDelta: number; lost: number; lostDelta: number };
  newLeadsFromPool: boolean;
  inbound: { id: string; name: string; company: string; source: string; assignedAt: string; phone: string | null; email: string | null }[];
  leads: { id: string; name: string; subtitle: string; sources: string[]; interest: Interest; dots: number; email: string | null; phone: string | null }[];
  tasks: {
    id: string; contact: string; company: string; title: string; kind: TaskKind; amount: number; due: string | null;
    dueState: "overdue" | "today" | "upcoming" | "none"; hot: boolean; replied: boolean; stage: string; stageLabel: string;
    reasons: string[]; phone: string | null; email: string | null;
  }[];
  goals: { label: string; actual: number; target: number; pct: number }[];
  todayCounts: { calls: number; emails: number; meetings: number };
  leadOptions: { id: string; label: string }[];
  stages: { id: string; label: string }[];
};

const LIME = "bg-[#cdf464]";
const AVATAR = ["bg-[#ffe1cc] text-[#8a3b00]", "bg-[#dbeafe] text-[#1e3a8a]", "bg-[#e9d5ff] text-[#5b21b6]", "bg-[#d1fae5] text-[#065f46]", "bg-[#fde68a] text-[#78350f]", "bg-[#fecdd3] text-[#9f1239]"];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const initials = (s: string) => s.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function Face({ name, size = 44, ring = "ring-white" }: { name: string; size?: number; ring?: string }) {
  return (
    <span
      title={name}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ${ring} ${AVATAR[hash(name) % AVATAR.length]}`}
    >
      {initials(name)}
    </span>
  );
}

function RoundIcon({ href, label, children, dark }: { href: string; label: string; children: React.ReactNode; dark?: boolean }) {
  const cls = `inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${dark ? "bg-[#111] text-white hover:bg-black" : "border border-black/5 bg-white text-ink hover:bg-[#f4f4f4]"}`;
  return href.startsWith("tel:") || href.startsWith("mailto:") ? (
    <a href={href} aria-label={label} className={cls}>{children}</a>
  ) : (
    <Link href={href} aria-label={label} className={cls}>{children}</Link>
  );
}

function Delta({ n, goodWhenUp = true }: { n: number; goodWhenUp?: boolean }) {
  if (n === 0) return null;
  const good = goodWhenUp ? n > 0 : n < 0;
  return (
    <span className={`absolute -top-2 left-full ml-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${good ? "bg-[#cdf464] text-[#365314]" : "bg-[#ffd6d6] text-[#b42318]"}`}>
      {n > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}{Math.abs(n)}
    </span>
  );
}

function Dots({ n }: { n: number }) {
  const colors = ["#ff5a4e", "#ff8a3d", "#ffc53d", "#9be15d", "#3ccf5f"];
  return (
    <span className="inline-flex gap-1 rounded-full border border-black/5 bg-white px-2 py-1" aria-label={`${n} of 5`}>
      {colors.map((c, i) => <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: i < n ? c : "#e5e5e5" }} />)}
    </span>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] transition-colors ${on ? "border-white bg-white font-medium shadow-sm" : "border-black/10 bg-transparent text-ink-2 hover:bg-white/70"}`}
    >
      {children}
    </button>
  );
}

const KIND_ICON: Record<TaskKind, React.ElementType> = { reply: MessageSquareReply, call: Phone, meeting: Users, proposal: FileText, close: Handshake };

/** The agent's workspace, styled after the reference design: black/lime schedule bar, soft grey canvas, white cards. */
export function WorkspaceBoard({ data }: { data: WorkspaceData }) {
  const router = useRouter();
  const [leadFilter, setLeadFilter] = useState<Interest | "all">("all");
  const [leadQuery, setLeadQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState<"all" | "hot" | "today" | "overdue" | "replied">("all");
  const [taskQuery, setTaskQuery] = useState("");
  const [newTask, setNewTask] = useState(false);
  const [pending, start] = useTransition();
  const today = new Date(data.today);
  // Computed in the browser only, so the server and client render the same HTML.
  const [now, setNow] = useState<{ pos: number | null; label: string }>({ pos: null, label: "" });
  useEffect(() => {
    const tick = () => setNow({ pos: nowPosition(new Date()), label: time(new Date().toISOString()) });
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  const leads = useMemo(
    () => data.leads.filter((l) => (leadFilter === "all" || l.interest === leadFilter) && (!leadQuery || `${l.name} ${l.subtitle}`.toLowerCase().includes(leadQuery.toLowerCase()))),
    [data.leads, leadFilter, leadQuery],
  );
  const tasks = useMemo(
    () =>
      data.tasks.filter((t) => {
        if (taskQuery && !`${t.contact} ${t.company} ${t.title}`.toLowerCase().includes(taskQuery.toLowerCase())) return false;
        if (taskFilter === "hot") return t.hot;
        if (taskFilter === "today") return t.dueState === "today" || t.dueState === "none";
        if (taskFilter === "overdue") return t.dueState === "overdue";
        if (taskFilter === "replied") return t.replied;
        return true;
      }),
    [data.tasks, taskFilter, taskQuery],
  );
  const layout = scheduleLayout(data.meetings.map((m) => ({ id: m.id, start: new Date(m.start) })), today);
  const nextUp = data.tasks[0];
  const qs = (agent: string) => (agent === data.agent.id ? "" : `?agent=${agent}`);

  const changeStage = (leadId: string, stage: string) =>
    start(async () => {
      const r = await moveLeadOnBoard(leadId, stage, null);
      if (r.error) toast(r.error, "error");
      else {
        toast("Stage updated", "ok");
        router.refresh();
      }
    });

  return (
    <div className="-m-4 min-h-full bg-[#ececec] p-4 md:-m-6 md:p-6">
      {/* Schedule bar */}
      <section data-tour="schedule" className="flex flex-col gap-2 rounded-[28px] bg-[#0f0f0f] p-2 text-white lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 px-4 py-1">
          <span className="text-lg font-medium">Your Schedule</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80">
            <CalendarDays className="h-4 w-4" /> {today.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
          </span>
        </div>
        <div className={`relative h-14 w-full shrink-0 overflow-hidden rounded-full lg:w-auto lg:flex-1 ${LIME}`}>
          {[...Array(13)].map((_, i) => (
            <span key={i} className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-black/10" style={{ left: `${(i / 12) * 100}%` }} />
          ))}
          {data.meetings.length === 0 && (
            <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-black/60">
              No meetings logged for today · <Link href="/log" className="ml-1 underline">log one</Link>
            </span>
          )}
          {data.meetings.map((m) => {
            const pos = layout.find((x) => x.id === m.id)!;
            return (
              <Link
                key={m.id}
                href={`/leads/${m.leadId}`}
                title={`${time(m.start)} · ${m.company}${m.summary ? ` · ${m.summary}` : ""}`}
                className="absolute top-1.5 flex h-11 min-w-28 items-center gap-2 rounded-full bg-white pl-1.5 pr-3 text-black shadow-sm hover:shadow-md"
                style={{ left: `${pos.left}%` }}
              >
                <Face name={m.contact ?? m.company} size={32} />
                <span className="truncate text-xs font-medium">{time(m.start)} · {m.company}</span>
              </Link>
            );
          })}
          {now.pos !== null && (
            <span className="absolute top-0 h-full w-0.5 bg-black" style={{ left: `${now.pos}%` }}>
              <span className="absolute -top-0 left-1/2 -translate-x-1/2 rounded-full bg-black px-2 py-0.5 text-[10px] text-white">{now.label}</span>
            </span>
          )}
        </div>
        <Link href="/meetings" aria-label="All meetings" className="mr-1 hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 hover:bg-white/10 lg:inline-flex">
          <ArrowUpRight className="h-5 w-5" />
        </Link>
      </section>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-10">
          {/* Title + stats */}
          <div className="flex flex-wrap items-center gap-x-10 gap-y-5">
            <div className="flex flex-wrap items-center gap-3 sm:gap-5">
              <h1 className="text-3xl font-semibold uppercase tracking-tight text-[#111] sm:text-5xl">Workspace</h1>
              <button type="button" data-tour="new-task" onClick={() => setNewTask(true)} className="inline-flex items-center gap-2 rounded-full bg-[#111] py-2 pl-2 pr-5 text-sm text-white hover:bg-black">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20"><Plus className="h-4 w-4" /></span> New Task
              </button>
            </div>
            <div className="flex flex-wrap gap-x-12 gap-y-3">
              {[
                { n: data.stats.deals, label: "deals", delta: data.stats.dealsDelta, up: true, hint: "Open deals · new this week" },
                { n: data.stats.won, label: "won", delta: data.stats.wonDelta, up: true, hint: "Won this month · vs last month" },
                { n: data.stats.lost, label: "lost", delta: data.stats.lostDelta, up: false, hint: "Lost this month · vs last month" },
              ].map((s) => (
                <div key={s.label} title={s.hint} className="relative flex items-baseline gap-1.5">
                  <span className="text-5xl font-light tabular-nums text-[#111]">{s.n}</span>
                  <span className="relative text-lg text-ink-2">{s.label}<Delta n={s.delta} goodWhenUp={s.up} /></span>
                </div>
              ))}
            </div>
            {data.people.length > 1 && (
              <label className="ml-auto flex items-center gap-2 text-sm text-ink-2">
                Viewing
                <Select
                  variant="pill"
                  ariaLabel="Viewing workspace of"
                  value={data.agent.id}
                  onChange={(v) => router.push(`/workspace${qs(v)}`)}
                  className="min-w-40"
                  options={data.people.map((p) => ({ value: p.id, label: p.name }))}
                />
              </label>
            )}
          </div>

          {data.inbound.length > 0 && <RespondNow items={data.inbound} />}

          {/* New leads */}
          <section data-tour="new-leads">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl text-[#111]">New Leads</h2>
              <span className="mr-2 text-sm underline underline-offset-4"><b className="text-lg">{data.leads.length}</b> {data.newLeadsFromPool ? "unassigned" : "leads"}</span>
              <label className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" />
                <input value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder="Search" aria-label="Search new leads" className="h-10 w-36 rounded-full border border-black/10 bg-transparent pl-9 pr-3 text-sm outline-none focus:bg-white" />
              </label>
              <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1 sm:w-auto sm:flex-1">
                <Chip on={leadFilter === "all"} onClick={() => setLeadFilter("all")}>All</Chip>
                {(Object.keys(INTEREST_LABELS) as Interest[]).map((k) => (
                  <Chip key={k} on={leadFilter === k} onClick={() => setLeadFilter(k)}>
                    {k === "hot" && <Flame className="h-3.5 w-3.5 text-orange-500" />}
                    {INTEREST_LABELS[k]}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="mt-5 flex snap-x gap-4 overflow-x-auto pb-3">
              {leads.map((l) => (
                <article key={l.id} className="relative w-64 shrink-0 snap-start rounded-[28px] bg-white/80 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur">
                  <div className="flex items-start justify-between">
                    <Face name={l.name} size={48} />
                    <RoundIcon href={`/leads/${l.id}`} label={`Open ${l.name}`}><ArrowUpRight className="h-4 w-4" /></RoundIcon>
                  </div>
                  <h3 className="mt-4 truncate text-xl text-[#111]">{l.name}</h3>
                  <p className="truncate text-xs text-ink-2">{l.subtitle}</p>
                  <div className="mt-5 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-ink-3">Source</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {l.sources.map((s) => <span key={s} className="max-w-24 truncate rounded-full bg-[#ececec] px-2.5 py-1 text-[11px] text-ink-2">{s}</span>)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="flex items-center justify-end gap-1 text-[11px] text-ink-3">
                        {l.interest === "hot" && <Flame className="h-3 w-3 text-orange-500" />}{INTEREST_LABELS[l.interest]}
                      </p>
                      <div className="mt-1"><Dots n={l.dots} /></div>
                    </div>
                  </div>
                </article>
              ))}
              {leads.length === 0 && <p className="py-8 text-sm text-ink-2">{data.leads.length ? "No leads match this filter." : "No new leads. Nice and clear."}</p>}
            </div>
          </section>

          {/* Today's tasks */}
          <section data-tour="tasks">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl text-[#111]">Your Day&rsquo;s Tasks</h2>
              <span className="mr-2 text-sm underline underline-offset-4"><b className="text-lg">{data.tasks.length}</b> tasks</span>
              <label className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" />
                <input value={taskQuery} onChange={(e) => setTaskQuery(e.target.value)} placeholder="Search" aria-label="Search tasks" className="h-10 w-36 rounded-full border border-black/10 bg-transparent pl-9 pr-3 text-sm outline-none focus:bg-white" />
              </label>
              <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1 sm:w-auto sm:flex-1">
                <Chip on={taskFilter === "all"} onClick={() => setTaskFilter("all")}>All</Chip>
                <Chip on={taskFilter === "hot"} onClick={() => setTaskFilter("hot")}><Flame className="h-3.5 w-3.5 text-orange-500" />Hot</Chip>
                <Chip on={taskFilter === "today"} onClick={() => setTaskFilter("today")}>Due Today</Chip>
                <Chip on={taskFilter === "overdue"} onClick={() => setTaskFilter("overdue")}>Overdue</Chip>
                <Chip on={taskFilter === "replied"} onClick={() => setTaskFilter("replied")}>Replied</Chip>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {tasks.map((t, i) => {
                const Icon = KIND_ICON[t.kind];
                const featured = i === 0 && taskFilter === "all" && !taskQuery;
                return (
                  <article key={t.id} className={`flex flex-col rounded-[28px] p-5 ${featured ? LIME : "bg-white"}`}>
                    <div className="flex items-start gap-3">
                      <Face name={t.contact} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#111]">{t.contact}</p>
                        <p className="truncate text-[11px] text-ink-2">{t.company}</p>
                      </div>
                      <RoundIcon href={`/leads/${t.id}`} label={`Open ${t.contact}`}><ArrowUpRight className="h-4 w-4" /></RoundIcon>
                    </div>
                    <div className="mt-6 flex items-center gap-3">
                      <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${featured ? "bg-white/70" : "bg-[#f2f2f2]"}`}><Icon className="h-5 w-5" /></span>
                      <div className="min-w-0">
                        <h3 className="truncate text-2xl leading-tight text-[#111]">{t.title}</h3>
                        <p className="text-xs text-ink-2">
                          {t.amount > 0 && <>Amount <b className="font-medium text-[#111]">{formatMoney(t.amount)}</b> · </>}
                          {t.dueState === "overdue" ? (
                            <span className="font-medium text-[#b42318]">Overdue{t.due ? ` since ${new Date(t.due).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</span>
                          ) : t.due ? (
                            <>Due {new Date(t.due).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</>
                          ) : (
                            <>{t.stage === "NEW" ? "Not contacted yet" : "No follow-up date"}</>
                          )}
                          {t.hot && <> · <Flame className="inline h-3 w-3 text-orange-500" /> Hot</>}
                        </p>
                      </div>
                    </div>
                    <p className="mt-6 text-[11px] text-ink-3">Status</p>
                    <div className="mt-1 flex items-center gap-2">
                      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-black/5 bg-white py-1 pl-1 pr-3">
                        <Face name={data.agent.name} size={32} />
                        <Select
                          variant="ghost"
                          ariaLabel={`Stage for ${t.contact}`}
                          defaultValue={t.stage}
                          disabled={pending}
                          onChange={(v) => changeStage(t.id, v)}
                          className="min-w-0 flex-1 px-1 py-1 hover:bg-transparent"
                          menuWidth={200}
                          options={data.stages.map((s) => ({ value: s.id, label: s.label }))}
                        />
                      </label>
                      {t.email && <RoundIcon href={`/leads/${t.id}#email`} label={`Email ${t.contact}`}><Mail className="h-4 w-4" /></RoundIcon>}
                      {t.phone && <RoundIcon href={`/leads/${t.id}?call=1`} label={`Call ${t.contact}`} dark><Phone className="h-4 w-4" /></RoundIcon>}
                    </div>
                  </article>
                );
              })}
              {tasks.length === 0 && <p className="py-8 text-sm text-ink-2">{data.tasks.length ? "No tasks match this filter." : "Nothing due today."}</p>}
            </div>
          </section>
        </div>

        {/* Summary panel */}
        <aside data-tour="summary" className="h-fit space-y-3 rounded-[32px] bg-[#0f0f0f] p-3 text-white xl:sticky xl:top-24">
          <div className="flex items-center justify-between px-3 pt-2">
            <h2 className="text-2xl">Summary</h2>
            <Link href="/today" aria-label="Open Today" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 hover:bg-white/10"><ArrowUpRight className="h-4 w-4" /></Link>
          </div>

          <div className="rounded-[24px] bg-[#1c1c1c] p-5">
            <p className="text-sm text-white/60">Next up</p>
            {nextUp ? (
              <>
                <div className="mt-3 flex items-center gap-3">
                  <Face name={nextUp.contact} size={44} ring="ring-[#1c1c1c]" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{nextUp.contact}</p>
                    <p className="truncate text-xs text-white/60">{nextUp.title}{nextUp.company ? ` · ${nextUp.company}` : ""}</p>
                  </div>
                </div>
                {nextUp.reasons.length > 0 && <p className="mt-3 text-xs text-white/50">{nextUp.reasons.join(" · ")}</p>}
                <div className="mt-4 flex gap-2">
                  {nextUp.phone && (
                    <Link href={`/leads/${nextUp.id}?call=1`} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium text-black ${LIME}`}>
                      <Phone className="h-4 w-4" /> Call
                    </Link>
                  )}
                  <Link href={`/leads/${nextUp.id}${nextUp.email ? "#email" : ""}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 py-2.5 text-sm hover:bg-white/10">
                    {nextUp.email ? <><Mail className="h-4 w-4" /> Email</> : <>Open lead</>}
                  </Link>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-white/60">You&rsquo;re all caught up.</p>
            )}
          </div>

          <div className="rounded-[24px] bg-[#1c1c1c] p-5">
            <p className="text-sm text-white/60">Today so far</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[["Calls", data.todayCounts.calls], ["Emails", data.todayCounts.emails], ["Meetings", data.todayCounts.meetings]].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white/5 py-3">
                  <p className="text-2xl font-light tabular-nums">{v}</p>
                  <p className="text-[11px] text-white/50">{k}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] bg-[#1c1c1c] p-5">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-lg"><Target className="h-4 w-4" /> Goals</p>
              <Link href="/team" className="text-xs text-white/50 hover:text-white">Set goals</Link>
            </div>
            {data.goals.length === 0 ? (
              <p className="mt-3 text-sm text-white/50">No goals set yet. The owner or team lead can set weekly or monthly targets on the Team page.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {data.goals.map((g) => (
                  <li key={g.label}>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/80">{g.label}</span>
                      <span className="tabular-nums text-white/60">{g.actual.toLocaleString("en-GB")} / {g.target.toLocaleString("en-GB")}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${LIME}`} style={{ width: `${Math.max(3, g.pct)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {newTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setNewTask(false)}>
          <form
            action={quickLog}
            onSubmit={() => toast("Task added", "ok")}
            role="dialog"
            aria-label="New task"
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium">New task</h2>
              <button type="button" aria-label="Close" onClick={() => setNewTask(false)} className="rounded-full p-2 hover:bg-[#f2f2f2]"><X className="h-4 w-4" /></button>
            </div>
            <input type="hidden" name="type" value="NOTE" />
            <input type="hidden" name="redirectTo" value={`/workspace${qs(data.agent.id)}`} />
            <label className="mt-4 block">
              <span className="label">Lead</span>
              <Select name="leadId" required ariaLabel="Lead" defaultValue="" placeholder="Choose a lead…" searchable options={data.leadOptions.map((o) => ({ value: o.id, label: o.label }))} />
            </label>
            <label className="mt-3 block">
              <span className="label">What needs doing</span>
              <input name="summary" required className="input" placeholder="e.g. Send revised quote" />
            </label>
            <label className="mt-3 block">
              <span className="label">Due</span>
              <input name="followUp" type="date" required className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setNewTask(false)} className="rounded-full border border-black/10 px-5 py-2.5 text-sm">Cancel</button>
              <button className="rounded-full bg-[#111] px-5 py-2.5 text-sm text-white">Add task</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/** New enquiries waiting for a first reply, with a live timer (red after 15 minutes). */
function RespondNow({ items }: { items: WorkspaceData["inbound"] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="rounded-[28px] bg-[#111] p-5 text-white">
      <div className="flex flex-wrap items-center gap-3">
        <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#cdf464] opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-[#cdf464]" /></span>
        <h2 className="text-xl">Respond now</h2>
        <p className="text-sm text-white/60">New enquiries assigned to you. The first business to reply usually wins.</p>
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {items.map((l) => {
          const mins = now ? Math.max(0, Math.floor((now - new Date(l.assignedAt).getTime()) / 60000)) : 0;
          const late = mins >= 15;
          const label = mins < 60 ? `${mins} min` : mins < 1440 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${Math.floor(mins / 1440)} d`;
          return (
            <article key={l.id} className="w-64 shrink-0 rounded-2xl bg-white/5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.name}</p>
                  <p className="truncate text-xs text-white/50">{l.company !== l.name ? `${l.company} · ` : ""}{l.source}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${late ? "bg-[#ff5a4e] text-white" : "bg-[#cdf464] text-black"}`} title="Waiting since assigned">{now ? label : "…"}</span>
              </div>
              <div className="mt-3 flex gap-2">
                {l.phone && <Link href={`/leads/${l.id}?call=1`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#cdf464] py-2 text-sm font-medium text-black"><Phone className="h-3.5 w-3.5" /> Call</Link>}
                <Link href={`/leads/${l.id}${l.email ? "#email" : ""}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 py-2 text-sm hover:bg-white/10">{l.email ? <><Mail className="h-3.5 w-3.5" /> Email</> : "Open"}</Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
