import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, X, Loader2 } from "lucide-react";
import type { Dictionary, Locale } from "../i18n";

interface SearchMediaItem {
  id: number;
  title: {
    romaji?: string | null;
    english?: string | null;
  };
  episodes?: number | null;
  seasonYear?: number | null;
  format?: string | null;
  coverImage?: {
    large?: string | null;
    color?: string | null;
  } | null;
  userStatus: string | null;
  userProgress: number | null;
  userScore: number | null;
}

const STATUS_META: Record<
  string,
  { labelKey: keyof Dictionary["status"]; className: string }
> = {
  CURRENT: { labelKey: "current", className: "border-cyan/30 bg-cyan/10 text-cyan" },
  PLANNING: { labelKey: "planning", className: "border-violet/30 bg-violet/10 text-violet" },
  COMPLETED: { labelKey: "completed", className: "border-emerald/30 bg-emerald/10 text-emerald" },
};

interface SearchBarProps {
  locale: Locale;
  dict: Dictionary["nav"];
  statusDict: Dictionary["status"];
}

export default function SearchBar({ locale, dict, statusDict }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsMobileExpanded(false);
    setActiveIndex(-1);
  }, []);

  // Cerrar al hacer click afuera o presionar Esc
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileExpanded) return;
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose, isMobileExpanded]);

  // Mantener la opción activa a la vista
  useEffect(() => {
    if (activeIndex < 0) return;
    const item = results[activeIndex];
    if (!item) return;
    document
      .getElementById(`search-option-${item.id}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  // Búsqueda con debounce de 350ms y AbortController
  const performSearch = useCallback((searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setHasSearched(true);

    fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
      signal: abortController.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Search failed");
        return res.json();
      })
      .then((data: SearchMediaItem[]) => {
        setResults(data);
        setActiveIndex(-1);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setIsLoading(false);
        }
      });
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setIsOpen(true);
    setActiveIndex(-1);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (value.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(value);
    }, 350);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      handleClose();
      return;
    }

    if (!isOpen || results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      if (activeIndex >= 0 && results[activeIndex]) {
        event.preventDefault();
        window.location.assign(`/anime/${results[activeIndex].id}`);
      }
    }
  };

  const renderResultItem = (item: SearchMediaItem, index: number) => {
    const title = item.title.english || item.title.romaji || dict.untitled;
    const fallbackBg = item.coverImage?.color || "#1E293B";
    const metaParts = [
      item.seasonYear ? new Intl.NumberFormat(locale, { useGrouping: false }).format(item.seasonYear) : null,
      item.format ? item.format.toUpperCase() : null,
      item.episodes
        ? `${new Intl.NumberFormat(locale).format(item.episodes)} ${dict.episodesShort}`
        : null,
    ].filter(Boolean) as string[];
    const statusMeta = item.userStatus ? STATUS_META[item.userStatus] : undefined;
    const isActive = index === activeIndex;

    return (
      <a
        key={item.id}
        id={`search-option-${item.id}`}
        href={`/anime/${item.id}`}
        role="option"
        aria-selected={isActive}
        onMouseEnter={() => setActiveIndex(index)}
        className={`flex min-h-[64px] items-center gap-3 border-b border-white/5 p-3 transition-colors last:border-b-0 ${
          isActive ? "bg-surface-2" : "hover:bg-surface-2/60"
        }`}
      >
        <div
          className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-white/5"
          style={{ backgroundColor: fallbackBg }}
        >
          {item.coverImage?.large && (
            <img
              src={item.coverImage.large}
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              width={48}
              height={64}
            />
          )}
        </div>

        <div className="min-w-0 flex-1 pr-2">
          <p className="line-clamp-1 text-xs font-semibold leading-snug text-text sm:text-sm">
            {title}
          </p>
          {metaParts.length > 0 && (
            <p className="mt-1 truncate text-[11px] text-text-muted">
              {metaParts.join(" • ")}
            </p>
          )}
        </div>

        {statusMeta && (
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.className}`}
          >
            {statusDict[statusMeta.labelKey]}
          </span>
        )}
      </a>
    );
  };

  return (
    <>
      <div ref={containerRef} className="flex w-full justify-end sm:block">
        {/* Botón trigger para móviles */}
        <div className="sm:hidden">
          <button
            type="button"
            onClick={() => {
              setIsMobileExpanded(true);
              setIsOpen(true);
              setTimeout(() => mobileInputRef.current?.focus(), 50);
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-transparent text-text-muted transition hover:border-white/5 hover:bg-surface-2 hover:text-text"
            aria-label={dict.searchOpen}
          >
            <Search className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de búsqueda desktop */}
        <div className="relative hidden w-full sm:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (query.trim().length >= 2) setIsOpen(true);
              }}
              placeholder={dict.searchPlaceholder}
              aria-label={dict.searchPlaceholder}
              autoComplete="off"
              role="combobox"
              aria-expanded={isOpen && query.trim().length >= 2}
              aria-controls="search-results-desktop"
              className="w-full rounded-xl border border-white/5 bg-surface-2 py-2 pl-9 pr-8 text-sm text-text placeholder:text-text-muted transition focus:border-violet focus:outline-none focus:ring-1 focus:ring-violet"
            />
            {isLoading ? (
              <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-violet" />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setIsOpen(false);
                  setActiveIndex(-1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text"
                aria-label={dict.searchClear}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          {/* Dropdown desktop */}
          {isOpen && query.trim().length >= 2 && (
            <div
              id="search-results-desktop"
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(460px,70vh)] overflow-y-auto rounded-2xl border border-white/10 bg-surface/95 shadow-2xl backdrop-blur-xl no-scrollbar"
            >
              {isLoading && results.length === 0 ? (
                <div className="flex items-center justify-center gap-2 p-8 text-center text-xs text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-violet" />
                  <span>{dict.searching}</span>
                </div>
              ) : results.length > 0 ? (
                <div>{results.map(renderResultItem)}</div>
              ) : hasSearched ? (
                <div className="p-8 text-center text-xs text-text-muted">
                  {dict.searchNoResults.replace("{query}", query)}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Modal móvil a pantalla completa */}
      {isMobileExpanded &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex h-[100dvh] flex-col bg-obsidian/98 p-4 backdrop-blur-xl sm:hidden">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text"
                aria-label={dict.searchClose}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  ref={mobileInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={dict.searchPlaceholder}
                  aria-label={dict.searchPlaceholder}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={results.length > 0}
                  aria-controls="search-results-mobile"
                  className="w-full rounded-xl border border-white/5 bg-surface-2 py-2.5 pl-9 pr-8 text-base text-text placeholder:text-text-muted focus:border-violet focus:outline-none focus:ring-1 focus:ring-violet"
                />
                {isLoading && (
                  <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-violet" />
                )}
              </div>
            </div>

            <div
              id="search-results-mobile"
              role="listbox"
              className="mt-2 flex-1 overflow-y-auto no-scrollbar"
            >
              {isLoading && results.length === 0 ? (
                <div className="flex items-center justify-center gap-2 p-8 text-center text-xs text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-violet" />
                  <span>{dict.searching}</span>
                </div>
              ) : results.length > 0 ? (
                <div className="divide-y divide-white/5">{results.map(renderResultItem)}</div>
              ) : hasSearched && query.trim().length >= 2 ? (
                <div className="p-8 text-center text-xs text-text-muted">
                  {dict.searchNoResults.replace("{query}", query)}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-text-dim">
                  {dict.searchMinChars}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
