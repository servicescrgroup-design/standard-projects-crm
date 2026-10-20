"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Star,
  StickyNote,
  Trophy,
  UserCircle,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/app/actions";

export type SidebarUser = { name: string; email: string; role: string };
export type SidebarProject = { id: string; company: string };

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

const MAIN: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/deals", label: "Deals", icon: Handshake },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/emails", label: "Emails", icon: Mail },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/workflows", label: "Workflows", icon: Workflow },
];

/** Pages that can be pinned as favourites. Per-viewer preference, kept in this browser. */
const FAVOURITE_CHOICES: NavItem[] = [
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/today", label: "Today", icon: Clock },
  { href: "/team", label: "Team", icon: Trophy },
];
const DEFAULT_FAVOURITES = ["/companies", "/contacts", "/meetings", "/today", "/team"];
const FAV_KEY = "spcrm.favourites";
const COLLAPSE_KEY = "spcrm.sidebarCollapsed";

const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", TEAM_LEAD: "Team lead", REP: "Sales rep" };

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the preference just won't persist */
  }
}

function NavLink({ item, collapsed, active, indent = false, onNavigate }: { item: NavItem; collapsed: boolean; active: boolean; indent?: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150 ${
        active ? "bg-line-soft font-semibold text-ink" : "text-ink-2 hover:bg-hover hover:text-ink"
      } ${collapsed ? "justify-center" : ""} ${indent && !collapsed ? "pl-8" : ""}`}
    >
      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-ink" : "text-ink-3 group-hover:text-ink-2"}`} strokeWidth={1.8} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.badge ? <span className="rounded-md bg-brand-50 px-1.5 text-xs font-semibold text-brand-700">{item.badge}</span> : null}
    </Link>
  );
}

function Section({
  title,
  icon: Icon,
  iconClass,
  collapsed,
  children,
  action,
}: {
  title: string;
  icon: LucideIcon;
  iconClass: string;
  collapsed: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  if (collapsed) return <div className="space-y-0.5 border-t border-line-soft pt-2">{children}</div>;
  return (
    <div>
      <div className="group flex items-center gap-1 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-3 hover:text-ink-2"
        >
          <Icon className={`h-4 w-4 ${iconClass}`} strokeWidth={2} />
          <span className="flex-1">{title}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
        </button>
        {action}
      </div>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

export function Sidebar({
  user,
  dueCount,
  projects,
  mobileOpen,
  onCloseMobile,
}: {
  user: SidebarUser;
  dueCount: number;
  projects: SidebarProject[];
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [favourites, setFavourites] = useState<string[]>(DEFAULT_FAVOURITES);
  const [editingFavs, setEditingFavs] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCollapsed(readStorage(COLLAPSE_KEY, false));
    setFavourites(readStorage(FAV_KEY, DEFAULT_FAVOURITES));
  }, []);

  // Close the profile menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const isActive = (href: string) => path === href || path.startsWith(`${href}/`);
  const isCollapsed = collapsed && !mobileOpen; // the mobile drawer is always full width
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      writeStorage(COLLAPSE_KEY, !c);
      return !c;
    });
  const toggleFavourite = (href: string) =>
    setFavourites((f) => {
      const next = f.includes(href) ? f.filter((h) => h !== href) : [...f, href];
      writeStorage(FAV_KEY, next);
      return next;
    });

  const favItems = FAVOURITE_CHOICES.filter((c) => favourites.includes(c.href)).map((c) =>
    c.href === "/today" ? { ...c, badge: dueCount } : c,
  );
  const close = () => onCloseMobile();

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-ink/30 md:hidden" onClick={close} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-white transition-[width,transform] duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "w-[72px]" : "w-[284px]"}`}
        aria-label="Main navigation"
      >
        {/* Workspace */}
        <div className={`flex items-center gap-2 p-3 ${isCollapsed ? "justify-center" : ""}`}>
          <Link
            href="/dashboard"
            onClick={close}
            className={`flex min-w-0 items-center gap-2.5 rounded-xl border border-line px-2.5 py-2 transition-colors hover:bg-hover ${isCollapsed ? "" : "flex-1"}`}
            title="Standard Projects"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">S</span>
            {!isCollapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">Standard Projects</span>
                <span className="block truncate text-xs text-ink-3">Sales workspace</span>
              </span>
            )}
          </Link>
          <button type="button" onClick={close} className="btn px-2 text-ink-2 md:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-3">
          <div className="space-y-0.5">
            {MAIN.map((item) => (
              <NavLink key={item.href} item={item} collapsed={isCollapsed} active={isActive(item.href)} onNavigate={close} />
            ))}
          </div>

          <div className="border-t border-line-soft" />

          <Section
            title="Favorites"
            icon={Star}
            iconClass="text-amber-500"
            collapsed={isCollapsed}
            action={
              <button
                type="button"
                onClick={() => setEditingFavs((e) => !e)}
                className="rounded-md p-1 text-ink-3 hover:bg-hover hover:text-ink-2"
                aria-label={editingFavs ? "Done editing favorites" : "Add or remove favorites"}
                title={editingFavs ? "Done" : "Add or remove favorites"}
              >
                {editingFavs ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            }
          >
            {editingFavs && !isCollapsed
              ? FAVOURITE_CHOICES.map((c) => (
                  <label key={c.href} className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 pl-8 pr-2.5 text-sm text-ink-2 hover:bg-hover">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={favourites.includes(c.href)} onChange={() => toggleFavourite(c.href)} />
                    {c.label}
                  </label>
                ))
              : favItems.map((item) => <NavLink key={item.href} item={item} collapsed={isCollapsed} active={isActive(item.href)} indent onNavigate={close} />)}
          </Section>

          <Section
            title="Projects"
            icon={FolderKanban}
            iconClass="text-orange-500"
            collapsed={isCollapsed}
            action={
              <Link href="/deals?stage=WON" onClick={close} className="rounded-md p-1 text-ink-3 hover:bg-hover hover:text-ink-2" aria-label="All won deals" title="All won deals">
                <Plus className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {projects.length === 0 && !isCollapsed && <p className="py-1.5 pl-8 pr-2.5 text-xs text-ink-3">Won deals appear here as projects.</p>}
            {!isCollapsed &&
              projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/leads/${p.id}`}
                  onClick={close}
                  className={`flex items-center gap-2 truncate rounded-lg py-1.5 pl-8 pr-2.5 text-sm ${isActive(`/leads/${p.id}`) ? "bg-line-soft font-semibold" : "text-ink-2 hover:bg-hover hover:text-ink"}`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  <span className="truncate">{p.company}</span>
                </Link>
              ))}
          </Section>
        </nav>

        {/* Bottom */}
        <div className="space-y-0.5 border-t border-line-soft px-3 pt-2">
          {user.role === "OWNER" && <NavLink item={{ href: "/settings", label: "Settings", icon: Settings }} collapsed={isCollapsed} active={isActive("/settings")} onNavigate={close} />}
          <NavLink item={{ href: "/help", label: "Help Center", icon: LifeBuoy }} collapsed={isCollapsed} active={isActive("/help")} onNavigate={close} />
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`hidden w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-2 hover:bg-hover hover:text-ink md:flex ${isCollapsed ? "justify-center" : ""}`}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.8} /> : <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.8} />}
            {!isCollapsed && "Collapse"}
          </button>
        </div>

        <div ref={menuRef} className="relative p-3">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-hover ${isCollapsed ? "justify-center" : ""}`}
            title={isCollapsed ? user.name : undefined}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {user.name.trim()[0]?.toUpperCase()}
            </span>
            {!isCollapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{user.name}</span>
                <span className="block truncate text-xs text-ink-3">{user.email}</span>
              </span>
            )}
          </button>
          {menuOpen && (
            <div role="menu" className="absolute bottom-full left-3 right-3 mb-1 min-w-52 rounded-xl border border-line bg-white p-1 shadow-[var(--shadow-menu)]">
              <div className="px-3 py-2 text-xs text-ink-3">{ROLE_LABEL[user.role] ?? user.role}</div>
              <Link role="menuitem" href="/account" onClick={() => (setMenuOpen(false), close())} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-hover">
                <UserCircle className="h-4 w-4 text-ink-3" /> My Account
              </Link>
              {user.role === "OWNER" && (
                <Link role="menuitem" href="/settings" onClick={() => (setMenuOpen(false), close())} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-hover">
                  <Settings className="h-4 w-4 text-ink-3" /> Workspace Settings
                </Link>
              )}
              <form action={signOut}>
                <button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </form>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
