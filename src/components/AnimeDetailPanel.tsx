import { useState } from "react";
import { LoaderCircle, Star, Trash2, X } from "lucide-react";
import ProgressControl from "./ProgressControl";
import type { UserCounts } from "../lib/counts";
import { syncCountsFromResponse } from "../lib/counts-client";
import { apiErrorMessage } from "../lib/api-errors";
import { t, type Dictionary } from "../i18n";

interface AnimeDetailPanelProps {
  anilistId: number;
  initialStatus: string | null;
  initialProgress: number;
  initialScore: number | null;
  initialTopPosition?: number | null;
  episodes?: number | null;
  animeStatus?: string | null;
  nextAiringEpisode?: number | null;
  dict: Dictionary["detail"];
  statusDict: Dictionary["status"];
  progressDict: Dictionary["progress"];
  errors: Dictionary["errors"];
}

const STATUS_OPTIONS = [
  { value: "CURRENT", activeClass: "bg-cyan/15 text-cyan border-cyan/40" },
  { value: "PLANNING", activeClass: "bg-violet/15 text-violet border-violet/40" },
  { value: "COMPLETED", activeClass: "bg-emerald/15 text-emerald border-emerald/40" },
] as const;

interface ApiResponse {
  success?: boolean;
  status?: string;
  progress?: number;
  score?: number | null;
  position?: number;
  counts?: Partial<UserCounts>;
  error?: string;
}

export default function AnimeDetailPanel({
  anilistId,
  initialStatus,
  initialProgress,
  initialScore,
  initialTopPosition = null,
  episodes = null,
  animeStatus = null,
  nextAiringEpisode = null,
  dict,
  statusDict,
  progressDict,
  errors,
}: AnimeDetailPanelProps) {
  const statusLabels: Record<string, string> = {
    CURRENT: statusDict.current,
    PLANNING: statusDict.planning,
    COMPLETED: statusDict.completed,
  };

  const [status, setStatus] = useState<string | null>(initialStatus);
  const [progress, setProgress] = useState(initialProgress);
  const [score, setScore] = useState<number | null>(initialScore);
  const [topPosition, setTopPosition] = useState<number | null>(initialTopPosition);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(url: string, method: string, body: unknown): Promise<ApiResponse> {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: ApiResponse = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(apiErrorMessage(data.error, dict.errorUpdate, errors));
    }
    return data;
  }

  async function changeStatus(nextStatus: string) {
    if (isPending) return;

    const prevStatus = status;
    const prevProgress = progress;
    const nextProgress = nextStatus === "PLANNING" ? 0 : prevProgress;

    setError(null);
    setIsPending(true);
    setStatus(nextStatus);
    setProgress(nextProgress);
    if (nextStatus !== "COMPLETED") setTopPosition(null);

    try {
      const data = await request("/api/list", "POST", {
        anilistId,
        status: nextStatus,
        progress: nextProgress,
        score,
      });
      if (typeof data.progress === "number") setProgress(data.progress);
      syncCountsFromResponse(data);
    } catch (err) {
      setStatus(prevStatus);
      setProgress(prevProgress);
      setError(err instanceof Error ? err.message : dict.errorUpdate);
    } finally {
      setIsPending(false);
    }
  }

  async function updateScore(value: number) {
    if (isPending) return;

    const prevScore = score;
    const nextScore = value === 0 ? null : value;

    setError(null);
    setIsPending(true);
    setScore(nextScore);

    try {
      if (status) {
        const data = await request("/api/list/progress", "PATCH", { anilistId, score: nextScore });
        syncCountsFromResponse(data);
      } else {
        const data = await request("/api/list", "POST", {
          anilistId,
          status: "CURRENT",
          progress,
          score: nextScore,
        });
        setStatus("CURRENT");
        syncCountsFromResponse(data);
      }
    } catch (err) {
      setScore(prevScore);
      setError(err instanceof Error ? err.message : dict.errorScore);
    } finally {
      setIsPending(false);
    }
  }

  async function remove() {
    if (isPending) return;

    const prevStatus = status;
    const prevProgress = progress;
    const prevScore = score;
    const prevTopPosition = topPosition;

    setError(null);
    setIsPending(true);
    setStatus(null);
    setProgress(0);
    setScore(null);
    setTopPosition(null);

    try {
      const data = await request("/api/list", "DELETE", { anilistId });
      syncCountsFromResponse(data);
    } catch (err) {
      setStatus(prevStatus);
      setProgress(prevProgress);
      setScore(prevScore);
      setTopPosition(prevTopPosition);
      setError(err instanceof Error ? err.message : dict.errorRemove);
    } finally {
      setIsPending(false);
    }
  }

  async function addToTop() {
    if (isPending) return;

    setError(null);
    setIsPending(true);

    try {
      const data = await request("/api/top", "POST", { anilistId });
      if (typeof data.position === "number") setTopPosition(data.position);
      syncCountsFromResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.errorAddTop);
    } finally {
      setIsPending(false);
    }
  }

  async function removeFromTop() {
    if (isPending) return;

    const prevTopPosition = topPosition;

    setError(null);
    setIsPending(true);
    setTopPosition(null);

    try {
      const data = await request("/api/top", "DELETE", { anilistId });
      syncCountsFromResponse(data);
    } catch (err) {
      setTopPosition(prevTopPosition);
      setError(err instanceof Error ? err.message : dict.errorRemoveTop);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/5 bg-surface p-4 shadow-xl sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">{dict.myList}</h2>
        {isPending && <LoaderCircle className="h-4 w-4 animate-spin text-violet" />}
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 no-scrollbar" role="group" aria-label={dict.statusAria}>
        {STATUS_OPTIONS.map((option) => {
          const isActive = status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => changeStatus(option.value)}
              disabled={isPending}
              aria-pressed={isActive}
              className={`inline-flex min-h-[44px] flex-1 shrink-0 items-center justify-center rounded-xl border px-3.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isActive
                  ? option.activeClass
                  : "border-white/5 bg-surface-2 text-text-muted hover:text-text"
              }`}
            >
              {statusLabels[option.value]}
            </button>
          );
        })}
      </div>

      {status ? (
        <div className="mt-4 space-y-4">
          <ProgressControl
            anilistId={anilistId}
            progress={progress}
            episodes={episodes}
            status={animeStatus}
            nextAiringEpisode={nextAiringEpisode}
            completed={status === "COMPLETED"}
            dict={progressDict}
            errors={errors}
            onStatusChange={setStatus}
            onProgressChange={setProgress}
          />

          <div className="flex flex-col gap-2 border-t border-white/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-xs font-medium text-text-muted">
              {dict.scoreLabel}
              <select
                value={score ?? 0}
                onChange={(e) => updateScore(Number(e.target.value))}
                disabled={isPending}
                className="min-h-[44px] cursor-pointer rounded-lg border border-white/10 bg-surface-2 px-2.5 text-sm text-text outline-none transition focus:ring-2 focus:ring-violet disabled:opacity-60 sm:min-h-0 sm:py-1.5"
              >
                <option value={0}>{dict.noScore}</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={remove}
              disabled={isPending}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/5 px-3.5 text-xs font-medium text-amber transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{dict.removeFromList}</span>
            </button>
          </div>

          {status === "COMPLETED" && (
            <div className="border-t border-white/5 pt-4">
              {topPosition == null ? (
                <button
                  type="button"
                  onClick={addToTop}
                  disabled={isPending}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-violet/30 bg-violet/10 px-3.5 text-xs font-semibold text-violet transition hover:bg-violet/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  <Star className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{dict.addToTop}</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-amber">
                    <Star className="h-3.5 w-3.5" aria-hidden="true" />
                    {t(dict.inTop, { position: topPosition })}
                  </span>
                  <button
                    type="button"
                    onClick={removeFromTop}
                    disabled={isPending}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/5 px-3.5 text-xs font-medium text-text-muted transition hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{dict.removeFromTop}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-xs text-text-dim">
          {dict.emptyHint}
        </p>
      )}

      {error && <p className="mt-3 text-xs text-amber">{error}</p>}
    </section>
  );
}
