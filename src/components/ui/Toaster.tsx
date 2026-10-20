"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type Toast = { id: number; text: string; tone: "ok" | "error" };

/** Show a short notification from anywhere in the app. */
export function toast(text: string, tone: Toast["tone"] = "ok") {
  window.dispatchEvent(new CustomEvent("spcrm-toast", { detail: { text, tone } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const { text, tone } = (e as CustomEvent<Omit<Toast, "id">>).detail;
      const id = ++n;
      setItems((t) => [...t, { id, text, tone }]);
      setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3000);
    };
    window.addEventListener("spcrm-toast", on);
    return () => window.removeEventListener("spcrm-toast", on);
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm shadow-[var(--shadow-menu)]">
          {t.tone === "ok" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
          {t.text}
        </div>
      ))}
    </div>
  );
}
