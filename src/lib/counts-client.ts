import type { UserCounts } from "./counts";

export const COUNTS_CHANGED_EVENT = "counts:changed";

export function emitCounts(counts: Partial<UserCounts>): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Partial<UserCounts>>(COUNTS_CHANGED_EVENT, { detail: counts }));
}

export async function refreshCounts(): Promise<UserCounts | null> {
  if (typeof window === "undefined") return null;
  try {
    const response = await fetch("/api/counts");
    if (!response.ok) return null;
    const counts = (await response.json()) as UserCounts;
    emitCounts(counts);
    return counts;
  } catch {
    return null;
  }
}

export function syncCountsFromResponse(data: unknown): void {
  const counts = (data as { counts?: Partial<UserCounts> } | null | undefined)?.counts;
  if (counts && typeof counts === "object") {
    emitCounts(counts);
  } else {
    void refreshCounts();
  }
}
