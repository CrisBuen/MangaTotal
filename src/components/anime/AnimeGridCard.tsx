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
      className="group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[var(--surface-raised)] border border-line transition-colors group-hover:border-line-strong">
        {anime.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={anime.cover_url}
            alt={anime.title}
            className="h-full w-full object-cover transition duration-500"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">
            Sin portada
          </div>
        )}
        {anime.score !== null && (
          <span className="absolute right-3 top-3 rounded-full bg-[color-mix(in_oklch,var(--bg)_86%,transparent)] px-2 py-1 font-mono text-[11px] font-bold text-accent-ink ">
            {anime.score}%
          </span>
        )}
      </div>
      <div className="px-1 pt-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
          {anime.title}
        </h3>
        <p className="mt-1 font-mono text-[13px] text-faint">
          {[anime.format, anime.episodes ? `${anime.episodes} eps` : null, anime.year]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}
