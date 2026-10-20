import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { RowCard, UserStatus } from "../lib/list";
import type { UserCounts } from "../lib/counts";
import { COUNTS_CHANGED_EVENT } from "../lib/counts-client";
import MediaRowCard from "./MediaRowCard";
import type { Dictionary, Locale } from "../i18n";

interface MediaRowProps {
  status: UserStatus;
  title: string;
  href: string;
  total: number;
  initialItems: RowCard[];
  withDivider?: boolean;
  locale: Locale;
  dict: Dictionary["home"];
}

const BATCH_SIZE = 12;
const SKELETON_COUNT = 6;
const SCROLL_RATIO = 0.85;
const EDGE_THRESHOLD = 4;

const EMPTY_KEYS: Record<UserStatus, keyof Dictionary["home"]> = {
  COMPLETED: "emptyCompleted",
  CURRENT: "emptyCurrent",
  PLANNING: "emptyPlanning",
};

const COUNT_KEYS: Record<UserStatus, keyof UserCounts> = {
  COMPLETED: "completed",
  CURRENT: "current",
  PLANNING: "planning",
};

function SkeletonCard() {
  return (
    <div className="w-32 shrink-0 animate-pulse sm:w-36 md:w-40 lg:w-44">
      <div className="aspect-[2/3] w-full rounded-xl bg-surface-2" />
      <div className="mt-2 h-3 w-4/5 rounded bg-surface-2" />
      <div className="mt-1.5 h-3 w-1/2 rounded bg-surface-2" />
    </div>
  );
}

export default function MediaRow({
  status,
  title,
  href,
  total,
  initialItems,
  withDivider = false,
  locale,
  dict,
}: MediaRowProps) {
  const sectionClass = withDivider
    ? "space-y-4 mt-10 border-t border-white/15 pt-6 sm:mt-14 sm:pt-8"
    : "space-y-4";

  const [items, setItems] = useState<RowCard[]>(initialItems);
  const [liveTotal, setLiveTotal] = useState(total);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const itemsRef = useRef(items);
  const loadMoreRef = useRef<() => void>(() => {});

  const hasMore = items.length < liveTotal;
  const rightVisible = showRight || hasMore;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const countKey = COUNT_KEYS[status];
    function handleCountsChange(event: Event) {
      const detail = (event as CustomEvent<Partial<UserCounts>>).detail;
      const next = detail?.[countKey];
      if (typeof next === "number") setLiveTotal(next);
    }
    window.addEventListener(COUNTS_CHANGED_EVENT, handleCountsChange);
    return () => window.removeEventListener(COUNTS_CHANGED_EVENT, handleCountsChange);
  }, [status]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || itemsRef.current.length >= liveTotal) return;
    loadingRef.current = true;
    setIsLoading(true);
    setHasError(false);
    try {
      const params = new URLSearchParams({
        status,
        offset: String(itemsRef.current.length),
        limit: String(BATCH_SIZE),
      });
      const response = await fetch(`/api/home/row?${params.toString()}`);
      if (!response.ok) throw new Error("No se pudo cargar más");
      const data = (await response.json()) as { items?: RowCard[] };
      const next = Array.isArray(data.items) ? data.items : [];
      setItems((prev) => {
        const seen = new Set(prev.map((entry) => entry.anilistId));
        return [...prev, ...next.filter((entry) => !seen.has(entry.anilistId))];
      });
    } catch {
      setHasError(true);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [status, liveTotal]);

  loadMoreRef.current = loadMore;

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > EDGE_THRESHOLD);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_THRESHOLD);
  }, []);

  useEffect(() => {
    updateArrows();
  }, [items, updateArrows]);

  useEffect(() => {
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [updateArrows]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreRef.current();
      },
      { root, rootMargin: "0px 400px 0px 0px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  function scrollByRatio(direction: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * SCROLL_RATIO, behavior: "smooth" });
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-bold tracking-tight text-text sm:text-xl">
        {title}{" "}
        <span data-count={liveTotal} className="text-sm font-semibold text-text-muted">
          ({new Intl.NumberFormat(locale).format(liveTotal)})
        </span>
      </h2>
      <a
        href={href}
        aria-label={dict.viewAll.replace("{title}", title)}
        style={
          {
            "--btn-section": `"${title}"`,
            "--btn-label": `"${dict.viewAllButton}"`,
          } as CSSProperties
        }
        className="btn-swap shrink-0 focus:outline-none focus:ring-2 focus:ring-violet"
      ></a>
    </div>
  );

  if (total === 0) {
    return (
      <section className={sectionClass}>
        {header}
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-white/5 bg-surface p-5 sm:flex-row sm:items-center">
          <p className="text-sm text-text-muted">{dict[EMPTY_KEYS[status]]}</p>
          <a
            href={href}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/5 bg-surface-2 px-4 text-xs font-medium text-text transition hover:bg-surface-2/80"
          >
            {dict.browseAnime}
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className={sectionClass}>
      {header}

      <div className="relative">
        {showLeft && (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-12 bg-gradient-to-r from-obsidian to-transparent md:block"
            aria-hidden="true"
          />
        )}
        {rightVisible && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-12 bg-gradient-to-l from-obsidian to-transparent md:block"
            aria-hidden="true"
          />
        )}

        {showLeft && (
          <button
            type="button"
            onClick={() => scrollByRatio(-1)}
            aria-label={dict.scrollLeft.replace("{title}", title)}
            className="absolute left-1 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-obsidian/70 text-text shadow-lg backdrop-blur-md transition hover:bg-obsidian/90 hover:text-violet focus:outline-none focus:ring-2 focus:ring-violet md:flex"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        {rightVisible && (
          <button
            type="button"
            onClick={() => scrollByRatio(1)}
            aria-label={dict.scrollRight.replace("{title}", title)}
            className="absolute right-1 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-obsidian/70 text-text shadow-lg backdrop-blur-md transition hover:bg-obsidian/90 hover:text-violet focus:outline-none focus:ring-2 focus:ring-violet md:flex"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={updateArrows}
          className="no-scrollbar flex snap-x scroll-smooth gap-3 overflow-x-auto px-1 pb-2 pt-1"
        >
          {items.map((item) => (
            <MediaRowCard key={item.anilistId} item={item} status={status} locale={locale} dict={dict} />
          ))}

          {isLoading &&
            Array.from({ length: SKELETON_COUNT }).map((_, index) => (
              <SkeletonCard key={`skeleton-${index}`} />
            ))}

          {hasError && (
            <div className="flex w-32 shrink-0 snap-start items-center justify-center sm:w-36 md:w-40 lg:w-44">
              <button
                type="button"
                onClick={() => void loadMore()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-surface-2 px-3 text-xs font-medium text-text transition hover:bg-surface-2/80"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {dict.retry}
              </button>
            </div>
          )}

          <div ref={sentinelRef} className="h-px w-px shrink-0" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
