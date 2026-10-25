"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Eye, Plus, Send, Trash2, X } from "lucide-react";
import { deleteDemoAction, sendDemoAction, updateDemoAction } from "@/app/demoActions";
import { DEMO_STATUSES, demoStatusInfo, taskProgress, type DemoTask } from "@/lib/demos";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toaster";

export type DemoView = {
  id: string; leadId: string; company: string; contactName: string | null; leadEmail: string | null; name: string; status: string; brief: string;
  tasks: DemoTask[]; assignedToId: string | null; assignedToName: string | null; dueAt: string | null; demoUrl: string | null; quoteId: string | null;
  clientLink: string; sentAt: string | null; viewedAt: string | null; viewCount: number; interestedAt: string | null; clientNote: string | null;
  quotes: { id: string; label: string; sent: boolean }[];
};

const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Everything about one demo: brief, checklist, who builds it, the demo link, the offer, and sending it. */
export function DemoEditor({ demo, team, me, onClose }: { demo: DemoView; team: { id: string; name: string }[]; me: string; onClose?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(demo.name);
  const [brief, setBrief] = useState(demo.brief);
  const [url, setUrl] = useState(demo.demoUrl ?? "");
  const [tasks, setTasks] = useState(demo.tasks);
  const [newTask, setNewTask] = useState("");
  const [sending, setSending] = useState(false);
  const first = (demo.contactName ?? "").split(/\s+/)[0] || "there";
  const quote = demo.quotes.find((q) => q.id === demo.quoteId);
  const [subject, setSubject] = useState(`A demo website for ${demo.company}`);
  const [body, setBody] = useState(
    `Hi ${first},\n\nWe've made a quick demo of what a new website for ${demo.company} could look like, before you've paid anything. Have a look here:\n\n${demo.clientLink}\n\n${quote ? "Our offer is on the same page, so you can see exactly what it would cost.\n\n" : ""}If you like it, there's a button on the page to let us know, or just reply to this email.\n\nBest regards,\n${me}`,
  );

  const save = (patch: Parameters<typeof updateDemoAction>[1], quiet = false) =>
    start(async () => {
      const r = await updateDemoAction(demo.id, patch);
      if (r.error || !quiet) toast(r.error ?? r.message ?? "Saved", r.error ? "error" : "ok");
      router.refresh();
    });
  const setTaskList = (next: DemoTask[]) => { setTasks(next); save({ tasks: next }, true); };
  const progress = taskProgress(tasks);
  const copy = async () => { try { await navigator.clipboard.writeText(demo.clientLink); toast("Client link copied", "ok"); } catch { toast(demo.clientLink, "ok"); } };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <input className="input flex-1 font-semibold" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== demo.name && save({ name }, true)} aria-label="Demo name" />
        {onClose && <button type="button" aria-label="Close" onClick={onClose} className="btn px-2 text-ink-2 hover:bg-hover"><X className="h-4 w-4" /></button>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div><span className="label">Status</span><Select ariaLabel="Status" value={demo.status} onChange={(v) => save({ status: v })} options={DEMO_STATUSES.map((s) => ({ value: s.id, label: s.label }))} /></div>
        <div><span className="label">Who&rsquo;s building it</span><Select ariaLabel="Assigned to" value={demo.assignedToId ?? ""} onChange={(v) => save({ assignedToId: v || null })} options={[{ value: "", label: "Nobody yet" }, ...team.map((t) => ({ value: t.id, label: t.name }))]} /></div>
        <label><span className="label">Due</span><input type="date" className="input" defaultValue={toLocalInput(demo.dueAt)} onChange={(e) => save({ dueAt: e.target.value ? new Date(`${e.target.value}T17:00`).toISOString() : null }, true)} /></label>
      </div>

      <label className="block">
        <span className="label">Brief: what to build</span>
        <textarea className="input min-h-28" value={brief} onChange={(e) => setBrief(e.target.value)} onBlur={() => brief !== demo.brief && save({ brief }, true)} />
      </label>

      <div>
        <span className="label">Checklist · {progress.done}/{progress.total}</span>
        <ul className="space-y-1">
          {tasks.map((t, i) => (
            <li key={i} className="group flex items-center gap-2 text-sm">
              <button type="button" aria-label={t.done ? "Mark not done" : "Mark done"} onClick={() => setTaskList(tasks.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${t.done ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white"}`}>
                {t.done && <Check className="h-3.5 w-3.5" />}
              </button>
              <span className={t.done ? "text-ink-3 line-through" : ""}>{t.text}</span>
              <button type="button" aria-label="Remove" onClick={() => setTaskList(tasks.filter((_, j) => j !== i))} className="ml-auto opacity-0 group-hover:opacity-100"><X className="h-3.5 w-3.5 text-ink-3" /></button>
            </li>
          ))}
        </ul>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newTask.trim()) { setTaskList([...tasks, { text: newTask.trim(), done: false }]); setNewTask(""); } }}>
          <input className="input flex-1" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add a step…" />
          <button className="btn-ghost"><Plus className="h-4 w-4" /> Add</button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Demo link</span>
          <div className="flex gap-2">
            <input className="input flex-1" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => url !== (demo.demoUrl ?? "") && save({ demoUrl: url }, true)} placeholder="https://their-demo.vercel.app" />
            {demo.demoUrl && <a href={demo.demoUrl} target="_blank" rel="noreferrer" className="btn-ghost px-2" aria-label="Open demo"><ExternalLink className="h-4 w-4" /></a>}
          </div>
        </label>
        <div>
          <span className="label">Offer shown with the demo</span>
          <Select ariaLabel="Offer" value={demo.quoteId ?? ""} onChange={(v) => save({ quoteId: v || null })} options={[{ value: "", label: demo.quotes.length ? "No offer" : "No quotes on this lead yet" }, ...demo.quotes.map((q) => ({ value: q.id, label: q.label, hint: q.sent ? undefined : "draft" }))]} />
          {quote && !quote.sent && <p className="mt-1 text-xs text-amber-700">Send this quote first (Quotes section on the lead), or the client won&rsquo;t see the offer.</p>}
          {!demo.quotes.length && <p className="mt-1 text-xs text-ink-3">Create one in the Quotes section of the lead.</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-canvas p-3 text-sm">
        <span className={`pill ${demoStatusInfo(demo.status).tone}`}>{demoStatusInfo(demo.status).label}</span>
        {demo.sentAt && <span className="text-ink-2">Sent {shortDate(demo.sentAt)}</span>}
        {demo.viewedAt ? <span className="inline-flex items-center gap-1 text-ink-2"><Eye className="h-4 w-4" /> Opened {demo.viewCount}× (first {shortDate(demo.viewedAt)})</span> : demo.sentAt && <span className="text-ink-3">Not opened yet</span>}
        {demo.interestedAt && <span className="font-medium text-emerald-700">Wants to go ahead{demo.clientNote ? `: “${demo.clientNote}”` : ""}</span>}
        <span className="ml-auto flex gap-2">
          <button type="button" className="btn-ghost" onClick={copy}><Copy className="h-4 w-4" /> Copy client link</button>
          {demo.demoUrl && <a href={`${demo.clientLink}?preview=1`} target="_blank" rel="noreferrer" className="btn-ghost"><Eye className="h-4 w-4" /> Preview</a>}
          <button type="button" className="btn-primary" disabled={!demo.demoUrl || !demo.leadEmail} title={!demo.demoUrl ? "Add the demo link first" : !demo.leadEmail ? "The lead has no email" : undefined} onClick={() => setSending(!sending)}>
            <Send className="h-4 w-4" /> Send to client
          </button>
        </span>
      </div>

      {sending && (
        <div className="space-y-2 rounded-xl border border-brand-200 p-3">
          <p className="text-sm text-ink-2">To: <b>{demo.leadEmail}</b></p>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
          <textarea className="input min-h-48" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message" />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => { const r = await sendDemoAction(demo.id, subject, body); toast(r.error ?? r.message ?? "Sent", r.error ? "error" : "ok"); if (!r.error) setSending(false); router.refresh(); })}>
              <Send className="h-4 w-4" /> {pending ? "Sending…" : "Send"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setSending(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-ink-3">
        <Link href={`/leads/${demo.leadId}`} className="hover:text-ink hover:underline">Open {demo.company}</Link>
        <button type="button" className="inline-flex items-center gap-1 hover:text-rose-600" onClick={() => confirm("Delete this demo project?") && start(async () => { const r = await deleteDemoAction(demo.id); toast(r.error ?? r.message ?? "Deleted", r.error ? "error" : "ok"); onClose?.(); router.refresh(); })}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}
