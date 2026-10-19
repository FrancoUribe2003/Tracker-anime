export interface EpisodeInfo {
  episodes?: number | null;
  status?: string | null;
  nextAiringEpisode?: { episode?: number | null } | null;
}

const FALLBACK_MIN = 100;
const FALLBACK_STEP = 50;

export function getKnownTotal(info: EpisodeInfo): number | null {
  return typeof info.episodes === "number" && info.episodes > 0 ? info.episodes : null;
}

export function isAiring(info: EpisodeInfo): boolean {
  return info.status === "RELEASING" || info.nextAiringEpisode != null;
}

export function getMaxEpisode(info: EpisodeInfo, progress = 0): number {
  const total = getKnownTotal(info);
  if (total != null) return total;

  const next = info.nextAiringEpisode?.episode;
  if (typeof next === "number" && next > 1) return next - 1;

  const current = Number.isFinite(progress) ? Math.max(0, Math.round(progress)) : 0;
  const rounded = Math.ceil((current + FALLBACK_STEP) / FALLBACK_STEP) * FALLBACK_STEP;
  return Math.max(FALLBACK_MIN, rounded);
}
