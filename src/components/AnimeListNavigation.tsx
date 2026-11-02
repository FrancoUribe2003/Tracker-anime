import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Locale } from "../i18n";
import { getAnimeNavigation } from "../lib/anime-navigation";

interface AnimeListNavigationProps {
  animeId: number;
  userId: string;
  locale: Locale;
}

const arrowClass = "pointer-events-auto absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-obsidian/60 text-text-muted backdrop-blur-md transition hover:border-violet/50 hover:text-violet focus:outline-none focus:ring-2 focus:ring-violet";

export default function AnimeListNavigation({ animeId, userId, locale }: AnimeListNavigationProps) {
  const [navigation, setNavigation] = useState<ReturnType<typeof getAnimeNavigation>>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("recorrido");
    setNavigation(token ? getAnimeNavigation(token, userId, animeId) : null);
  }, [animeId, userId]);

  if (!navigation || (navigation.previousId === null && navigation.nextId === null)) return null;
  const token = encodeURIComponent(navigation.token);

  return (
    <nav
      aria-label={locale === "es" ? "Navegación de animes" : "Anime navigation"}
      className="pointer-events-none absolute inset-0 z-20"
    >
      {navigation.previousId !== null && (
        <a
          href={`/anime/${navigation.previousId}?recorrido=${token}`}
          aria-label={locale === "es" ? "Anterior" : "Previous"}
          className={`${arrowClass} left-2 sm:left-3`}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </a>
      )}
      {navigation.nextId !== null && (
        <a
          href={`/anime/${navigation.nextId}?recorrido=${token}`}
          aria-label={locale === "es" ? "Siguiente" : "Next"}
          className={`${arrowClass} right-2 sm:right-3`}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </a>
      )}
    </nav>
  );
}
