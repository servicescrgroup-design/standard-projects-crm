"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { fillIndustriesAction } from "@/app/dataActions";
import { toast } from "@/components/ui/Toaster";

/** "Fill in missing industries": one click, with a preview of what will be set. */
export function FillIndustries({ missing, guesses }: { missing: number; guesses: { segment: string; count: number }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fillable = guesses.reduce((t, g) => t + g.count, 0);

  if (missing === 0) return <p className="text-sm text-ink-2">Every lead has an industry. 🎉</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        <b>{missing.toLocaleString()}</b> {missing === 1 ? "lead has" : "leads have"} no industry. We can fill it in for <b>{fillable.toLocaleString()}</b> of them from their company name and notes:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {guesses.map((g) => <span key={g.segment} className="chip">{g.segment} · {g.count.toLocaleString()}</span>)}
      </div>
      <button type="button" className="btn-primary" disabled={pending || fillable === 0}
        onClick={() => start(async () => { const r = await fillIndustriesAction(); toast(r.error ?? r.message ?? "Done", r.error ? "error" : "ok"); router.refresh(); })}>
        <Sparkles className="h-4 w-4" /> {pending ? "Filling in…" : `Fill in ${fillable.toLocaleString()} industries`}
      </button>
      <p className="text-xs text-ink-3">Leads that already have an industry are never changed. New imports get theirs filled in automatically.</p>
    </div>
  );
}
