"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, Download, Menu, RefreshCw, Sparkles, Upload } from "lucide-react";
import { Dropdown, menuItemClass } from "@/components/ui/Dropdown";

const TITLES: [string, string][] = [
  ["/workspace", "Workspace"],
  ["/dashboard", "Dashboard"],
  ["/deals", "Deals"],
  ["/notes", "Notes"],
  ["/emails", "Emails"],
  ["/reports", "Reports"],
  ["/workflows", "Workflows"],
  ["/companies", "Companies"],
  ["/contacts", "Contacts"],
  ["/meetings", "Meetings"],
  ["/leads", "Leads"],
  ["/today", "Today"],
  ["/log", "Quick log"],
  ["/team", "Team"],
  ["/settings", "Settings"],
  ["/help", "Help Center"],
  ["/account", "My Account"],
];

function timeLabel(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Global top bar: page title, Ask AI, data freshness, imports and exports. */
export function Toolbar({ isOwner, renderedAt, onMenu, onAskAI }: { isOwner: boolean; renderedAt: string; onMenu: () => void; onAskAI: () => void }) {
  const path = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [updated, setUpdated] = useState(() => new Date(renderedAt));
  // Server render time is the moment this data was read; refresh re-reads it.
  useEffect(() => setUpdated(new Date(renderedAt)), [renderedAt]);

  const title = TITLES.find(([p]) => path === p || path.startsWith(`${p}/`))?.[1] ?? "";
  // Exports follow the filters on the page you're looking at (Deals, Companies, Leads).
  const exportQuery = ["/deals", "/companies", "/leads"].some((p) => path.startsWith(p)) ? search.toString() : "";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-white/95 px-4 backdrop-blur-sm md:px-6">
      <button type="button" onClick={onMenu} className="btn px-2 text-ink-2 hover:bg-hover md:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="mr-auto truncate text-base font-semibold">{title}</h1>

      <button type="button" onClick={onAskAI} className="btn-primary">
        <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Ask AI</span>
      </button>

      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        className="btn hidden text-ink-2 hover:bg-hover lg:inline-flex"
        title="Reload the latest data"
        aria-live="polite"
      >
        {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        {pending ? "Updating…" : `Updated ${timeLabel(updated)}`}
      </button>

      <Dropdown
        label="Imports"
        trigger={({ toggle, open }) => (
          <button type="button" onClick={toggle} aria-expanded={open} aria-haspopup="menu" className="btn-ghost hidden sm:inline-flex">
            <Upload className="h-4 w-4" /> Imports <ChevronDown className="h-3.5 w-3.5 text-ink-3" />
          </button>
        )}
      >
        {(close) =>
          isOwner ? (
            <Link role="menuitem" href="/settings#import" onClick={close} className={menuItemClass}>
              <span>
                <span className="block font-medium">Notion Customers CRM</span>
                <span className="block text-xs text-ink-3">JSON export · skips duplicates</span>
              </span>
            </Link>
          ) : (
            <p className="px-3 py-2 text-sm text-ink-2">Only the owner can import data.</p>
          )
        }
      </Dropdown>

      <Dropdown
        label="Exports"
        trigger={({ toggle, open }) => (
          <button type="button" onClick={toggle} aria-expanded={open} aria-haspopup="menu" className="btn-dark">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Exports</span> <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </button>
        )}
      >
        {(close) => (
          <>
            <a role="menuitem" href={`/api/export/leads${exportQuery ? `?${exportQuery}` : ""}`} onClick={close} className={menuItemClass}>
              <span>
                <span className="block font-medium">Leads & deals (CSV)</span>
                <span className="block text-xs text-ink-3">{exportQuery ? "Uses this page's filters" : "Everything you can see"}</span>
              </span>
            </a>
            <a role="menuitem" href="/api/export/activities" onClick={close} className={menuItemClass}>
              <span>
                <span className="block font-medium">Activity history (CSV)</span>
                <span className="block text-xs text-ink-3">Calls, emails, meetings and notes</span>
              </span>
            </a>
          </>
        )}
      </Dropdown>
    </header>
  );
}
