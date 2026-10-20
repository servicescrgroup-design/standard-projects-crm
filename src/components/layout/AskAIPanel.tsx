"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";

type Turn = { role: "you" | "ai"; text: string };

const SUGGESTIONS = [
  "Who should I call first today, and why?",
  "Summarise my pipeline in three bullet points.",
  "Draft a follow-up message for my top priority-A lead.",
  "Which deals have gone quiet?",
];

/** Side panel for questions about the CRM. Answers come from /api/ai, scoped to the viewer's data. */
export function AskAIPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    setNotice("");
    setTurns((t) => [...t, { role: "you", text }]);
    setQuestion("");
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text }) });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.message ?? data.error ?? "Something went wrong.");
        setTurns((t) => t.slice(0, -1));
        setQuestion(text);
      } else {
        setTurns((t) => [...t, { role: "ai", text: data.answer }]);
      }
    } catch {
      setNotice("Couldn't reach the assistant. Check your connection.");
      setTurns((t) => t.slice(0, -1));
      setQuestion(text);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/20" onClick={onClose} aria-hidden />
      <section role="dialog" aria-label="Ask AI" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-white shadow-[var(--shadow-menu)]">
        <header className="flex items-center gap-2 border-b border-line px-5 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <h2 className="flex-1 font-semibold">Ask AI</h2>
          <button type="button" onClick={onClose} className="btn px-2 text-ink-2 hover:bg-hover" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {turns.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-ink-2">Ask about your leads, deals and activity. Answers only use CRM data you&apos;re allowed to see.</p>
              <div className="space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)} className="block w-full rounded-lg border border-line px-3 py-2 text-left text-sm text-ink hover:bg-hover">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className={t.role === "you" ? "ml-8 rounded-xl bg-brand-50 px-3 py-2 text-sm text-ink" : "whitespace-pre-wrap text-sm leading-relaxed text-ink"}>
              {t.text}
            </div>
          ))}
          {busy && <div className="h-4 w-24 animate-pulse rounded bg-line-soft" aria-label="Thinking" />}
          {notice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="border-t border-line p-4"
        >
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(question);
              }
            }}
            rows={2}
            placeholder="Ask about your CRM…"
            className="input resize-none"
            aria-label="Your question"
          />
          <div className="mt-2 flex justify-end">
            <button className="btn-primary" disabled={busy || !question.trim()}>
              <Sparkles className="h-4 w-4" /> {busy ? "Thinking…" : "Ask"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
