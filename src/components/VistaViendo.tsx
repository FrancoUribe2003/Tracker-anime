import { useEffect, useRef, useState } from "react";
import ProgressControl from "./ProgressControl";
import ViendoCard from "./ViendoCard";

export interface ViendoItem {
  anilistId: number;
  progress: number;
  episodes: number | null;
  status: string | null;
  nextAiringEpisode: number | null;
  updatedAt: string;
  title: string;
  coverImage: string | null;
  color: string | null;
  bannerImage: string | null;
}

interface VistaViendoProps {
  items: ViendoItem[];
}

function sortItems(list: ViendoItem[]): ViendoItem[] {
  return [...list].sort((a, b) => {
    const timeA = new Date(a.updatedAt).getTime();
    const timeB = new Date(b.updatedAt).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return b.anilistId - a.anilistId;
  });
}

export default function VistaViendo({ items: initialItems }: VistaViendoProps) {
  const [items, setItems] = useState(() => sortItems(initialItems));

  const itemsRef = useRef(items);
  const snapshotRef = useRef(items);
  const pendingRef = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  function handleProgressChange(id: number, next: number) {
    if (!pendingRef.current) {
      snapshotRef.current = itemsRef.current;
      pendingRef.current = true;
    }
    const now = new Date().toISOString();
    setItems((prev) =>
      sortItems(
        prev.map((item) =>
          item.anilistId === id ? { ...item, progress: next, updatedAt: now } : item
        )
      )
    );
  }

  function handleSaveSuccess() {
    pendingRef.current = false;
  }

  function handleSaveError() {
    setItems(snapshotRef.current);
    pendingRef.current = false;
  }

  function handleCompleted(id: number) {
    pendingRef.current = false;
    setItems((prev) => prev.filter((item) => item.anilistId !== id));
  }

  const [principal, ...rest] = items;

  return (
    <div className="space-y-8">
      {items.length === 0 ? (
        <section className="mx-auto mt-8 max-w-xl rounded-2xl border border-white/5 bg-surface p-8 text-center shadow-xl sm:p-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/5 bg-surface-2 text-cyan">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-text">No tienes animes en curso</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
            Agrega series que estés viendo con el buscador para trackear tus episodios y tu progreso diario.
          </p>
          <p className="mt-6 text-xs text-text-dim">
            Usa el buscador de la barra superior y elige el estado &ldquo;Viendo&rdquo;.
          </p>
        </section>
      ) : (
        <>
          {principal && (
            <section
              key={principal.anilistId}
              className="animate-fade-in relative overflow-hidden rounded-2xl border border-white/5 bg-surface shadow-xl"
            >
              <div className="absolute inset-0" aria-hidden="true">
                {principal.bannerImage || principal.coverImage ? (
                  <img
                    src={principal.bannerImage || principal.coverImage || ""}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={1920}
                    height={1080}
                    className="h-full w-full scale-105 object-cover opacity-40 blur-sm"
                  />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{ backgroundColor: principal.color || "#1E293B" }}
                  ></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/85 to-obsidian/40"></div>
              </div>

              <div className="relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:p-7">
                <a
                  href={`/anime/${principal.anilistId}`}
                  className="w-28 shrink-0 sm:w-36"
                  aria-label={principal.title}
                >
                  <div
                    className="aspect-[2/3] overflow-hidden rounded-xl border border-white/10 transition-colors hover:border-violet"
                    style={{ backgroundColor: principal.color || "#1E293B" }}
                  >
                    {principal.coverImage && (
                      <img
                        src={principal.coverImage}
                        alt={principal.title}
                        loading="lazy"
                        decoding="async"
                        width={288}
                        height={432}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                </a>

                <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan"></span>
                    Continuar viendo
                  </span>
                  <a href={`/anime/${principal.anilistId}`} className="w-fit">
                    <h2 className="line-clamp-2 text-xl font-bold tracking-tight text-text transition-colors hover:text-violet sm:text-2xl">
                      {principal.title}
                    </h2>
                  </a>
                  <div className="mt-1 max-w-md">
                    <ProgressControl
                      anilistId={principal.anilistId}
                      progress={principal.progress}
                      episodes={principal.episodes}
                      status={principal.status}
                      nextAiringEpisode={principal.nextAiringEpisode}
                      variant="full"
                      onProgressChange={(next) => handleProgressChange(principal.anilistId, next)}
                      onStatusChange={() => handleCompleted(principal.anilistId)}
                      onSaveSuccess={handleSaveSuccess}
                      onSaveError={handleSaveError}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
                En progreso
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {rest.map((item) => (
                  <ViendoCard
                    key={item.anilistId}
                    title={item.title}
                    href={`/anime/${item.anilistId}`}
                    coverImage={item.coverImage}
                    color={item.color}
                    badge="Viendo"
                    badgeTone="cyan"
                  >
                    <ProgressControl
                      anilistId={item.anilistId}
                      progress={item.progress}
                      episodes={item.episodes}
                      status={item.status}
                      nextAiringEpisode={item.nextAiringEpisode}
                      variant="mini"
                      onProgressChange={(next) => handleProgressChange(item.anilistId, next)}
                      onStatusChange={() => handleCompleted(item.anilistId)}
                      onSaveSuccess={handleSaveSuccess}
                      onSaveError={handleSaveError}
                    />
                  </ViendoCard>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
