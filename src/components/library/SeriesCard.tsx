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
      className="group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
      data-od-id={`series-card-${series.slug}`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] transition-colors group-hover:border-line-strong">
        {series.cover_image_path ? (
          // portada generada con sharp; las páginas reales nunca se recomprimen
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/images/${series.cover_image_path}`}
            alt={series.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center font-mono text-[13px] text-faint">Sin portada</div>
        )}
        {series.type === "adult" && (
          <span className="absolute left-3 top-3 rounded-md border border-danger bg-[color-mix(in_oklch,var(--bg)_92%,transparent)] px-2.5 py-1 font-mono text-[11px] font-medium text-danger">
            +18
          </span>
        )}
        {series.is_favorite && (
          <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-accent bg-[color-mix(in_oklch,var(--bg)_92%,transparent)] text-accent-ink" aria-label="Favorita">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="m12 2.8 2.76 5.6 6.18.9-4.47 4.36 1.06 6.15L12 16.9l-5.53 2.91 1.06-6.15L3.06 9.3l6.18-.9L12 2.8Z" /></svg>
          </span>
        )}
      </div>
      <div className="px-1 pt-3">
        <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">{series.title}</h3>
        {series.chapter_count !== undefined && (
          <p className="mt-1 font-mono text-[13px] text-faint">
            {series.chapter_count} capítulo{series.chapter_count === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </Link>
  );
}
