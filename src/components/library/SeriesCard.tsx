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
      className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:border-violet-600"
    >
      <div className="relative aspect-[2/3] bg-zinc-800">
        {series.cover_image_path ? (
          // portada generada con sharp; las páginas reales nunca se recomprimen
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/images/${series.cover_image_path}`}
            alt={series.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-zinc-600">📖</div>
        )}
        {series.type === "adult" && (
          <span className="absolute left-2 top-2 rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
            +18
          </span>
        )}
        {series.is_favorite && (
          <span className="absolute right-2 top-2 text-lg drop-shadow">★</span>
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-medium text-zinc-100">{series.title}</p>
        {series.chapter_count !== undefined && (
          <p className="text-xs text-zinc-500">
            {series.chapter_count} capítulo{series.chapter_count === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </Link>
  );
}
