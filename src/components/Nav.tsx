"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/today", label: "Today", icon: "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  { href: "/log", label: "Log", icon: "M12 5v14M5 12h14" },
  { href: "/pipeline", label: "Pipeline", icon: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z" },
  { href: "/leads", label: "Leads", icon: "M17 20h5v-2a3 3 0 0 0-5.4-1.8M9 20H2v-2a4 4 0 0 1 7-2.6M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" },
  { href: "/team", label: "Team", icon: "M3 3v18h18M7 15l4-4 3 3 5-6" },
];

const SETTINGS = {
  href: "/settings",
  label: "Settings",
  icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 10h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z",
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function SideNav({ dueCount, showSettings }: { dueCount: number; showSettings: boolean }) {
  const path = usePathname();
  return (
    <nav className="space-y-1">
      {(showSettings ? [...ITEMS, SETTINGS] : ITEMS).map((it) => {
        const active = path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
              active ? "bg-white/80 text-green-700 shadow-sm ring-1 ring-green-600/10" : "text-slate-600 hover:bg-white/50"
            }`}
          >
            <Icon d={it.icon} />
            <span className="flex-1">{it.label === "Log" ? "Quick log" : it.label}</span>
            {it.href === "/today" && dueCount > 0 && <span className="chip bg-green-100 text-green-700">{dueCount}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ dueCount, showSettings }: { dueCount: number; showSettings: boolean }) {
  const path = usePathname();
  const items = showSettings ? [...ITEMS, SETTINGS] : ITEMS;
  return (
    <nav
      className={`glass fixed inset-x-3 bottom-3 z-20 grid rounded-2xl pb-[env(safe-area-inset-bottom)] md:hidden ${
        showSettings ? "grid-cols-6" : "grid-cols-5"
      }`}
    >
      {items.map((it) => {
        const active = path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-green-700" : "text-slate-500"}`}
          >
            <Icon d={it.icon} />
            {it.label}
            {it.href === "/today" && dueCount > 0 && (
              <span className="absolute right-[calc(50%-20px)] top-1 rounded-full bg-green-600 px-1.5 text-[10px] text-white">{dueCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
