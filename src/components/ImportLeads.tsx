"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Summary = { read: number; importable: number; imported: number; alreadyThere: number };

/** Uploads a Notion "Customers CRM" JSON export straight from the owner's computer. */
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
      JSON.parse(text); // fail fast on a wrong file
      const res = await fetch("/api/import/notion", { method: "POST", headers: { "content-type": "application/json" }, body: text });
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
        <input type="file" accept=".json,application/json" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {result && (
        <p className="text-sm text-green-700">
          Imported {result.imported.toLocaleString("en-GB")} new lead{result.imported === 1 ? "" : "s"}
          {result.alreadyThere > 0 && ` · ${result.alreadyThere.toLocaleString("en-GB")} were already in the CRM`}
          {result.read > result.importable && ` · ${result.read - result.importable} rows skipped (no company name)`}.
        </p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
