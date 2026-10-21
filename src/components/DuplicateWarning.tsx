"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";

type Match = { id: string | null; company: string; why: string[]; owner: string };

/**
 * Watches the company / phone / email / website fields of the surrounding form and warns, as you type,
 * when the lead already exists, so nobody adds a duplicate or takes a colleague's lead by accident.
 */
export function DuplicateWarning() {
  const ref = useRef<HTMLDivElement>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | undefined;
    const check = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const v = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "").trim();
        const q = new URLSearchParams({ company: v("company"), phone: v("phone"), email: v("email"), website: v("website") });
        ctrl?.abort();
        ctrl = new AbortController();
        try {
          const res = await fetch(`/api/leads/duplicates?${q}`, { signal: ctrl.signal });
          const data = (await res.json()) as { matches?: Match[] };
          setMatches(data.matches ?? []);
        } catch {
          /* typing again cancelled it */
        }
      }, 400);
    };
    form.addEventListener("input", check);
    return () => { form.removeEventListener("input", check); clearTimeout(t); ctrl?.abort(); };
  }, []);

  return (
    <div ref={ref} aria-live="polite" className={matches.length ? "sm:col-span-2" : "hidden"}>
      {matches.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-1.5 font-medium"><TriangleAlert className="h-4 w-4" /> This might already be in the CRM</p>
          <ul className="mt-1.5 space-y-1">
            {matches.map((m, i) => (
              <li key={m.id ?? i}>
                {m.id ? <Link href={`/leads/${m.id}`} className="font-medium underline">{m.company}</Link> : <span className="font-medium">{m.company}</span>}
                <span className="text-amber-800"> · {m.why.join(", ")} · owner: {m.owner}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-amber-800">Open the existing lead instead, or ask its owner. You can still save if it&rsquo;s a different business.</p>
        </div>
      )}
    </div>
  );
}
