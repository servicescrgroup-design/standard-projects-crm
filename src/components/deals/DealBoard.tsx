"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, GripVertical, Signal } from "lucide-react";
import { moveLeadOnBoard } from "@/app/actions";
import { toast } from "@/components/ui/Toaster";
import { STAGE_LABELS, STAGE_PILL, positionBetween, type Stage } from "@/lib/domain";

export type DealCardData = {
  id: string;
  company: string;
  stage: Stage;
  priority: string | null;
  tag: string | null;
  note: string | null;
  value: number; // minor units, first-year value
  due: string | null; // ISO
  overdue: boolean;
  owner: string | null;
  position: number | null;
};

const PAGE = 50;
const kBaht = (minor: number) => {
  const v = minor / 100;
  return v >= 1000 ? `฿${Math.round(v / 1000)}k` : `฿${Math.round(v)}`;
};
const PRIORITY_COLOR: Record<string, string> = { A: "text-emerald-600", B: "text-brand-600", C: "text-ink-3" };

function CardBody({ d, dragging = false }: { d: DealCardData; dragging?: boolean }) {
  return (
    <div className={`rounded-xl border border-line bg-white p-3 transition-shadow duration-150 ${dragging ? "rotate-1 shadow-[0_12px_28px_rgba(16,24,40,.16)]" : "shadow-[var(--shadow-card)] hover:shadow-[0_4px_12px_rgba(16,24,40,.08)]"}`}>
      <div className="flex items-start gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">{d.company.trim()[0]?.toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{d.company}</div>
          {d.due && (
            <div className={`flex items-center gap-1 text-xs ${d.overdue ? "font-medium text-rose-600" : "text-ink-3"}`}>
              <CalendarDays className="h-3 w-3" />
              {new Date(d.due).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </div>
          )}
        </div>
      </div>
      {d.note && <p className="mt-2 line-clamp-2 text-xs text-ink-2">{d.note}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {d.priority && (
          <span className={`chip ${PRIORITY_COLOR[d.priority] ?? ""}`} title={`Priority ${d.priority}`}>
            <Signal className="h-3 w-3" /> {d.priority}
          </span>
        )}
        {d.value > 0 && <span className="chip">{kBaht(d.value)}</span>}
        {d.tag && <span className="chip max-w-[9rem] truncate">{d.tag}</span>}
      </div>
    </div>
  );
}

function SortableCard({ d }: { d: DealCardData }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: d.id, data: { stage: d.stage } });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? "opacity-40" : ""} {...attributes} {...listeners}>
      <Link href={`/leads/${d.id}`} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-brand-500" draggable={false}>
        <CardBody d={d} />
      </Link>
    </li>
  );
}

function Column({ stage, cards, total, onMore }: { stage: Stage; cards: DealCardData[]; total: number; onMore: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${stage}`, data: { stage } });
  return (
    <section className={`flex w-72 shrink-0 flex-col rounded-2xl bg-[#f6f7f9] p-2 transition-colors duration-150 ${isOver ? "ring-2 ring-brand-300" : ""}`} aria-label={STAGE_LABELS[stage]}>
      <header className="flex items-center gap-2 px-1.5 py-1.5">
        <GripVertical className="h-4 w-4 text-ink-3" aria-hidden />
        <span className={`pill ${STAGE_PILL[stage]} uppercase tracking-wide`}>{STAGE_LABELS[stage]}</span>
        <span className="text-xs font-semibold text-ink-3">{total}</span>
      </header>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 p-0.5">
          {cards.map((d) => (
            <SortableCard key={d.id} d={d} />
          ))}
          {total === 0 && <li className="rounded-xl border border-dashed border-line py-6 text-center text-xs text-ink-3">Drop deals here</li>}
        </ul>
      </SortableContext>
      {total > cards.length && (
        <button type="button" onClick={onMore} className="mt-1 rounded-lg py-1.5 text-xs font-medium text-brand-700 hover:bg-white">
          Show more ({total - cards.length})
        </button>
      )}
    </section>
  );
}

/** Kanban pipeline. Drag a card to change its stage; order within a column is saved too. */
export function DealBoard({ stages, deals }: { stages: Stage[]; deals: DealCardData[] }) {
  const [items, setItems] = useState(deals);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<DealCardData[] | null>(null);
  const [, startTransition] = useTransition();

  // Keep in sync when the server sends new data (filters changed, refresh).
  const [prevDeals, setPrevDeals] = useState(deals);
  if (deals !== prevDeals) {
    setPrevDeals(deals);
    setItems(deals);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byStage = useMemo(() => {
    const m = new Map<Stage, DealCardData[]>(stages.map((s) => [s, []]));
    for (const d of items) m.get(d.stage)?.push(d);
    return m;
  }, [items, stages]);

  const stageOf = (id: string): Stage | undefined => (id.startsWith("col:") ? (id.slice(4) as Stage) : items.find((d) => d.id === id)?.stage);
  const active = activeId ? items.find((d) => d.id === activeId) ?? null : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setSnapshot(items);
  }

  // Live preview: move the card into the column it's hovering over.
  function onDragOver(e: DragOverEvent) {
    const id = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const to = stageOf(overId);
    const from = stageOf(id);
    if (!to || !from || to === from) return;
    setItems((list) => {
      const moving = list.find((d) => d.id === id);
      if (!moving) return list;
      const rest = list.filter((d) => d.id !== id);
      const target = rest.filter((d) => d.stage === to);
      const overIndex = overId.startsWith("col:") ? target.length : target.findIndex((d) => d.id === overId);
      const anchor = target[overIndex];
      const at = anchor ? rest.indexOf(anchor) : rest.length;
      const next = [...rest];
      next.splice(at, 0, { ...moving, stage: to });
      return next;
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    setActiveId(null);
    const before = snapshot;
    setSnapshot(null);
    if (!overId || !before) return;
    const stage = stageOf(id);
    if (!stage) return;

    // Final order inside the target column (reorder if dropped on a card in the same column).
    let list = items;
    const col = list.filter((d) => d.stage === stage);
    const from = col.findIndex((d) => d.id === id);
    const to = overId.startsWith("col:") ? col.length - 1 : col.findIndex((d) => d.id === overId);
    if (from !== -1 && to !== -1 && from !== to) {
      const reordered = [...col];
      const [m] = reordered.splice(from, 1);
      reordered.splice(to, 0, m);
      list = [...list.filter((d) => d.stage !== stage), ...reordered];
    }
    const finalCol = list.filter((d) => d.stage === stage);
    const i = finalCol.findIndex((d) => d.id === id);
    const pos = (n: DealCardData | undefined, fallbackIndex: number) => n?.position ?? fallbackIndex * 1000;
    const position = positionBetween(i > 0 ? pos(finalCol[i - 1], i - 1) : null, i < finalCol.length - 1 ? pos(finalCol[i + 1], i + 1) : null);
    const original = before.find((d) => d.id === id);
    if (original?.stage === stage && original.position === position) return;

    const updated = list.map((d) => (d.id === id ? { ...d, position } : d));
    setItems(updated);
    startTransition(async () => {
      const res = await moveLeadOnBoard(id, stage, position);
      if (res.error) {
        setItems(before);
        toast(res.error, "error");
      } else if (original?.stage !== stage) {
        toast(`${original?.company ?? "Deal"} moved to ${STAGE_LABELS[stage]}`);
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        if (snapshot) setItems(snapshot);
        setActiveId(null);
        setSnapshot(null);
      }}
    >
      <div className="-mx-4 overflow-x-auto px-4 pb-3 md:-mx-6 md:px-6">
        <div className="flex items-start gap-4">
          {stages.map((s) => {
            const all = byStage.get(s) ?? [];
            const limit = limits[s] ?? PAGE;
            return (
              <Column key={s} stage={s} cards={all.slice(0, limit)} total={all.length} onMore={() => setLimits((l) => ({ ...l, [s]: limit + PAGE }))} />
            );
          })}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 180 }}>{active ? <div className="w-[272px]"><CardBody d={active} dragging /></div> : null}</DragOverlay>
    </DndContext>
  );
}
