"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { csvToObjects } from "@/lib/csv";

type Summary = { read: number; importable: number; created: number; enriched: number; skipped: number };

/** Uploads a lead file from the owner's computer: a spreadsheet (.csv), a Notion "Customers CRM" export or a prospects list (.json). */
export function ImportLeads() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const text = await file.text();
      let body: string;
      if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
        const rows = csvToObjects(text);
        if (rows.length === 0) throw new Error("That CSV has no rows under the header line.");
        body = JSON.stringify({ format: "csv", rows });
      } else {
        JSON.parse(text); // fail fast on a wrong file
        body = text;
      }
      const res = await fetch("/api/import/notion", { method: "POST", headers: { "content-type": "application/json" }, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof SyntaxError ? "That file isn't valid JSON." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="btn-ghost cursor-pointer">
        {busy ? "Importing…" : "Choose file to import"}
        <input type="file" accept=".json,.csv,application/json,text/csv" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {result && (
        <p className="text-sm text-brand-700">
          {result.created.toLocaleString("en-GB")} new lead{result.created === 1 ? "" : "s"} added
          {result.enriched > 0 && ` · ${result.enriched.toLocaleString("en-GB")} existing leads filled in with missing details`}
          {result.skipped > 0 && ` · ${result.skipped.toLocaleString("en-GB")} already imported`}
          {result.read > result.importable && ` · ${result.read - result.importable} rows skipped (no company name)`}.
        </p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
