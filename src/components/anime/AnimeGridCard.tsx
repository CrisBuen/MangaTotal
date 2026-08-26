"use client";

import Link from "next/link";

export interface AnimeCard {
  id: number;
  title: string;
  cover_url: string | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  score: number | null;
  year: number | null;
  genres: string[];
  is_adult: boolean;
}

export function AnimeGridCard({ anime }: { anime: AnimeCard }) {
  return (
    <Link
      href={`/anime/${anime.id}`}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
        {anime.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={anime.cover_url}
            alt={anime.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
            Sin portada
          </div>
        )}
        {anime.score !== null && (
          <span className="absolute right-3 top-3 rounded-full bg-[color-mix(in_oklch,var(--bg)_86%,transparent)] px-2 py-1 font-mono text-[10px] font-bold text-accent backdrop-blur-md">
            {anime.score}%
          </span>
        )}
      </div>
      <div className="px-1 pt-4">
        <h3 className="line-clamp-2 text-lg font-bold leading-[1.12] text-ink transition group-hover:text-accent">
          {anime.title}
        </h3>
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
          {[anime.format, anime.episodes ? `${anime.episodes} eps` : null, anime.year]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}
