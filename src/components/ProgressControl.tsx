import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Plus } from "lucide-react";
import { Toast, useToast } from "./Toast";
import type { UserCounts } from "../lib/counts";
import { syncCountsFromResponse } from "../lib/counts-client";
import { getKnownTotal, getMaxEpisode, isAiring } from "../lib/episodes";
import { apiErrorMessage } from "../lib/api-errors";
import { t, type Dictionary } from "../i18n";

interface ProgressControlProps {
  anilistId: number;
  progress: number;
  episodes?: number | null;
  status?: string | null;
  nextAiringEpisode?: number | null;
  completed?: boolean;
  variant?: "full" | "mini";
  dict: Dictionary["progress"];
  errors: Dictionary["errors"];
  onProgressChange?: (progress: number) => void;
  onStatusChange?: (status: string) => void;
  onSaveSuccess?: () => void;
  onSaveError?: () => void;
  className?: string;
}

interface ProgressResponse {
  status?: string;
  progress?: number;
  counts?: Partial<UserCounts>;
  error?: string;
}

const SAVE_DEBOUNCE_MS = 400;

export default function ProgressControl({
  anilistId,
  progress,
  episodes = null,
  status = null,
  nextAiringEpisode = null,
  completed = false,
  variant = "full",
  dict,
  errors,
  onProgressChange,
  onStatusChange,
  onSaveSuccess,
  onSaveError,
  className = "",
}: ProgressControlProps) {
  const info = { episodes, status, nextAiringEpisode: nextAiringEpisode != null ? { episode: nextAiringEpisode } : null };
  const knownTotal = getKnownTotal(info);
  const airing = isAiring(info);
  const finished = status === "FINISHED";
  const max = getMaxEpisode(info, progress);

  const clampValue = useCallback(
    (input: number): number => {
      let next = Math.round(input);
      if (!Number.isFinite(next)) next = 0;
      if (next < 0) next = 0;
      if (next > max) next = max;
      return next;
    },
    [max]
  );

  const initial = clampValue(progress);
  const [value, setValue] = useState(initial);
  const [isSaving, setIsSaving] = useState(false);
  const { message, showToast } = useToast();

  const valueRef = useRef(initial);
  const committedRef = useRef(initial);
  const pendingRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);

  const setValueSync = useCallback((next: number) => {
    valueRef.current = next;
    setValue(next);
  }, []);

  const flush = useCallback(async () => {
    const target = pendingRef.current;
    if (target == null) return;
    pendingRef.current = null;

    const requestId = ++requestIdRef.current;
    setIsSaving(true);

    try {
      const response = await fetch("/api/list/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anilistId, progress: target }),
      });
      const data: ProgressResponse = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(apiErrorMessage(data.error, dict.saveError, errors));
      if (requestId !== requestIdRef.current) return;

      if (typeof data.progress === "number") {
        committedRef.current = data.progress;
        setValueSync(data.progress);
        onProgressChange?.(data.progress);
      } else {
        committedRef.current = target;
        onProgressChange?.(target);
      }

      onSaveSuccess?.();
      syncCountsFromResponse(data);

      if (data.status === "COMPLETED") {
        onStatusChange?.("COMPLETED");
        showToast(dict.markedCompleted);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setValueSync(committedRef.current);
      onProgressChange?.(committedRef.current);
      onSaveError?.();
      showToast(err instanceof Error ? err.message : dict.saveError);
    } finally {
      if (requestId === requestIdRef.current) setIsSaving(false);
    }
  }, [anilistId, dict, errors, onProgressChange, onSaveError, onSaveSuccess, onStatusChange, setValueSync, showToast]);

  const scheduleSave = useCallback(
    (next: number) => {
      pendingRef.current = next;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, SAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingRef.current != null) void flush();
    };
  }, [flush]);

  const lastExternalRef = useRef(progress);

  useEffect(() => {
    if (progress === lastExternalRef.current) return;
    lastExternalRef.current = progress;
    if (pendingRef.current !== null) return;

    const clamped = clampValue(progress);
    if (clamped === valueRef.current) return;

    valueRef.current = clamped;
    committedRef.current = clamped;
    setValue(clamped);
  }, [progress, clampValue]);

  const commit = useCallback(
    (next: number) => {
      const clamped = clampValue(next);
      setValueSync(clamped);
      onProgressChange?.(clamped);
      scheduleSave(clamped);
    },
    [clampValue, onProgressChange, scheduleSave, setValueSync]
  );

  const handleSliderInput = (event: React.InputEvent<HTMLInputElement>) => {
    setValueSync(clampValue(Number(event.currentTarget.value)));
  };

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    commit(Number(event.target.value));
  };

  const complete = async () => {
    if (isSaving || completed) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = null;

    const requestId = ++requestIdRef.current;
    const prevValue = valueRef.current;
    const target = airing ? valueRef.current : knownTotal ?? valueRef.current;

    setIsSaving(true);
    setValueSync(target);
    onProgressChange?.(target);

    try {
      const response = await fetch("/api/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anilistId, status: "COMPLETED", progress: target }),
      });
      const data: ProgressResponse = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(apiErrorMessage(data.error, dict.completeError, errors));
      if (requestId !== requestIdRef.current) return;

      if (typeof data.progress === "number") {
        committedRef.current = data.progress;
        setValueSync(data.progress);
        onProgressChange?.(data.progress);
      } else {
        committedRef.current = target;
      }

      showToast(dict.markedCompleted);
      onStatusChange?.("COMPLETED");
      onSaveSuccess?.();
      syncCountsFromResponse(data);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setValueSync(prevValue);
      onProgressChange?.(prevValue);
      onSaveError?.();
      showToast(err instanceof Error ? err.message : dict.completeError);
    } finally {
      if (requestId === requestIdRef.current) setIsSaving(false);
    }
  };

  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const label = t(airing ? dict.labelAiring : dict.label, { value, max });
  const atMax = value >= max;
  const isCompleted = completed || (finished && knownTotal != null && value >= knownTotal);

  if (variant === "mini") {
    return (
      <button
        type="button"
        onClick={() => commit(valueRef.current + 1)}
        disabled={isSaving || atMax}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-cyan/30 bg-cyan/15 px-3 text-xs font-semibold text-cyan transition hover:bg-cyan/25 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={atMax ? dict.completed : dict.addOneAria}
      >
        {isSaving ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span>{atMax ? dict.completed : dict.addOneShort}</span>
      </button>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-text-muted">{label}</span>
        <span className="flex items-center gap-2 text-text-dim">
          {isSaving && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-violet" aria-hidden="true" />}
          <span>{percent}%</span>
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onInput={handleSliderInput}
        onChange={handleSliderChange}
        aria-label={dict.aria}
        className="progress-slider block w-full"
        style={{ "--pct": `${percent}%` } as React.CSSProperties}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => commit(valueRef.current + 1)}
          disabled={isSaving || atMax}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-cyan px-4 text-sm font-semibold text-obsidian transition hover:bg-cyan/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{dict.addOne}</span>
        </button>
        <button
          type="button"
          onClick={complete}
          disabled={isSaving || isCompleted}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface-2 px-4 text-sm font-medium text-text transition hover:bg-surface-2/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          <span>{isCompleted ? dict.completed : dict.markCompleted}</span>
        </button>
      </div>

      <Toast message={message} />
    </div>
  );
}
