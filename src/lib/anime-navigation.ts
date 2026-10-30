const storagePrefix = "anime-navigation:";
const tokens = new Map<string, string>();
let installed = false;

function isAnimeIds(ids: unknown): ids is number[] {
  return Array.isArray(ids) &&
    ids.every((id) => Number.isSafeInteger(id) && id > 0) &&
    new Set(ids).size === ids.length;
}

function isReturnTo(returnTo: unknown): returnTo is string {
  return typeof returnTo === "string" &&
    /^\/(?:completados|viendo|pendientes)\/?(?:\?[^#\s\\]*)?$/.test(returnTo);
}

export function getAnimeNavigation(token: string, userId: string, animeId: number) {
  if (!token || !userId) return null;
  try {
    const snapshot = JSON.parse(sessionStorage.getItem(storagePrefix + token) ?? "null");
    if (!snapshot || snapshot.userId !== userId ||
        !isAnimeIds(snapshot.ids) || !isReturnTo(snapshot.returnTo)) return null;

    const index = snapshot.ids.indexOf(animeId);
    if (index === -1) return null;
    return {
      token,
      userId,
      ids: snapshot.ids,
      returnTo: snapshot.returnTo,
      previousId: snapshot.ids[index - 1] ?? null,
      nextId: snapshot.ids[index + 1] ?? null,
    };
  } catch {
    return null;
  }
}

export function installAnimeListNavigation(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;

  const prepareLink = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
    const root = anchor?.closest("[data-anime-list]");
    if (!anchor || !root) return;

    try {
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin || !/^\/anime\/\d+\/?$/.test(url.pathname)) return;

      // A recycled anchor must not retain a previous group's context on failure.
      url.searchParams.delete("recorrido");
      anchor.href = url.href;
      const ids: unknown = JSON.parse(root.getAttribute("data-anime-list") ?? "null");
      const userId = root.closest("[data-anime-user]")?.getAttribute("data-anime-user");
      const returnTo = root.closest("[data-anime-return]")?.getAttribute("data-anime-return");
      const animeId = Number(url.pathname.split("/")[2]);
      if (!userId || !isAnimeIds(ids) || !ids.includes(animeId) || !isReturnTo(returnTo)) return;

      const snapshot = JSON.stringify({ userId, ids: [...ids], returnTo });
      const cacheKey = JSON.stringify([userId, returnTo, ids]);
      let token = tokens.get(cacheKey);
      if (!token || sessionStorage.getItem(storagePrefix + token) !== snapshot) {
        token = crypto.randomUUID();
        sessionStorage.setItem(storagePrefix + token, snapshot);
        tokens.set(cacheKey, token);
      }
      url.searchParams.set("recorrido", token);
      anchor.href = url.href;
    } catch {
      // Storage denial or invalid source data leaves ordinary navigation intact.
    }
  };

  for (const type of ["pointerdown", "click", "contextmenu", "focusin"]) {
    document.addEventListener(type, prepareLink, true);
  }
}
