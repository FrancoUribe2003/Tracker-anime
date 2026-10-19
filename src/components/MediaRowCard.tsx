import type { RowCard, UserStatus } from "../lib/list";

interface MediaRowCardProps {
  item: RowCard;
  status: UserStatus;
}

export default function MediaRowCard({ item, status }: MediaRowCardProps) {
  const percent =
    item.episodes && item.episodes > 0
      ? Math.min(Math.round((item.progress / item.episodes) * 100), 100)
      : null;

  const planningMeta = [
    item.year ? String(item.year) : null,
    item.episodes ? `${item.episodes} eps` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <a
      href={`/anime/${item.anilistId}`}
      className="group flex w-32 shrink-0 snap-start flex-col sm:w-36 md:w-40 lg:w-44"
      aria-label={item.title}
    >
      <div
        className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/5 shadow-lg shadow-black/30 transition-all duration-300 group-hover:scale-[1.03] group-hover:border-violet"
        style={{ backgroundColor: item.color || "#1E293B" }}
      >
        {item.coverImage && (
          <img
            src={item.coverImage}
            alt={item.title}
            loading="lazy"
            decoding="async"
            width={176}
            height={264}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <h3 className="mt-2 line-clamp-2 text-xs font-semibold leading-snug text-text transition-colors group-hover:text-violet">
        {item.title}
      </h3>

      {status === "COMPLETED" && item.score != null && item.score > 0 && (
        <p className="mt-0.5 text-[11px] font-semibold text-emerald">{item.score}/10</p>
      )}

      {status === "CURRENT" && (
        <div className="mt-1">
          <p className="text-[11px] text-text-muted">
            Ep. {item.progress}
            {item.episodes ? ` / ${item.episodes}` : ""}
          </p>
          {percent !== null && (
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-cyan" style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
      )}

      {status === "PLANNING" && planningMeta && (
        <p className="mt-0.5 truncate text-[11px] text-text-muted">{planningMeta}</p>
      )}
    </a>
  );
}
