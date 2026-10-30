import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { getDictionary, type Locale } from "../i18n";
import type { RowCard } from "../lib/list";
import MediaRowCard from "./MediaRowCard";

interface PendingOrderEditorProps {
  initialItems: RowCard[];
  initialOrder: number[];
  locale: Locale;
}

const LABELS = {
  es: {
    title: "Para ver primero",
    hint: "Arrastra desde abajo para priorizar; arrastra de vuelta para quitar la prioridad. También puedes usar los botones.",
    empty: "Arrastra aquí desde abajo o usa el botón + para elegir qué ver primero.",
    unordered: "Sin ordenar",
    returnHint: "Todos están priorizados. Arrastra aquí para quitar una prioridad o usa el botón ×.",
    prioritize: "Priorizar",
    remove: "Quitar prioridad",
    saving: "Guardando…",
    saved: "Guardado",
    keyboardHint: "Usa las flechas izquierda y derecha para cambiar el orden con el teclado.",
    error: "No se pudo guardar el orden. Inténtalo de nuevo.",
  },
  en: {
    title: "Watch first",
    hint: "Drag from below to prioritize; drag back to remove priority. You can also use the buttons.",
    empty: "Drag here from below or use the + button to choose what to watch first.",
    unordered: "Unordered",
    returnHint: "All items are prioritized. Drag here to remove a priority or use the × button.",
    prioritize: "Prioritize",
    remove: "Remove priority",
    saving: "Saving…",
    saved: "Saved",
    keyboardHint: "Use the left and right arrow keys to reorder with the keyboard.",
    error: "Could not save the order. Please try again.",
  },
};

export default function PendingOrderEditor({ initialItems, initialOrder = [], locale }: PendingOrderEditorProps) {
  const dict = getDictionary(locale);
  const labels = LABELS[locale];
  const itemsById = new Map(initialItems.map((item) => [item.anilistId, item]));
  const [order, setOrder] = useState(() => [...new Set(initialOrder)].filter((id) => itemsById.has(id)));
  const orderRef = useRef(order);
  const confirmedOrder = useRef(order);
  const drag = useRef<{ id: number; before: number[] } | null>(null);
  const suppressClickUntil = useRef(0);
  const savingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridItems = initialItems.filter((item) => !order.includes(item.anilistId));
  const actionClass = "absolute left-2 top-2 z-30 inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-obsidian/60 text-text shadow-md backdrop-blur-md transition hover:border-violet hover:text-violet focus:outline-none focus:ring-2 focus:ring-violet disabled:cursor-not-allowed disabled:opacity-40";

  function preview(next: number[]) {
    orderRef.current = next;
    setOrder(next);
  }

  function cancelDrag() {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    suppressClickUntil.current = Date.now() + 250;
    preview(current.before);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") cancelDrag();
    }
    window.addEventListener("dragend", cancelDrag);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("dragend", cancelDrag);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 4);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [order, updateArrows]);

  function scrollByRatio(direction: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  }

  async function saveOrder(next: number[]) {
    if (savingRef.current || drag.current) return;
    savingRef.current = true;
    next = [...new Set(next)].filter((id) => itemsById.has(id));
    preview(next);
    setIsSaving(true);
    setSaved(false);
    setError(false);
    try {
      const response = await fetch("/api/list/planning-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next }),
      });
      if (!response.ok) throw new Error("Could not save planning order");
      confirmedOrder.current = next;
      setSaved(true);
    } catch {
      preview(confirmedOrder.current);
      setError(true);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  function startDrag(event: DragEvent<HTMLDivElement>) {
    const target = event.target as Element;
    const card = target.closest<HTMLElement>("[data-pending-id]");
    const id = Number(card?.dataset.pendingId);
    if (savingRef.current || !card || !itemsById.has(id) || target.closest("button")) {
      event.preventDefault();
      return;
    }
    drag.current = { id, before: [...orderRef.current] };
    suppressClickUntil.current = Infinity;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(id));
  }

  function allowDrop(event: DragEvent<HTMLElement>) {
    if (savingRef.current || !drag.current) return false;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    return true;
  }

  function orderAtDrop(event: DragEvent<HTMLElement>) {
    const current = drag.current!;
    const card = (event.target as Element).closest<HTMLElement>("[data-priority-id]");
    const targetId = Number(card?.dataset.priorityId);
    if (targetId === current.id) return orderRef.current;
    const next = orderRef.current.filter((id) => id !== current.id);
    const index = next.indexOf(targetId);
    const bounds = card?.getBoundingClientRect();
    const after = bounds && event.clientX >= bounds.left + bounds.width / 2;
    next.splice(index < 0 ? next.length : index + (after ? 1 : 0), 0, current.id);
    return next;
  }

  function drop(event: DragEvent<HTMLElement>, next: number[]) {
    if (!allowDrop(event)) return;
    // Consume the drag before saving: the subsequent dragend must not roll back or save again.
    drag.current = null;
    suppressClickUntil.current = Date.now() + 250;
    void saveOrder(next);
  }

  function blockDragClick(event: MouseEvent<HTMLDivElement>) {
    if (event.detail > 0 && Date.now() < suppressClickUntil.current && (event.target as Element).closest("a")) {
      event.preventDefault();
    }
  }

  function moveItem(index: number, direction: -1 | 1) {
    if (savingRef.current || drag.current || index + direction < 0 || index + direction >= orderRef.current.length) return;
    const next = [...orderRef.current];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    void saveOrder(next);
  }

  return (
    <div
      className="space-y-8"
      aria-busy={isSaving}
      onDragStartCapture={startDrag}
      onMouseDownCapture={(event) => {
        // Let the card wrapper, not its native link/image, own the drag.
        event.currentTarget.querySelectorAll("a, img").forEach((el) => el.setAttribute("draggable", "false"));
      }}
      onClickCapture={blockDragClick}
      onAuxClickCapture={blockDragClick}
    >
      <section
        className="space-y-4"
        aria-label={labels.title}
        data-anime-list={JSON.stringify(order)}
        onDragOver={(event) => {
          if (allowDrop(event) && drag.current!.before.includes(drag.current!.id)) preview(orderAtDrop(event));
        }}
        onDrop={(event) => {
          if (!drag.current || savingRef.current) return;
          drop(event, drag.current.before.includes(drag.current.id) ? orderRef.current : orderAtDrop(event));
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight text-text sm:text-xl">{labels.title}</h2>
          <p role="status" className="text-xs text-text-muted">
            {isSaving ? labels.saving : saved ? labels.saved : ""}
          </p>
        </div>
        <p className="text-sm text-text-muted">{labels.hint}</p>
        {error && <p role="alert" className="text-sm text-red-400">{labels.error}</p>}
        <div className="relative">
          {showLeft && (
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-12 bg-gradient-to-r from-obsidian to-transparent md:block" aria-hidden="true" />
          )}
          {showRight && (
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-12 bg-gradient-to-l from-obsidian to-transparent md:block" aria-hidden="true" />
          )}
          {showLeft && (
            <button
              type="button"
              onClick={() => scrollByRatio(-1)}
              aria-label={dict.home.scrollLeft.replace("{title}", labels.title)}
              className="absolute left-1 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-obsidian/70 text-text shadow-lg backdrop-blur-md transition hover:bg-obsidian/90 hover:text-violet focus:outline-none focus:ring-2 focus:ring-violet md:flex"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          {showRight && (
            <button
              type="button"
              onClick={() => scrollByRatio(1)}
              aria-label={dict.home.scrollRight.replace("{title}", labels.title)}
              className="absolute right-1 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-obsidian/70 text-text shadow-lg backdrop-blur-md transition hover:bg-obsidian/90 hover:text-violet focus:outline-none focus:ring-2 focus:ring-violet md:flex"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <div
            ref={scrollRef}
            onScroll={updateArrows}
            className={`no-scrollbar flex snap-x scroll-smooth gap-3 overflow-x-auto px-1 pb-2 pt-1${order.length === 0 ? " min-h-[150px] items-center justify-center rounded-2xl border border-dashed border-white/20" : ""}`}
          >
            {order.length === 0 && <p className="p-5 text-center text-sm text-text-muted">{labels.empty}</p>}
            {order.map((id, index) => {
              const item = itemsById.get(id)!;
              return (
                <div
                  key={id}
                  data-pending-id={id}
                  data-priority-id={id}
                  className="relative w-32 shrink-0 snap-start sm:w-36 md:w-40 lg:w-44"
                  draggable={!isSaving}
                >
                  <MediaRowCard item={item} status="PLANNING" locale={locale} dict={dict.home} />
                  <button
                    type="button"
                    disabled={isSaving}
                    aria-label={`${labels.remove}: ${item.title}`}
                    aria-description={labels.keyboardHint}
                    aria-keyshortcuts="ArrowLeft ArrowRight"
                    title={labels.remove}
                    onClick={() => void saveOrder(orderRef.current.filter((entry) => entry !== id))}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                      event.preventDefault();
                      moveItem(index, event.key === "ArrowLeft" ? -1 : 1);
                    }}
                    className={actionClass}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section
        className="space-y-4"
        aria-label={labels.unordered}
        data-anime-list={JSON.stringify(gridItems.map((item) => item.anilistId))}
        onDragOver={allowDrop}
        onDrop={(event) => {
          if (drag.current) drop(event, orderRef.current.filter((id) => id !== drag.current!.id));
        }}
      >
        <h2 className="text-lg font-bold tracking-tight text-text sm:text-xl">{labels.unordered}</h2>
        {gridItems.length === 0 && (
          <div className="flex min-h-[150px] items-center justify-center rounded-2xl border border-dashed border-white/20 p-5 text-center text-sm text-text-muted">{labels.returnHint}</div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {gridItems.map((item) => (
            <div key={item.anilistId} data-pending-id={item.anilistId} draggable={!isSaving} className="group relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-xl border border-white/5 shadow-lg shadow-black/30 transition-all duration-300 hover:border-violet sm:rounded-2xl">
              <div
                className="absolute inset-0 h-full w-full"
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
                    className="h-full w-full object-cover object-center transition-opacity group-hover:opacity-90"
                  />
                )}
              </div>
              <a href={`/anime/${item.anilistId}`} className="absolute inset-0 z-20" aria-label={item.title}></a>
              <button
                type="button"
                disabled={isSaving}
                aria-label={`${labels.prioritize}: ${item.title}`}
                title={labels.prioritize}
                onClick={() => void saveOrder([...orderRef.current, item.anilistId])}
                className={actionClass}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="relative z-10 flex justify-end p-2 sm:p-3">
                <span className="inline-flex items-center gap-1 rounded-full border bg-obsidian/60 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md shadow-md sm:text-[11px] text-violet border-violet/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet"></span>
                  {dict.status.planning}
                </span>
              </div>
              <div className="pointer-events-none relative z-30 flex flex-col justify-end gap-2 bg-gradient-to-t from-obsidian via-obsidian/85 to-transparent p-2.5 pt-12 sm:p-3.5">
                <h3
                  className="line-clamp-2 text-xs font-semibold leading-snug text-text transition-colors group-hover:text-violet sm:text-sm"
                  title={item.title}
                >
                  {item.title}
                </h3>
                {item.year != null && (
                  <div className="flex items-center justify-between border-t border-white/5 pt-1 text-[11px] sm:text-xs">
                    <span className="font-bold text-emerald">—</span>
                    {Boolean(item.year) && <span className="text-text-dim">{item.year}</span>}
                  </div>
                )}
                <div className="pointer-events-auto relative z-30"></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
