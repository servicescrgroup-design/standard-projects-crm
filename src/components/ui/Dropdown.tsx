"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Small accessible dropdown: click to open, outside click / Escape to close, arrow keys move
 * between items. Items are rendered by the caller (links or buttons with role="menuitem").
 */
export function Dropdown({
  trigger,
  children,
  align = "right",
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // Menus of <Select>s inside this dropdown render in a portal; clicking them isn't "outside".
      if ((e.target as Element | null)?.closest?.("[data-floating-menu]")) return;
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
        if (!items.length) return;
        e.preventDefault();
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next].focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          className={`absolute top-full z-50 mt-1.5 min-w-56 rounded-xl border border-line bg-white p-1 shadow-[var(--shadow-menu)] ${align === "right" ? "right-0" : "left-0"}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export const menuItemClass =
  "flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-hover focus:bg-hover focus:outline-none";
