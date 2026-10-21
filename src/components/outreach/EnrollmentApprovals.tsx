"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveEnrollmentsAction } from "@/app/outreachActions";
import { toast } from "@/components/ui/Toaster";

type Row = { id: string; company: string; leadId: string; sequence: string; by: string; email: string | null };

/** Managers approve or reject reps' sequence requests (all at once or one by one). */
export function EnrollmentApprovals({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = rows.filter((r) => !hidden.has(r.id));
  const act = (ids: string[], approve: boolean) =>
    start(async () => {
      const r = await approveEnrollmentsAction(ids, approve);
      toast(r.error ?? r.message ?? "Done", r.error ? "error" : "ok");
      if (!r.error) {
        setHidden((h) => new Set([...h, ...ids]));
        router.refresh();
      }
    });
  if (!visible.length) return null;
  return (
    <section className="card">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-5 py-3">
        <h2 className="font-semibold">Sequences waiting for your approval <span className="font-normal text-ink-3">· {visible.length}</span></h2>
        <button type="button" className="btn-primary ml-auto py-1.5" disabled={pending} onClick={() => act(visible.map((r) => r.id), true)}>Approve all</button>
      </div>
      <ul className="divide-y divide-line-soft">
        {visible.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-sm">
            <Link href={`/leads/${r.leadId}#email`} className="font-medium hover:text-brand-700">{r.company}</Link>
            <span className="text-ink-3">{r.email} · “{r.sequence}” · requested by {r.by}</span>
            <span className="ml-auto flex gap-1">
              <button type="button" className="btn-ghost py-1" disabled={pending} onClick={() => act([r.id], true)}>Approve</button>
              <button type="button" className="btn py-1 text-rose-600 hover:bg-rose-50" disabled={pending} onClick={() => act([r.id], false)}>Reject</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
