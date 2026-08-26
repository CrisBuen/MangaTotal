import Link from "next/link";

export interface SeriesSummary {
  id: number;
  title: string;
  slug: string;
  type: string;
  cover_image_path: string | null;
  status?: string;
  chapter_count?: number;
  is_favorite?: boolean;
}

export function SeriesCard({ series }: { series: SeriesSummary }) {
  return (
    <Link
      href={`/serie/${series.slug}`}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
      data-od-id={`series-card-${series.slug}`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
        {series.cover_image_path ? (
          // portada generada con sharp; las páginas reales nunca se recomprimen
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/images/${series.cover_image_path}`}
            alt={series.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">Sin portada</div>
        )}
        {series.type === "adult" && (
          <span className="absolute left-3 top-3 rounded-full border border-danger bg-[color-mix(in_oklch,var(--bg)_82%,transparent)] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-danger backdrop-blur-md">
            +18
          </span>
        )}
        {series.is_favorite && (
          <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-[color-mix(in_oklch,var(--bg)_82%,transparent)] text-accent shadow-[var(--glow)] ring-1 ring-accent backdrop-blur-md" aria-label="Favorita">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="m12 2.8 2.76 5.6 6.18.9-4.47 4.36 1.06 6.15L12 16.9l-5.53 2.91 1.06-6.15L3.06 9.3l6.18-.9L12 2.8Z" /></svg>
          </span>
        )}
      </div>
      <div className="px-1 pt-4">
        <h3 className="line-clamp-2 text-lg font-bold leading-[1.12] text-ink transition group-hover:text-accent">{series.title}</h3>
        {series.chapter_count !== undefined && (
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
            {series.chapter_count} capítulo{series.chapter_count === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </Link>
  );
}
