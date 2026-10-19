import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  LoaderCircle,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Toast, useToast } from "./Toast";
import { emitCounts, refreshCounts, syncCountsFromResponse } from "../lib/counts-client";

export interface TopItem {
  anilistId: number;
  score: number | null;
  title: string;
  coverImage: string | null;
  color: string | null;
  year: number | null;
  format: string | null;
  episodes: number | null;
}

interface TopListProps {
  initialItems: TopItem[];
  candidates: TopItem[];
  hasCompleted: boolean;
}

const FORMAT_LABELS: Record<string, string> = {
  TV: "Serie de TV",
  TV_SHORT: "Corto de TV",
  MOVIE: "Película",
  SPECIAL: "Especial",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Video musical",
};

const REORDER_DEBOUNCE_MS = 400;

function positionClass(position: number): string {
  if (position === 1) return "text-amber";
  if (position === 2) return "text-amber/70";
  if (position === 3) return "text-amber/50";
  return "text-text-muted";
}

function metaParts(item: TopItem): string[] {
  return [
    item.year ? String(item.year) : null,
    item.format ? FORMAT_LABELS[item.format] ?? item.format : null,
    item.episodes ? `${item.episodes} eps` : null,
  ].filter(Boolean) as string[];
}

function Cover({ item, className }: { item: TopItem; className: string }) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-white/10 ${className}`}
      style={{ backgroundColor: item.color || "#1E293B" }}
    >
      {item.coverImage && (
        <img
          src={item.coverImage}
          alt={item.title}
          loading="lazy"
          decoding="async"
          width={300}
          height={450}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

interface RowProps {
  item: TopItem;
  index: number;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (item: TopItem) => void;
}

function SortableRow({ item, index, position, isFirst, isLast, onMove, onRemove }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.anilistId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const meta = metaParts(item);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-stretch gap-1.5 rounded-2xl border border-white/5 bg-surface p-2 shadow-xl md:gap-3 md:p-3 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex flex-col justify-center">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={isFirst}
          aria-label="Subir una posición"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-25"
        >
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={isLast}
          aria-label="Bajar una posición"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-25"
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <span
        className={`flex w-8 shrink-0 items-center justify-center text-lg font-bold tabular-nums md:w-12 md:text-2xl ${positionClass(
          position
        )}`}
      >
        #{position}
      </span>

      <a
        href={`/anime/${item.anilistId}`}
        className="w-14 shrink-0 self-center md:w-20"
        aria-label={item.title}
      >
        <Cover item={item} className="aspect-[2/3] w-full" />
      </a>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <a href={`/anime/${item.anilistId}`} className="block">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-text transition-colors hover:text-violet md:text-base">
            {item.title}
          </p>
        </a>
        {meta.length > 0 && (
          <p className="hidden truncate text-xs text-text-muted md:block">{meta.join(" • ")}</p>
        )}
        {typeof item.score === "number" && item.score > 0 && (
          <p className="text-xs font-semibold text-emerald">{item.score}/10</p>
        )}
      </div>

      <div className="flex items-center gap-0.5 self-center">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reordenar ${item.title}`}
          className="inline-flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-lg text-text-dim transition hover:bg-surface-2 hover:text-text active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(item)}
          aria-label={`Quitar ${item.title} del Top`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-text-dim transition hover:bg-surface-2 hover:text-amber"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function RowPreview({ item, position }: { item: TopItem; position: number }) {
  return (
    <div className="flex items-stretch gap-3 rounded-2xl border border-violet/40 bg-surface p-3 shadow-2xl shadow-obsidian">
      <span className={`flex w-12 items-center justify-center text-2xl font-bold tabular-nums ${positionClass(position)}`}>
        #{position}
      </span>
      <Cover item={item} className="w-16 shrink-0 self-center aspect-[2/3]" />
      <div className="flex min-w-0 flex-1 items-center">
        <p className="line-clamp-2 text-sm font-semibold text-text">{item.title}</p>
      </div>
    </div>
  );
}

interface AddPanelProps {
  available: TopItem[];
  pendingId: number | null;
  onAdd: (item: TopItem) => void;
  onClose: () => void;
}

function AddPanel({ available, pendingId, onAdd, onClose }: AddPanelProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return available;
    return available.filter((item) => item.title.toLowerCase().includes(term));
  }, [available, query]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-obsidian/80 backdrop-blur-sm"
      />
      <div className="relative z-10 flex max-h-[85dvh] w-full flex-col rounded-t-2xl border border-white/10 bg-surface shadow-2xl sm:max-h-[70vh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/5 p-4">
          <h2 className="text-sm font-semibold text-text">Agregar al Top</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-2 hover:text-text"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar entre tus completados..."
              autoComplete="off"
              className="w-full rounded-xl border border-white/5 bg-surface-2 py-2.5 pl-9 pr-3 text-base text-text placeholder:text-text-muted focus:border-violet focus:outline-none focus:ring-1 focus:ring-violet"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 no-scrollbar">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-dim">
              {available.length === 0
                ? "Ya agregaste todos tus animes completados."
                : "No se encontraron animes para tu búsqueda."}
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {filtered.map((item) => {
                const isPending = pendingId === item.anilistId;
                return (
                  <li key={item.anilistId}>
                    <button
                      type="button"
                      onClick={() => onAdd(item)}
                      disabled={pendingId !== null}
                      className="flex w-full items-center gap-3 py-2.5 text-left transition disabled:opacity-60"
                    >
                      <Cover item={item} className="w-10 shrink-0 aspect-[2/3]" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-text">{item.title}</p>
                        {metaParts(item).length > 0 && (
                          <p className="mt-0.5 truncate text-[11px] text-text-muted">
                            {metaParts(item).join(" • ")}
                          </p>
                        )}
                      </div>
                      {isPending ? (
                        <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-violet" aria-hidden="true" />
                      ) : (
                        <Plus className="h-4 w-4 shrink-0 text-text-dim" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function TopList({ initialItems, candidates, hasCompleted }: TopListProps) {
  const [items, setItems] = useState<TopItem[]>(initialItems);
  const [available, setAvailable] = useState<TopItem[]>(candidates);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const { message, showToast } = useToast();

  const confirmedRef = useRef<number[]>(initialItems.map((item) => item.anilistId));
  const requestIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const itemsById = useMemo(() => new Map(items.map((item) => [item.anilistId, item])), [items]);

  const commitOrder = useCallback(
    async (order: number[]) => {
      const requestId = ++requestIdRef.current;
      try {
        const response = await fetch("/api/top/reorder", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? "No se pudo guardar el orden");
        if (requestId === requestIdRef.current) {
          confirmedRef.current = order;
          syncCountsFromResponse(data);
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        const confirmed = confirmedRef.current;
        setItems((current) => {
          if (confirmed.length !== current.length) return current;
          const map = new Map(current.map((item) => [item.anilistId, item]));
          const reordered = confirmed.map((id) => map.get(id)).filter(Boolean) as TopItem[];
          return reordered.length === current.length ? reordered : current;
        });
        showToast(err instanceof Error ? err.message : "No se pudo guardar el orden");
      }
    },
    [showToast]
  );

  const scheduleOrder = useCallback(
    (next: TopItem[]) => {
      setItems(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      const order = next.map((item) => item.anilistId);
      timerRef.current = setTimeout(() => {
        void commitOrder(order);
      }, REORDER_DEBOUNCE_MS);
    },
    [commitOrder]
  );

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    scheduleOrder(arrayMove(items, index, target));
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(Number(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.anilistId === active.id);
    const newIndex = items.findIndex((item) => item.anilistId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    scheduleOrder(arrayMove(items, oldIndex, newIndex));
  }

  async function removeFromTop(item: TopItem) {
    if (!window.confirm(`¿Quitar "${item.title}" de tu Top?`)) return;

    const prevItems = items;
    const prevAvailable = available;
    setItems(items.filter((entry) => entry.anilistId !== item.anilistId));
    setAvailable([...available, item]);
    emitCounts({ top: Math.max(items.length - 1, 0) });

    try {
      const response = await fetch("/api/top", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anilistId: item.anilistId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "No se pudo quitar del Top");
      confirmedRef.current = confirmedRef.current.filter((id) => id !== item.anilistId);
      syncCountsFromResponse(data);
      showToast("Quitado de tu Top");
    } catch (err) {
      setItems(prevItems);
      setAvailable(prevAvailable);
      void refreshCounts();
      showToast(err instanceof Error ? err.message : "No se pudo quitar del Top");
    }
  }

  async function addToTop(item: TopItem) {
    if (pendingId !== null) return;
    setPendingId(item.anilistId);
    emitCounts({ top: items.length + 1 });
    try {
      const response = await fetch("/api/top", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anilistId: item.anilistId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "No se pudo agregar al Top");
      setItems((current) => [...current, item]);
      confirmedRef.current = [...confirmedRef.current, item.anilistId];
      setAvailable((current) => current.filter((entry) => entry.anilistId !== item.anilistId));
      syncCountsFromResponse(data);
      showToast("Agregado a tu Top");
    } catch (err) {
      void refreshCounts();
      showToast(err instanceof Error ? err.message : "No se pudo agregar al Top");
    } finally {
      setPendingId(null);
    }
  }

  const activeItem = activeId != null ? itemsById.get(activeId) ?? null : null;
  const activePosition = activeId != null ? items.findIndex((item) => item.anilistId === activeId) + 1 : 0;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text sm:text-2xl">Mi Top</h1>
          <p className="mt-1 text-sm text-text-muted">
            {items.length} {items.length === 1 ? "anime" : "animes"} en tu ranking
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          disabled={available.length === 0}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-violet px-4 text-sm font-semibold text-white shadow-lg shadow-violet/25 transition hover:bg-violet/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar al top
        </button>
      </div>

      {items.length === 0 ? (
        <section className="mx-auto my-8 max-w-xl rounded-2xl border border-white/5 bg-surface p-8 text-center shadow-xl sm:my-12 sm:p-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/5 bg-surface-2 text-violet shadow-inner">
            <ChevronUp className="h-8 w-8" aria-hidden="true" />
          </div>
          {hasCompleted ? (
            <>
              <h2 className="text-lg font-semibold text-text">Tu Top está vacío</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
                Elegí tus animes completados y armá tu ranking personal.
              </p>
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-violet px-4 text-xs font-semibold text-white shadow-lg shadow-violet/25 transition hover:bg-violet/90"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Agregar al top
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-text">Todavía no completaste animes</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
                Marcá animes como completados para poder armar tu Top personal.
              </p>
              <a
                href="/pendientes"
                className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-violet px-4 text-xs font-semibold text-white shadow-lg shadow-violet/25 transition hover:bg-violet/90"
              >
                Buscar animes
              </a>
            </>
          )}
        </section>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={items.map((item) => item.anilistId)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2 sm:space-y-3">
              {items.map((item, index) => (
                <SortableRow
                  key={item.anilistId}
                  item={item}
                  index={index}
                  position={index + 1}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                  onMove={move}
                  onRemove={removeFromTop}
                />
              ))}
            </ul>
          </SortableContext>
          <DragOverlay>
            {activeItem ? <RowPreview item={activeItem} position={activePosition} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {panelOpen && (
        <AddPanel
          available={available}
          pendingId={pendingId}
          onAdd={addToTop}
          onClose={() => setPanelOpen(false)}
        />
      )}

      <Toast message={message} />
    </div>
  );
}
