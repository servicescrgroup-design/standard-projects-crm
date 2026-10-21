"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Repeat } from "lucide-react";
import { enrollAction } from "@/app/outreachActions";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toaster";

/** Bulk "Add to sequence" for ticked leads (Companies, Contacts). */
export function AddToSequence({ leadIds, sequences, onDone }: { leadIds: string[]; sequences: { id: string; name: string }[]; onDone?: () => void }) {
  const router = useRouter();
  const [seq, setSeq] = useState("");
  const [pending, start] = useTransition();
  if (!sequences.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-ink-2">→ sequence</span>
      <Select ariaLabel="Sequence" value={seq} placeholder="Choose…" className="w-auto min-w-48 py-1.5" menuWidth={280} onChange={setSeq} options={sequences.map((s) => ({ value: s.id, label: s.name }))} />
      <button
        type="button"
        className="btn-dark py-1.5"
        disabled={!seq || pending}
        onClick={() =>
          start(async () => {
            const r = await enrollAction(seq, leadIds);
            toast(r.error ?? r.message ?? "Done", r.error ? "error" : "ok");
            if (!r.error) {
              onDone?.();
              router.refresh();
            }
          })
        }
      >
        <Repeat className="h-4 w-4" /> {pending ? "Adding…" : "Add to sequence"}
      </button>
    </span>
  );
}
