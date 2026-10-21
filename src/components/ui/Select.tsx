"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type SelectOption = { value: string; label: string; hint?: string; disabled?: boolean };

type Variant = "default" | "pill" | "dark" | "ghost";

const TRIGGER: Record<Variant, string> = {
  default: "input flex items-center justify-between gap-2 text-left",
  ghost: "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-hover",
  pill: "flex items-center justify-between gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-left text-sm",
  dark: "flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white",
};
const MENU: Record<Variant, string> = {
  default: "border-line bg-white text-ink",
  ghost: "border-line bg-white text-ink",
  pill: "border-line bg-white text-ink",
  dark: "border-white/10 bg-[#1c1c1c] text-white",
};

/** Places the menu under (or above, when there's no room) the trigger, in viewport coordinates. */
function useMenuPosition(open: boolean, trigger: React.RefObject<HTMLElement | null>, minWidth = 0) {
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number } | null>(null);
  const update = useCallback(() => {
    const el = trigger.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const width = Math.max(r.width, minWidth);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    if (below >= 240 || below >= above) setPos({ left, top: r.bottom + 4, width, maxHeight: Math.min(320, below - 4) });
    else setPos({ left, bottom: window.innerHeight - r.top + 4, width, maxHeight: Math.min(320, above - 4) });
  }, [trigger, minWidth]);
  useLayoutEffect(() => {
    if (!open) return;
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);
  return pos;
}

function useOutside(open: boolean, refs: React.RefObject<HTMLElement | null>[], onOutside: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return;
      onOutside();
    };
    document.addEventListener("pointerdown", h, true);
    return () => document.removeEventListener("pointerdown", h, true);
  }, [open, refs, onOutside]);
}

/**
 * A styled replacement for <select>. Works in plain forms (renders a hidden input with `name`), as a
 * controlled input (`value` + `onChange`), and can submit its form on change (`autoSubmit`).
 * Keyboard: arrows, Home/End, Enter, Escape, type to jump (or to search when there are many options).
 */
export function Select({
  options, name, value, defaultValue, onChange, placeholder = "Select…", ariaLabel, id, disabled, required, className = "",
  variant = "default", searchable, autoSubmit, menuWidth = 0,
}: {
  options: SelectOption[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  variant?: Variant;
  searchable?: boolean;
  autoSubmit?: boolean;
  menuWidth?: number;
}) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();
  const canSearch = searchable ?? options.length > 8;
  const pos = useMenuPosition(open, trigger, menuWidth);
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  useOutside(open, [trigger, menu], close);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const selected = options.find((o) => o.value === current);

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
  };
  const choose = (o: SelectOption) => {
    if (o.disabled) return;
    if (value === undefined) setInner(o.value);
    close();
    trigger.current?.focus();
    if (o.value !== current) {
      onChange?.(o.value);
      if (autoSubmit) setTimeout(() => hidden.current?.form?.requestSubmit(), 0);
    }
  };

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const move = (delta: number) => {
    if (shown.length === 0) return;
    let i = active;
    for (let n = 0; n < shown.length; n++) {
      i = (i + delta + shown.length) % shown.length;
      if (!shown[i].disabled) break;
    }
    setActive(i);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    e.stopPropagation(); // keep outer popovers (e.g. the Filter panel) from reacting
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(shown.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) choose(shown[active]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); trigger.current?.focus(); }
    else if (e.key === "Tab") close();
    else if (!canSearch && e.key.length === 1) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const i = shown.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKey}
        className={`${TRIGGER[variant]} ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}
      >
        <span className={`min-w-0 truncate ${selected ? "" : variant === "dark" ? "text-white/50" : "text-ink-3"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {/* Carries the value in forms; visually hidden but still validated when required. */}
      <input
        ref={hidden}
        tabIndex={-1}
        aria-hidden
        name={name}
        value={current}
        required={required}
        onChange={() => {}}
        onFocus={() => trigger.current?.focus()}
        className="pointer-events-none absolute h-px w-px opacity-0"
      />
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menu}
            data-floating-menu
            onKeyDown={onKey}
            style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight, zIndex: 80 }}
            className={`flex flex-col overflow-hidden rounded-xl border shadow-[var(--shadow-menu)] ${MENU[variant]}`}
          >
            {canSearch && (
              <div className={`flex items-center gap-2 border-b px-3 py-2 ${variant === "dark" ? "border-white/10" : "border-line"}`}>
                <Search className="h-4 w-4 shrink-0 opacity-50" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                  placeholder="Search…"
                  aria-label="Search options"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            )}
            <ul id={listId} role="listbox" aria-label={ariaLabel} tabIndex={-1} className="overflow-y-auto p-1" ref={(el) => { if (el && !canSearch) el.focus({ preventScroll: true }); }}>
              {shown.map((o, i) => {
                const isSel = o.value === current;
                return (
                  <li
                    key={o.value || `__${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={o.disabled}
                    onPointerMove={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${o.disabled ? "cursor-default opacity-40" : ""} ${
                      i === active ? (variant === "dark" ? "bg-white/10" : "bg-brand-50 text-brand-800") : ""
                    }`}
                  >
                    <Check className={`h-4 w-4 shrink-0 ${isSel ? (variant === "dark" ? "text-[#cdf464]" : "text-brand-600") : "invisible"}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="shrink-0 text-xs opacity-50">{o.hint}</span>}
                  </li>
                );
              })}
              {shown.length === 0 && <li className="px-3 py-3 text-sm opacity-60">No matches</li>}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Multi-select dropdown with checkboxes, search, and Select all / Clear. In forms it renders one hidden
 * input per chosen value (all with `name`); controlled via `values` + `onChange` too.
 */
export function MultiSelect({
  options, name, values, defaultValues, onChange, placeholder = "Any", ariaLabel, id, className = "", menuWidth = 260,
}: {
  options: SelectOption[];
  name?: string;
  values?: string[];
  defaultValues?: string[];
  onChange?: (values: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  className?: string;
  menuWidth?: number;
}) {
  const [inner, setInner] = useState<string[]>(defaultValues ?? []);
  const current = values ?? inner;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const listId = useId();
  const pos = useMenuPosition(open, trigger, menuWidth);
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  useOutside(open, [trigger, menu], close);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const set = (next: string[]) => {
    if (values === undefined) setInner(next);
    onChange?.(next);
  };
  const toggle = (v: string) => set(current.includes(v) ? current.filter((x) => x !== v) : [...current, v]);
  const labels = current.map((v) => options.find((o) => o.value === v)?.label ?? v);
  const summary = labels.length === 0 ? placeholder : labels.length <= 2 ? labels.join(", ") : `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "Enter", " "].includes(e.key)) { e.preventDefault(); setOpen(true); }
      return;
    }
    e.stopPropagation();
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" || (e.key === " " && (e.target as HTMLElement).tagName !== "INPUT")) { e.preventDefault(); if (shown[active]) toggle(shown[active].value); }
    else if (e.key === "Escape") { e.preventDefault(); close(); trigger.current?.focus(); }
    else if (e.key === "Tab") close();
  };

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={`input flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={`min-w-0 truncate ${current.length ? "" : "text-ink-3"}`}>{summary}</span>
        <span className="flex shrink-0 items-center gap-1">
          {current.length > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">{current.length}</span>}
          <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </span>
      </button>
      {name && current.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menu}
            data-floating-menu
            onKeyDown={onKey}
            style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: Math.max(pos.maxHeight, 200), zIndex: 80 }}
            className="flex flex-col overflow-hidden rounded-xl border border-line bg-white text-ink shadow-[var(--shadow-menu)]"
          >
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <Search className="h-4 w-4 shrink-0 opacity-50" />
              <input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} placeholder="Search…" aria-label="Search options" className="w-full bg-transparent text-sm outline-none" />
              {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X className="h-3.5 w-3.5 opacity-60" /></button>}
            </div>
            <ul id={listId} role="listbox" aria-multiselectable aria-label={ariaLabel} className="flex-1 overflow-y-auto p-1">
              {shown.map((o, i) => {
                const on = current.includes(o.value);
                return (
                  <li
                    key={o.value}
                    role="option"
                    aria-selected={on}
                    onPointerMove={() => setActive(i)}
                    onClick={() => toggle(o.value)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${i === active ? "bg-brand-50" : ""}`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white"}`}>
                      {on && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="shrink-0 text-xs text-ink-3">{o.hint}</span>}
                  </li>
                );
              })}
              {shown.length === 0 && <li className="px-3 py-3 text-sm text-ink-3">No matches</li>}
            </ul>
            <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs">
              <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => set([...new Set([...current, ...shown.map((o) => o.value)])])}>
                Select {query ? "matches" : "all"}
              </button>
              <button type="button" className="text-ink-2 hover:text-ink" onClick={() => set([])}>Clear</button>
              <button type="button" className="rounded-md bg-ink px-2.5 py-1 font-medium text-white" onClick={() => { close(); trigger.current?.focus(); }}>Done</button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
