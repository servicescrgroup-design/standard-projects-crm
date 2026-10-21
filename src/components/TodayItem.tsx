"use client";

import Link from "next/link";
import { useState } from "react";
import { QuickLogForm } from "./QuickLogForm";
import { decideLead } from "@/app/actions";

export type TodayItemData = {
  id: string;
  company: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  stageLabel: string;
  reasons: string[];
  needsDecision: boolean;
};

export function TodayItem({ item, rank }: { item: TodayItemData; rank: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="card p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-6 shrink-0 text-right text-sm font-semibold text-ink-3">{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/leads/${item.id}`} className="font-semibold hover:text-brand-700">
              {item.company}
            </Link>
            <span className="chip">{item.stageLabel}</span>
          </div>
          {item.contactName && <div className="text-sm text-ink-3">{item.contactName}</div>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.reasons.map((r) => (
              <span
                key={r}
                className={`chip ${
                  r.startsWith("Replied")
                    ? "bg-emerald-50 text-emerald-700"
                    : r.startsWith("Overdue")
                      ? "bg-amber-50 text-amber-700"
                      : item.needsDecision && r.includes("unanswered")
                        ? "bg-rose-50 text-rose-700"
                        : ""
                }`}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {item.phone && (
            <a href={`tel:${item.phone.replace(/\s/g, "")}`} className="btn-ghost">
              Call
            </a>
          )}
          {item.email && (
            <a href={`mailto:${item.email}`} className="btn-ghost hidden sm:inline-flex">
              Email
            </a>
          )}
          {!item.needsDecision && (
            <button type="button" className="btn-primary" onClick={() => setOpen((o) => !o)}>
              {open ? "Close" : "Log"}
            </button>
          )}
        </div>
      </div>

      {item.needsDecision && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm">
          <span className="flex-1 text-rose-800">No response after a full round of follow-ups.</span>
          <form action={decideLead}>
            <input type="hidden" name="leadId" value={item.id} />
            <input type="hidden" name="decision" value="keep" />
            <button className="btn-ghost">Try again in 30 days</button>
          </form>
          <form action={decideLead}>
            <input type="hidden" name="leadId" value={item.id} />
            <input type="hidden" name="decision" value="close" />
            <button className="btn bg-rose-600 text-white hover:bg-rose-700">Close as lost</button>
          </form>
        </div>
      )}

      {open && (
        <div className="mt-4 border-t border-line-soft pt-4">
          <QuickLogForm leadId={item.id} />
        </div>
      )}
    </li>
  );
}
