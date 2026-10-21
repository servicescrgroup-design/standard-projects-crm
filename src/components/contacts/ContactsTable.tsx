"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Download, GripVertical, Mail, Pencil, Phone, RotateCcw } from "lucide-react";
import { toCsv } from "@/lib/csv";
import { toast } from "@/components/ui/Toaster";

export type ContactRow = {
  id: string;
  company: string;
  domain: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  country: { name: string; flag: string } | null;
  about: string | null;
  aboutDetail: string | null;
  status: { label: string; tone: "customer" | "lost" | "open" };
  progress: number; // 0..1 along the pipeline
  stageLabel: string;
  owner: string | null;
};

// Soft logo backgrounds, picked from the company name so each company keeps its colour.
const LOGO = [
  "bg-indigo-50 text-indigo-700", "bg-sky-50 text-sky-700", "bg-orange-50 text-orange-700", "bg-violet-50 text-violet-700",
  "bg-emerald-50 text-emerald-700", "bg-rose-50 text-rose-700", "bg-amber-50 text-amber-700", "bg-cyan-50 text-cyan-700",
];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const initials = (s: string) => s.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white ${LOGO[hash(name) % LOGO.length]} ${size === "sm" ? "h-7 w-7 text-[10px]" : "h-10 w-10 text-xs"}`}
    >
      {initials(name)}
    </span>
  );
}

const PILL = {
  customer: "border-emerald-200 bg-emerald-50 text-emerald-700",
  lost: "border-line bg-canvas text-ink-2",
  open: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

// ---- Columns ----
// Company and Contact are pinned on the left (always visible when scrolling sideways); the rest can be
// dragged into any order. Every column can be resized by dragging its right edge.
type ColId = "company" | "contact" | "country" | "status" | "about" | "owner" | "pipeline";
const PINNED: ColId[] = ["company", "contact"];
const MOVABLE_DEFAULT: ColId[] = ["country", "status", "about", "owner", "pipeline"];
const DEFAULT_WIDTH: Record<ColId, number> = { company: 260, contact: 220, country: 170, status: 130, about: 280, owner: 170, pipeline: 170 };
const LABEL: Record<ColId, string> = { company: "Company", contact: "Contact", country: "Country", status: "Status", about: "About", owner: "Owner", pipeline: "Pipeline" };
const SELECT_W = 48;
const ACTIONS_W = 128;
const MIN_W = 90;
const MAX_W = 640;
const STORAGE_KEY = "spcrm.contacts.columns";

type Layout = { order: ColId[]; widths: Record<ColId, number> };
const DEFAULT_LAYOUT: Layout = { order: MOVABLE_DEFAULT, widths: DEFAULT_WIDTH };

function loadLayout(): Layout {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Layout> | null;
    if (!raw) return DEFAULT_LAYOUT;
    const order = Array.isArray(raw.order) ? raw.order.filter((c): c is ColId => MOVABLE_DEFAULT.includes(c as ColId)) : [];
    for (const c of MOVABLE_DEFAULT) if (!order.includes(c)) order.push(c);
    const widths = { ...DEFAULT_WIDTH };
    for (const c of Object.keys(DEFAULT_WIDTH) as ColId[]) {
      const w = Number(raw.widths?.[c]);
      if (Number.isFinite(w)) widths[c] = Math.min(MAX_W, Math.max(MIN_W, w));
    }
    return { order, widths };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function Cell({ col, r }: { col: ColId; r: ContactRow }) {
  switch (col) {
    case "company":
      return (
        <Link href={`/leads/${r.id}`} className="flex items-start gap-3">
          <Avatar name={r.company} />
          <span className="min-w-0 break-words">
            <span className="block font-medium leading-snug text-ink">{r.company}</span>
            <span className="block text-ink-2 [overflow-wrap:anywhere]">{r.domain ?? r.location ?? "—"}</span>
          </span>
        </Link>
      );
    case "contact":
      return (
        <span className="block min-w-0 break-words">
          <span className="block leading-snug text-ink">{r.contactName ?? <span className="text-ink-3">No name yet</span>}</span>
          {r.email && <span className="block text-xs text-ink-2 [overflow-wrap:anywhere]">{r.email}</span>}
          {r.phone && <span className="block text-xs text-ink-2">{r.phone}</span>}
        </span>
      );
    case "country":
      return r.country ? (
        <span className="flex items-center gap-2">
          <span className="text-lg leading-none" aria-hidden>{r.country.flag}</span>
          <span className="truncate">{r.country.name}</span>
        </span>
      ) : (
        <span className="text-ink-3">—</span>
      );
    case "status":
      return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL[r.status.tone]}`}>{r.status.label}</span>;
    case "about":
      return (
        <span className="block min-w-0">
          <span className="block truncate text-ink">{r.about ?? "—"}</span>
          {r.aboutDetail && <span className="line-clamp-2 text-ink-2">{r.aboutDetail}</span>}
        </span>
      );
    case "owner":
      return r.owner ? (
        <span className="flex items-center gap-2"><Avatar name={r.owner} size="sm" /><span className="truncate">{r.owner}</span></span>
      ) : (
        <span className="text-ink-3">Unassigned</span>
      );
    case "pipeline":
      return (
        <span className="flex items-center gap-2" title={r.stageLabel}>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-indigo-100">
            <span className={`block h-full rounded-full ${r.status.tone === "lost" ? "bg-ink-3" : "bg-indigo-600"}`} style={{ width: `${Math.max(6, Math.round(r.progress * 100))}%` }} />
          </span>
        </span>
      );
  }
}

/** Contacts table: pinned company/contact, resizable and re-orderable columns, row selection with bulk export. */
export function ContactsTable({ rows, sort, sortHref }: { rows: ContactRow[]; sort: "company" | "recent"; sortHref: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [dragging, setDragging] = useState<ColId | null>(null);
  const [dropBefore, setDropBefore] = useState<ColId | "end" | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const resizing = useRef<{ col: ColId; startX: number; startW: number } | null>(null);

  useEffect(() => setLayout(loadLayout()), []);
  const save = (next: Layout) => {
    setLayout(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode: layout just isn't remembered */
    }
  };

  // ---- resize ----
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const r = resizing.current;
      if (!r) return;
      const w = Math.min(MAX_W, Math.max(MIN_W, r.startW + e.clientX - r.startX));
      setLayout((l) => ({ ...l, widths: { ...l.widths, [r.col]: w } }));
    };
    const up = () => {
      if (!resizing.current) return;
      resizing.current = null;
      document.body.style.cursor = "";
      setLayout((l) => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(l));
        } catch {
          /* ignore */
        }
        return l;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);
  const startResize = (col: ColId, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = { col, startX: e.clientX, startW: layout.widths[col] };
    document.body.style.cursor = "col-resize";
  };
  const nudge = (col: ColId, delta: number) =>
    save({ ...layout, widths: { ...layout.widths, [col]: Math.min(MAX_W, Math.max(MIN_W, layout.widths[col] + delta)) } });

  // ---- reorder (drag and drop) ----
  const drop = (target: ColId | "end") => {
    if (!dragging || target === dragging) return;
    const order = layout.order.filter((c) => c !== dragging);
    const at = target === "end" ? order.length : order.indexOf(target);
    order.splice(at, 0, dragging);
    save({ ...layout, order });
  };
  const moveBy = (col: ColId, step: number) => {
    const order = [...layout.order];
    const i = order.indexOf(col);
    const j = i + step;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    save({ ...layout, order });
  };

  // ---- selection ----
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const some = !all && rows.some((r) => selected.has(r.id));
  const chosen = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const toggleAll = () => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)));
  const exportSelected = () => {
    const csv = toCsv(
      ["Company", "Website", "Contact", "Email", "Phone", "Country", "Location", "Stage", "Owner"],
      chosen.map((r) => [r.company, r.domain, r.contactName, r.email, r.phone, r.country?.name, r.location, r.stageLabel, r.owner]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `contacts-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };
  const copyEmails = async () => {
    const emails = chosen.map((r) => r.email).filter(Boolean);
    if (emails.length === 0) return toast("None of the selected contacts has an email", "error");
    await navigator.clipboard.writeText(emails.join(", "));
    toast(`${emails.length} email${emails.length === 1 ? "" : "s"} copied`, "ok");
  };

  const { widths, order } = layout;
  const left = { company: SELECT_W, contact: SELECT_W + widths.company };
  const tableWidth = SELECT_W + [...PINNED, ...order].reduce((t, c) => t + widths[c], 0) + ACTIONS_W;
  const pinnedBg = (sel: boolean) => (sel ? "bg-[#f5f6ff]" : "bg-white group-hover:bg-hover");
  const edge = scrolled ? "shadow-[6px_0_8px_-6px_rgba(16,24,40,0.18)]" : "";

  const header = (col: ColId) => {
    const pinned = PINNED.includes(col);
    const sticky = pinned ? `sm:sticky z-20 bg-canvas ${col === "contact" ? edge : ""}` : "";
    return (
      <th
        key={col}
        scope="col"
        style={{ width: widths[col], ...(pinned ? { left: left[col as "company" | "contact"] } : {}) }}
        className={`relative select-none py-3 pl-3 pr-4 text-left text-xs font-medium text-ink-2 ${sticky} ${dropBefore === col ? "shadow-[inset_3px_0_0_#4f46e5]" : ""} ${dragging === col ? "opacity-40" : ""}`}
        draggable={!pinned}
        onDragStart={pinned ? undefined : (e) => {
          setDragging(col);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", col);
        }}
        onDragEnd={() => { setDragging(null); setDropBefore(null); }}
        onDragOver={pinned ? undefined : (e) => { if (dragging) { e.preventDefault(); setDropBefore(col); } }}
        onDrop={pinned ? undefined : (e) => { e.preventDefault(); drop(col); setDragging(null); setDropBefore(null); }}
      >
        <span className="flex items-center gap-1">
          {!pinned && <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-ink-3" aria-hidden />}
          {col === "company" ? (
            <Link href={sortHref} className="inline-flex items-center gap-1 hover:text-ink">
              Company {sort === "company" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
            </Link>
          ) : (
            <span className="truncate">{LABEL[col]}</span>
          )}
          {!pinned && (
            <span className="sr-only">
              <button type="button" onClick={() => moveBy(col, -1)}>Move {LABEL[col]} left</button>
              <button type="button" onClick={() => moveBy(col, 1)}>Move {LABEL[col]} right</button>
            </span>
          )}
        </span>
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${LABEL[col]} column`}
          aria-valuenow={widths[col]}
          tabIndex={0}
          onPointerDown={(e) => startResize(col, e)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") nudge(col, -20);
            if (e.key === "ArrowRight") nudge(col, 20);
          }}
          onDoubleClick={() => save({ ...layout, widths: { ...widths, [col]: DEFAULT_WIDTH[col] } })}
          className="absolute -right-1 top-0 z-30 flex h-full w-3 cursor-col-resize items-center justify-center outline-none group/rs"
        >
          <span className="h-5 w-0.5 rounded bg-line group-hover/rs:bg-indigo-500 group-focus/rs:bg-indigo-500" />
        </span>
      </th>
    );
  };

  const changed = JSON.stringify(layout) !== JSON.stringify(DEFAULT_LAYOUT);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-2.5 text-sm">
        {chosen.length > 0 ? (
          <>
            <span className="font-medium text-indigo-700">{chosen.length} selected</span>
            <button type="button" onClick={exportSelected} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-medium hover:bg-hover">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button type="button" onClick={copyEmails} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-medium hover:bg-hover">
              <Copy className="h-4 w-4" /> Copy emails
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-ink-2 hover:text-ink">Clear</button>
          </>
        ) : (
          <span className="text-xs text-ink-3">Drag a column&rsquo;s edge to resize it, or drag its header to move it. Company and Contact stay pinned.</span>
        )}
        {changed && (
          <button type="button" onClick={() => save(DEFAULT_LAYOUT)} className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-2 hover:text-ink">
            <RotateCcw className="h-3.5 w-3.5" /> Reset columns
          </button>
        )}
      </div>
      <div className="overflow-x-auto" onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 0)}>
        <table className="text-sm" style={{ tableLayout: "fixed", width: tableWidth, minWidth: "100%" }}>
          <thead>
            <tr className="border-b border-line bg-canvas">
              <th scope="col" style={{ width: SELECT_W, left: 0 }} className="z-20 bg-canvas py-3 pl-5 sm:sticky">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={all}
                  ref={(el) => { if (el) el.indeterminate = some; }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-line accent-indigo-600"
                />
              </th>
              {PINNED.map(header)}
              {order.map(header)}
              <th
                scope="col"
                style={{ width: ACTIONS_W }}
                className={`${dropBefore === "end" ? "shadow-[inset_3px_0_0_#4f46e5]" : ""}`}
                onDragOver={(e) => { if (dragging) { e.preventDefault(); setDropBefore("end"); } }}
                onDrop={(e) => { e.preventDefault(); drop("end"); setDragging(null); setDropBefore(null); }}
              >
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const sel = selected.has(r.id);
              return (
                <tr key={r.id} className={`group border-b border-line-soft last:border-0 align-top ${sel ? "bg-[#f5f6ff]" : "hover:bg-hover"}`}>
                  <td style={{ left: 0 }} className={`z-10 py-4 pl-5 sm:sticky ${pinnedBg(sel)}`}>
                    <input type="checkbox" aria-label={`Select ${r.company}`} checked={sel} onChange={() => toggle(r.id)} className="mt-3 h-4 w-4 rounded border-line accent-indigo-600" />
                  </td>
                  {PINNED.map((c) => (
                    <td key={c} style={{ left: left[c as "company" | "contact"] }} className={`z-10 py-4 pl-3 pr-4 sm:sticky ${pinnedBg(sel)} ${c === "contact" ? edge : ""}`}>
                      <Cell col={c} r={r} />
                    </td>
                  ))}
                  {order.map((c) => (
                    <td key={c} className="overflow-hidden py-4 pl-3 pr-4 align-middle"><Cell col={c} r={r} /></td>
                  ))}
                  <td className="py-4 pr-5 align-middle">
                    <div className="flex items-center justify-end gap-1 text-ink-2">
                      {r.phone && (
                        <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${r.company}`} className="rounded-lg p-2 hover:bg-white hover:text-ink"><Phone className="h-4 w-4" /></a>
                      )}
                      {r.email && (
                        <Link href={`/leads/${r.id}#email`} aria-label={`Email ${r.company}`} className="rounded-lg p-2 hover:bg-white hover:text-ink"><Mail className="h-4 w-4" /></Link>
                      )}
                      <Link href={`/leads/${r.id}`} aria-label={`Edit ${r.company}`} className="rounded-lg p-2 hover:bg-white hover:text-ink"><Pencil className="h-4 w-4" /></Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="px-5 py-12 text-center text-sm text-ink-3">No contacts match these filters.</p>}
    </div>
  );
}
