"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { markNotificationsRead } from "@/app/outreachActions";
import { toast } from "@/components/ui/Toaster";

type Item = { id: string; type: string; title: string; body: string | null; href: string | null; read: boolean; at: string };

const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
};

/** Bell with unread count. Checks every minute; new alerts also pop up (and as desktop notifications if allowed). */
export function NotificationBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const seen = useRef<Set<string> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread: number; items: Item[] };
      // Announce alerts that arrived since the last check (not the backlog on first load).
      if (seen.current) {
        for (const n of data.items.filter((i) => !i.read && !seen.current!.has(i.id))) {
          toast(n.title, "ok");
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            const pop = new Notification(n.title, { body: n.body ?? undefined, tag: n.id });
            pop.onclick = () => { window.focus(); if (n.href) window.location.href = n.href; };
          }
        }
      }
      seen.current = new Set(data.items.map((i) => i.id));
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      /* offline: try again next minute */
    }
  }, []);

  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    load();
    const t = setInterval(load, 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const readAll = async () => {
    await markNotificationsRead("all");
    setItems((x) => x.map((i) => ({ ...i, read: true })));
    setUnread(0);
  };

  return (
    <div ref={box} className="relative">
      <button type="button" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white hover:bg-hover">
        {unread ? <BellRing className="h-4 w-4 text-brand-700" /> : <Bell className="h-4 w-4" />}
        {unread > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1 text-center text-[11px] font-semibold leading-5 text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-white shadow-[var(--shadow-menu)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && <button type="button" className="text-xs text-brand-700 hover:underline" onClick={readAll}>Mark all read</button>}
          </div>
          {perm === "default" && (
            <button type="button" className="w-full border-b border-line bg-brand-50 px-4 py-2 text-left text-xs text-brand-800" onClick={async () => setPerm(await Notification.requestPermission())}>
              Turn on desktop alerts, so new enquiries pop up even when this tab is in the background
            </button>
          )}
          <ul className="max-h-96 overflow-y-auto">
            {items.map((n) => {
              const body = (
                <>
                  <p className={`text-sm ${n.read ? "text-ink-2" : "font-medium"}`}>{n.title}</p>
                  {n.body && <p className="text-xs text-ink-3">{n.body}</p>}
                  <p className="mt-0.5 text-[11px] text-ink-3">{ago(n.at)}</p>
                </>
              );
              return (
                <li key={n.id} className={`border-b border-line-soft last:border-0 ${n.read ? "" : "bg-brand-50/40"}`}>
                  {n.href ? (
                    <Link href={n.href} onClick={() => { setOpen(false); if (!n.read) markNotificationsRead([n.id]).then(load); }} className="block px-4 py-2.5 hover:bg-hover">{body}</Link>
                  ) : (
                    <div className="px-4 py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-3">Nothing yet. New enquiries, replies and quote updates show up here.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
