"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { completeTour } from "@/app/tourActions";
import { tourSelector, tourSteps } from "@/lib/tour";

type Rect = { top: number; left: number; width: number; height: number };
const STORAGE = "spcrm.tourStep";
export const START_TOUR_EVENT = "spcrm-start-tour";

/** The part of an element that's on screen (tall sections are cut to the visible area below the top bar). */
function visibleRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  const top = Math.max(r.top, 72);
  const bottom = Math.min(r.bottom, window.innerHeight - 12);
  return { top, left: r.left, width: r.width, height: Math.max(40, bottom - top) };
}

/** Visible, on-screen element for a step (the sidebar is off-canvas on phones, so those steps centre instead). */
function findTarget(target: string | undefined): HTMLElement | null {
  if (!target) return null;
  const all = [...document.querySelectorAll<HTMLElement>(tourSelector(target))];
  return all.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth;
  }) ?? null;
}

/**
 * First sign-in walkthrough: an animated pointer glides to each part of the CRM, "clicks" it, and a card
 * explains it. Moves between pages as needed. Shown once (remembered on the account); replay from Help.
 */
export function ProductTour({ autoStart, name, role }: { autoStart: boolean; name: string; role: string }) {
  const router = useRouter();
  const path = usePathname();
  const steps = useRef(tourSteps(name, role)).current;
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number }>({ x: -60, y: -60 });
  const [clicking, setClicking] = useState(0);
  const [card, setCard] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const current = step === null ? null : steps[step];

  // Start on first sign-in, resume after a reload, or when someone presses "Replay tour".
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(STORAGE);
    } catch {
      /* ignore */
    }
    if (saved !== null) setStep(Math.min(Number(saved) || 0, steps.length - 1));
    else if (autoStart) setStep(0);
    const start = () => setStep(0);
    window.addEventListener(START_TOUR_EVENT, start);
    return () => window.removeEventListener(START_TOUR_EVENT, start);
  }, [autoStart, steps.length]);

  useEffect(() => {
    try {
      if (step === null) sessionStorage.removeItem(STORAGE);
      else sessionStorage.setItem(STORAGE, String(step));
    } catch {
      /* ignore */
    }
  }, [step]);

  const finish = useCallback(() => {
    setStep(null);
    setRect(null);
    completeTour().catch(() => null);
  }, []);

  // Go to the step's page, wait for its element, scroll it into view, then move the pointer there.
  useEffect(() => {
    if (!current) return;
    if (path !== current.path) {
      setRect(null);
      // A short pause so the current page has finished loading before we move on.
      const go = setTimeout(() => router.push(current.path), 300);
      // If that navigation got lost (e.g. several steps clicked quickly), load the page directly;
      // the step is kept in sessionStorage so the tour carries on there.
      const fallback = setTimeout(() => {
        if (window.location.pathname !== current.path) window.location.assign(current.path);
      }, 3000);
      return () => {
        clearTimeout(go);
        clearTimeout(fallback);
      };
    }
    let cancelled = false;
    let observer: MutationObserver | null = null;
    const started = Date.now();
    const locate = () => {
      if (cancelled) return;
      const el = findTarget(current.target);
      if (!el && current.target && Date.now() - started < 8000) {
        // Not on the page yet (still loading): look again whenever the page changes, or shortly.
        if (!observer) {
          observer = new MutationObserver(() => {
            if (findTarget(current.target)) {
              observer?.disconnect();
              observer = null;
              locate();
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
        }
        return void setTimeout(locate, 150);
      }
      observer?.disconnect();
      observer = null;
      if (!el) {
        setRect(null);
        setPointer({ x: window.innerWidth / 2, y: window.innerHeight / 2 - 40 });
        return;
      }
      // Scroll so the element sits in the middle (tall sections: their top just under the top bar).
      const place = () => {
        const r0 = el.getBoundingClientRect();
        const tall = r0.height > window.innerHeight * 0.55;
        const want = tall ? 96 : Math.max(96, window.innerHeight / 2 - r0.height / 2);
        const fullyVisible = r0.top >= 72 && r0.bottom <= window.innerHeight - 12;
        if (!fullyVisible && Math.abs(r0.top - want) > 4) window.scrollTo({ top: Math.max(0, window.scrollY + r0.top - want) });
        const r = visibleRect(el);
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        setPointer({ x: r.left + Math.min(r.width / 2, 40) + 8, y: r.top + Math.min(r.height / 2, 28) + 6 });
      };
      place();
      // Measure again once late content (images, data) has settled, then "click".
      setTimeout(() => !cancelled && place(), 400);
      setTimeout(() => !cancelled && place(), 1200);
      setTimeout(() => !cancelled && setClicking((c) => c + 1), 900);
    };
    locate();
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [current, path, router]);

  // Keep the highlight on the element while scrolling or resizing.
  useEffect(() => {
    if (!current?.target) return;
    const update = () => {
      const el = findTarget(current.target);
      if (!el) return;
      const r = visibleRect(el);
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      setPointer({ x: r.left + Math.min(r.width / 2, 40) + 8, y: r.top + Math.min(r.height / 2, 28) + 6 });
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [current]);

  // Place the card beside the highlighted element, inside the screen.
  useLayoutEffect(() => {
    const c = cardRef.current;
    if (!c || step === null) return;
    const w = c.offsetWidth;
    const h = c.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) return setCard({ top: Math.max(16, vh / 2 - h / 2), left: Math.max(16, vw / 2 - w / 2) });
    const gap = 16;
    let top = rect.top + rect.height + gap;
    let left = rect.left;
    if (top + h > vh - 16) top = rect.top - h - gap; // above
    if (top < 16) {
      // beside
      top = Math.min(Math.max(16, rect.top), vh - h - 16);
      left = rect.left + rect.width + gap + w < vw ? rect.left + rect.width + gap : rect.left - w - gap;
    }
    left = Math.min(Math.max(16, left), vw - w - 16);
    setCard({ top, left });
  }, [rect, step]);

  // Keyboard: → / Enter next, ← back, Esc skip.
  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter") setStep((s) => (s === null ? s : s + 1 >= steps.length ? (finish(), null) : s + 1));
      else if (e.key === "ArrowLeft") setStep((s) => (s ? s - 1 : s));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, steps.length, finish]);

  if (step === null || !current) return null;
  const last = step === steps.length - 1;
  const pad = 8;

  return (
    <div className="fixed inset-0 z-[100]" aria-live="polite">
      {/* Dim everything except the highlighted element. */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-[#cdf464] transition-all duration-500 ease-out"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(10, 15, 25, 0.55)" }}
        />
      ) : (
        <div className="fixed inset-0 bg-[rgba(10,15,25,0.55)]" />
      )}
      {/* Block clicks on the page while touring (the card stays clickable). */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      {/* The animated mouse pointer. */}
      <div className="pointer-events-none fixed z-[102] transition-[left,top] duration-700 ease-[cubic-bezier(.4,.1,.2,1)]" style={{ left: pointer.x, top: pointer.y }} aria-hidden>
        <span key={clicking} className="absolute -left-4 -top-4 h-8 w-8 animate-[tour-click_0.8s_ease-out] rounded-full bg-[#cdf464]/70 opacity-0" />
        <svg width="28" height="32" viewBox="0 0 28 32" className="drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]">
          <path d="M2 2 L2 25 L8.5 19 L13 29.5 L17.5 27.5 L13 17.5 L22 17.5 Z" fill="#fff" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Explanation card. */}
      <div
        ref={cardRef}
        role="dialog"
        aria-label={current.title}
        className="fixed z-[103] w-[min(360px,calc(100vw-32px))] rounded-2xl bg-white p-5 shadow-2xl transition-[top,left] duration-500"
        style={card ? { top: card.top, left: card.left } : { visibility: "hidden", top: 0, left: 0 }}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">{current.title}</h2>
          <button type="button" aria-label="Skip tour" onClick={finish} className="rounded-md p-1 text-ink-3 hover:bg-hover hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{current.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-label={`Step ${step + 1} of ${steps.length}`}>
            {steps.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-brand-600" : i < step ? "w-1.5 bg-brand-300" : "w-1.5 bg-line"}`} />)}
          </div>
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="btn-ghost px-2.5 py-1.5"><ArrowLeft className="h-4 w-4" /></button>
          )}
          <button type="button" onClick={() => (last ? finish() : setStep(step + 1))} className="btn-primary px-3 py-1.5">
            {last ? "Finish" : step === 0 ? "Start tour" : "Next"} {!last && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
        {step === 0 && <button type="button" onClick={finish} className="mt-2 text-xs text-ink-3 hover:text-ink">Skip, I&rsquo;ll explore myself</button>}
      </div>
    </div>
  );
}
