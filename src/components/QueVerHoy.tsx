import { useState } from "react";
import { Check, LoaderCircle, Play, Plus, Shuffle } from "lucide-react";
import { Toast, useToast } from "./Toast";
import BackButton from "./BackButton";
import { syncCountsFromResponse } from "../lib/counts-client";
import { apiErrorMessage } from "../lib/api-errors";
import { t, type Dictionary } from "../i18n";

interface QueVerHoyProps {
  viendo: number;
  pendientes: number;
  dict: Dictionary["queVerHoy"];
  formats: Dictionary["formats"];
  errors: Dictionary["errors"];
  backLabel: string;
}

interface RandomAnime {
  id: number;
  status: string;
  progress: number;
  title: { romaji: string | null; english: string | null };
  coverImage: { extraLarge?: string | null; large?: string | null; color?: string | null } | null;
  bannerImage: string | null;
  seasonYear: number | null;
  format: string | null;
  episodes: number | null;
  genres: string[];
  averageScore: number | null;
}

type View = "menu" | "follow" | "start";

export default function QueVerHoy({ viendo, pendientes, dict, formats, errors, backLabel }: QueVerHoyProps) {
  const [view, setView] = useState<View>("menu");
  const [item, setItem] = useState<RandomAnime | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [started, setStarted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { message, showToast } = useToast();

  const statusForView = view === "follow" ? "CURRENT" : "PLANNING";
  const countForView = view === "follow" ? viendo : pendientes;
  const itemTitle = item
    ? item.title.english || item.title.romaji || `Anime #${item.id}`
    : "";
  const poster = item?.coverImage?.extraLarge || item?.coverImage?.large || null;
  const percent =
    item && item.episodes && item.episodes > 0
      ? Math.min(Math.round((item.progress / item.episodes) * 100), 100)
      : 0;

  async function fetchRandom(status: "CURRENT" | "PLANNING", excludeId?: number) {
    setIsLoading(true);
    setError(null);
    setNotice(null);
    setStarted(false);

    try {
      const params = new URLSearchParams({ status });
      if (excludeId) params.set("exclude", String(excludeId));

      const response = await fetch(`/api/random?${params.toString()}`);
      if (response.status === 404) {
        setItem(null);
        setNotice(excludeId ? dict.onlyOne : dict.noAnime);
        return;
      }
      if (!response.ok) throw new Error(dict.fetchError);

      const data: RandomAnime = await response.json();
      setItem(data);
    } catch (err) {
      setItem(null);
      setError(err instanceof Error ? err.message : dict.fetchError);
    } finally {
      setIsLoading(false);
    }
  }

  function choose(next: Exclude<View, "menu">) {
    setView(next);
    void fetchRandom(next === "follow" ? "CURRENT" : "PLANNING");
  }

  function changeOption() {
    setView("menu");
    setItem(null);
    setNotice(null);
    setError(null);
    setStarted(false);
  }

  function another() {
    if (countForView <= 1) {
      setNotice(dict.onlyOne);
      return;
    }
    void fetchRandom(statusForView, item?.id);
  }

  async function increment() {
    if (!item || isActing) return;
    setIsActing(true);
    try {
      const response = await fetch("/api/list/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anilistId: item.id, delta: 1 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(apiErrorMessage(data.error, dict.progressError, errors));

      setItem((prev) =>
        prev
          ? {
              ...prev,
              progress: typeof data.progress === "number" ? data.progress : prev.progress,
              status: typeof data.status === "string" ? data.status : prev.status,
            }
          : prev
      );
      showToast(data.status === "COMPLETED" ? dict.markedCompleted : dict.episodeUpdated);
      syncCountsFromResponse(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : dict.progressError);
    } finally {
      setIsActing(false);
    }
  }

  async function startWatching() {
    if (!item || isActing) return;
    setIsActing(true);
    try {
      const response = await fetch("/api/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anilistId: item.id, status: "CURRENT", progress: 0 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(apiErrorMessage(data.error, dict.addError, errors));

      setItem((prev) => (prev ? { ...prev, status: "CURRENT", progress: 0 } : prev));
      setStarted(true);
      showToast(dict.addedToCurrent);
      syncCountsFromResponse(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : dict.addError);
    } finally {
      setIsActing(false);
    }
  }

  if (view === "menu") {
    const seguirDisabled = viendo === 0;
    const empezarDisabled = pendientes === 0;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text sm:text-2xl">{dict.title}</h1>
          <p className="mt-1 text-sm text-text-muted">{dict.subtitle}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => choose("follow")}
            disabled={seguirDisabled}
            className="group flex min-h-[160px] flex-col justify-between rounded-2xl border border-cyan/20 bg-surface p-6 text-left shadow-xl transition hover:border-cyan disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-cyan/20"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/10 text-cyan">
              <Play className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="mt-4 block">
              <span className="block text-lg font-semibold text-text">{dict.follow}</span>
              {seguirDisabled ? (
                <span className="mt-1 block text-sm text-text-dim">{dict.noCurrent}</span>
              ) : (
                <span className="mt-1 block text-sm text-text-muted">{t(dict.currentCount, { count: viendo })}</span>
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() => choose("start")}
            disabled={empezarDisabled}
            className="group flex min-h-[160px] flex-col justify-between rounded-2xl border border-violet/20 bg-surface p-6 text-left shadow-xl transition hover:border-violet disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-violet/20"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-violet/30 bg-violet/10 text-violet">
              <Plus className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="mt-4 block">
              <span className="block text-lg font-semibold text-text">{dict.start}</span>
              {empezarDisabled ? (
                <span className="mt-1 block text-sm text-text-dim">{dict.noPlanning}</span>
              ) : (
                <span className="mt-1 block text-sm text-text-muted">
                  {t(pendientes === 1 ? dict.planningCountOne : dict.planningCountOther, { count: pendientes })}
                </span>
              )}
            </span>
          </button>
        </div>

        {(seguirDisabled || empezarDisabled) && (
          <a
            href="/pendientes"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/5 bg-surface-2 px-4 text-xs font-medium text-text transition hover:bg-surface-2/80"
          >
            {dict.browseHint}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4 sm:pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton fallback="/que-ver-hoy" onNavigate={changeOption} label={backLabel} />
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            view === "follow" ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-violet/30 bg-violet/10 text-violet"
          }`}
        >
          {view === "follow" ? dict.follow : dict.start}
        </span>
      </div>

      {isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-white/5 bg-surface">
          <LoaderCircle className="h-6 w-6 animate-spin text-violet" aria-hidden="true" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-white/5 bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">{error}</p>
          <button
            type="button"
            onClick={another}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-violet px-4 text-xs font-semibold text-white transition hover:bg-violet/90"
          >
            {dict.retry}
          </button>
        </div>
      ) : item ? (
        <section
          key={item.id}
          className="animate-fade-in overflow-hidden rounded-2xl border border-white/5 bg-surface shadow-xl"
        >
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
            <a
              href={`/anime/${item.id}`}
              className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-44"
              aria-label={itemTitle}
            >
              <div
                className="aspect-[2/3] overflow-hidden rounded-xl border border-white/10 transition-colors hover:border-violet"
                style={{ backgroundColor: item.coverImage?.color || "#1E293B" }}
              >
                {poster && (
                  <img
                    src={poster}
                    alt={itemTitle}
                    loading="lazy"
                    decoding="async"
                    width={352}
                    height={528}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            </a>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <a href={`/anime/${item.id}`} className="w-fit">
                <h2 className="line-clamp-2 text-xl font-bold tracking-tight text-text transition-colors hover:text-violet sm:text-2xl">
                  {itemTitle}
                </h2>
              </a>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                {item.averageScore && <span className="font-semibold text-emerald">{item.averageScore}/100</span>}
                {item.seasonYear && <span>{item.seasonYear}</span>}
                {item.format && <span>{formats[item.format as keyof typeof formats] ?? item.format}</span>}
                {item.episodes && <span>{t(dict.episodeCount, { count: item.episodes })}</span>}
              </div>

              {item.genres.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.genres.slice(0, 3).map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full border border-white/5 bg-surface-2 px-2.5 py-0.5 text-[11px] text-text-muted"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {view === "follow" && (
                <div className="mt-1 space-y-2">
                  <p className="text-sm font-medium text-text-muted">
                    {t(dict.watchingEpisode, { value: item.progress })}
                    {item.episodes ? ` / ${item.episodes}` : ""}
                  </p>
                  {item.episodes && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                {view === "follow" ? (
                  <>
                    <a
                      href={`/anime/${item.id}`}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-cyan px-4 text-sm font-semibold text-obsidian transition hover:bg-cyan/90 sm:flex-none"
                    >
                      {dict.goToAnime}
                    </a>
                    <button
                      type="button"
                      onClick={increment}
                      disabled={isActing}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface-2 px-4 text-sm font-semibold text-text transition hover:bg-surface-2/80 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                    >
                      {isActing ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      )}
                      {dict.addOne}
                    </button>
                  </>
                ) : started ? (
                  <a
                    href={`/anime/${item.id}`}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-cyan px-4 text-sm font-semibold text-obsidian transition hover:bg-cyan/90 sm:flex-none"
                  >
                    {dict.goToAnime}
                  </a>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={startWatching}
                      disabled={isActing}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-violet px-4 text-sm font-semibold text-white transition hover:bg-violet/90 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                    >
                      {isActing ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Play className="h-4 w-4" aria-hidden="true" />
                      )}
                      {dict.startWatching}
                    </button>
                    <a
                      href={`/anime/${item.id}`}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-white/10 bg-surface-2 px-4 text-sm font-medium text-text transition hover:bg-surface-2/80 sm:flex-none"
                    >
                      {dict.viewDetail}
                    </a>
                  </>
                )}

                <button
                  type="button"
                  onClick={another}
                  disabled={isActing}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface-2 px-4 text-sm font-medium text-text transition hover:bg-surface-2/80 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                >
                  <Shuffle className="h-4 w-4" aria-hidden="true" />
                  {dict.another}
                </button>
              </div>

              {notice && <p className="text-xs text-text-dim">{notice}</p>}
            </div>
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">{notice ?? dict.noAnime}</p>
        </div>
      )}

      <button
        type="button"
        onClick={changeOption}
        className="text-xs font-medium text-text-dim underline underline-offset-4 transition hover:text-text-muted"
      >
        {dict.changeOption}
      </button>

      <Toast message={message} />
    </div>
  );
}
