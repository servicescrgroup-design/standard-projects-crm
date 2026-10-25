"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MonitorPlay, Plus } from "lucide-react";
import { createDemoAction } from "@/app/demoActions";
import { demoStatusInfo, taskProgress } from "@/lib/demos";
import { toast } from "@/components/ui/Toaster";
import { DemoEditor, type DemoView } from "./DemoEditor";

/** On a lead: its demo projects, and "Create demo project". */
export function LeadDemos({ leadId, demos, team, me }: { leadId: string; demos: DemoView[]; team: { id: string; name: string }[]; me: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<string | null>(demos.length === 1 ? demos[0].id : null);

  return (
    <section id="demos" className="card scroll-mt-24 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><MonitorPlay className="h-4 w-4 text-brand-600" /> Demo project</h2>
        <button type="button" className="btn-ghost" disabled={pending}
          onClick={() => start(async () => { const r = await createDemoAction(leadId); toast(r.error ?? r.message ?? "Created", r.error ? "error" : "ok"); if (r.id) setOpen(r.id); router.refresh(); })}>
          <Plus className="h-4 w-4" /> {demos.length ? "Another demo" : "Create demo project"}
        </button>
      </div>
      {demos.length === 0 && (
        <p className="text-sm text-ink-3">Win them over before they pay: your team builds a quick demo of their new website, you attach your offer, and send them one link showing both. They can click &ldquo;I&rsquo;d like to go ahead&rdquo; right there.</p>
      )}
      <div className="space-y-3">
        {demos.map((d) => {
          const p = taskProgress(d.tasks);
          const s = demoStatusInfo(d.status);
          return open === d.id ? (
            <div key={d.id} className="rounded-xl border border-line p-3"><DemoEditor demo={d} team={team} me={me} onClose={() => setOpen(null)} /></div>
          ) : (
            <button key={d.id} type="button" onClick={() => setOpen(d.id)} className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-left text-sm hover:bg-hover">
              <span className="font-medium">{d.name}</span>
              <span className={`pill ${s.tone}`}>{s.label}</span>
              <span className="text-xs text-ink-3">{p.done}/{p.total} done{d.assignedToName ? ` · ${d.assignedToName}` : ""}{d.viewCount ? ` · opened ${d.viewCount}×` : ""}</span>
              <ChevronDown className="ml-auto h-4 w-4 text-ink-3" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
