import React from "react";

interface ViendoCardProps {
  title: string;
  href: string;
  coverImage?: string | null;
  color?: string | null;
  badge?: string | null;
  badgeTone?: "emerald" | "violet" | "cyan";
  children?: React.ReactNode;
}

const BADGE_TONE: Record<string, string> = {
  emerald: "text-emerald border-emerald/30",
  violet: "text-violet border-violet/30",
  cyan: "text-cyan border-cyan/30",
};

const DOT_TONE: Record<string, string> = {
  emerald: "bg-emerald",
  violet: "bg-violet",
  cyan: "bg-cyan",
};

export default function ViendoCard({
  title,
  href,
  coverImage,
  color,
  badge = "Viendo",
  badgeTone = "cyan",
  children,
}: ViendoCardProps) {
  return (
    <div className="group relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-xl border border-white/5 shadow-lg shadow-black/30 transition-all duration-300 hover:border-violet sm:rounded-2xl">
      <div
        className="absolute inset-0 h-full w-full"
        style={{ backgroundColor: color || "#1E293B" }}
      >
        {coverImage && (
          <img
            src={coverImage}
            alt={title}
            loading="lazy"
            decoding="async"
            width={300}
            height={450}
            className="h-full w-full object-cover object-center transition-opacity group-hover:opacity-90"
          />
        )}
      </div>

      <a href={href} className="absolute inset-0 z-20" aria-label={title}></a>

      <div className="relative z-10 flex justify-end p-2 sm:p-3">
        {badge && (
          <span
            className={`inline-flex items-center gap-1 rounded-full border bg-obsidian/60 px-2 py-0.5 text-[10px] font-semibold shadow-md backdrop-blur-md sm:text-[11px] ${BADGE_TONE[badgeTone]}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${DOT_TONE[badgeTone]}`}></span>
            {badge}
          </span>
        )}
      </div>

      <div className="pointer-events-none relative z-30 flex flex-col justify-end gap-2 bg-gradient-to-t from-obsidian via-obsidian/85 to-transparent p-2.5 pt-12 sm:p-3.5">
        <h3
          className="line-clamp-2 text-xs font-semibold leading-snug text-text transition-colors group-hover:text-violet sm:text-sm"
          title={title}
        >
          {title}
        </h3>
        <div className="pointer-events-auto relative z-30">{children}</div>
      </div>
    </div>
  );
}
