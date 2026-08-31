import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FavoriteButton } from "@/components/library/FavoriteButton";
import { buttonStyles } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/Feedback";

const STATUS_LABEL: Record<string, string> = {
  ongoing: "En curso",
  completed: "Completada",
  dropped: "Abandonada",
};

const obtenerSerieSeo = unstable_cache(
  async (slug: string) =>
    db.series.findFirst({
      where: { slug, type: "normal" },
      select: {
        title: true,
        slug: true,
        description: true,
        coverImagePath: true,
      },
    }),
  ["serie-seo"],
  { revalidate: 3600 }
);

function descripcionSeo(titulo: string, descripcion: string | null): string {
  const texto = (descripcion ?? "Lee " + titulo + " online en MangaTotal.")
    .replace(/\s+/g, " ")
    .trim();
  return texto.length > 160 ? texto.slice(0, 157).trimEnd() + "…" : texto;
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const serie = await obtenerSerieSeo(slug);

  if (!serie) {
    return {
      title: "Serie no disponible",
      robots: { index: false, follow: false },
    };
  }

  const description = descripcionSeo(serie.title, serie.description);
  const canonical = "/serie/" + serie.slug;

  return {
    title: serie.title + " — Leer online",
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      locale: "es_CL",
      siteName: "MangaTotal",
      title: serie.title + " | MangaTotal",
      description,
      url: canonical,
      images: serie.coverImagePath
        ? [{ url: "/api/images/" + serie.coverImagePath, alt: serie.title }]
        : undefined,
    },
  };
}

export default async function SeriePage(props: { params: Promise<{ slug: string }> }) {
  // visible también como visitante: sin progreso ni favoritos
  const user = await getSessionUser();
  const userId = user?.id ?? -1;

  const { slug } = await props.params;
  const series = await db.series.findUnique({
    where: { slug },
    include: {
      chapters: {
        orderBy: { number: "asc" },
        include: { progress: { where: { userId } } },
      },
      favorites: { where: { userId } },
      progress: { where: { userId }, include: { chapter: true } },
      tags: { orderBy: { name: "asc" } },
    },
  });

  if (!series) notFound();
  if (series.type === "adult" && !user?.showAdultContent && !user?.isAdmin) notFound();

  const bookmark = series.progress[0] ?? null;

  return (
    <div className="space-y-12" data-od-id="series-detail-page">
      <section className="grid gap-7 border-b-2 border-line pb-10 md:grid-cols-[minmax(220px,28%)_1fr]" data-od-id="series-hero">
        <div className="w-full max-w-xs overflow-hidden rounded-2xl border border-accent bg-[var(--surface-raised)] shadow-[var(--glow)]">
          <div className="aspect-[2/3]">
            {series.coverImagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/images/${series.coverImagePath}`}
                alt={series.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
                Sin portada
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 self-end">
          <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">
            {STATUS_LABEL[series.status] ?? series.status} · {series.chapters.length} capítulo{series.chapters.length === 1 ? "" : "s"}
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h1 className="max-w-4xl font-display text-5xl font-black uppercase leading-[0.92] tracking-[-0.055em] text-ink sm:text-6xl lg:text-7xl">{series.title}</h1>
            {series.type === "adult" && (
              <Badge tone="danger">+18</Badge>
            )}
          </div>
          {series.originalTitle && (
            <p className="mb-5 text-sm text-subtle">{series.originalTitle}</p>
          )}
          {series.tags.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {series.tags.map((t) => (
                <Link
                  key={t.id}
                  href={`/biblioteca?tag=${encodeURIComponent(t.slug)}`}
                  className="min-h-9 rounded-full border border-line bg-panel px-3 py-2 text-xs text-subtle transition hover:border-accent hover:bg-[var(--accent-soft)] hover:text-accent"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          )}
          {series.description && (
            <p className="mb-6 max-w-3xl whitespace-pre-line text-sm leading-6 text-subtle">{series.description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {bookmark && (
              <Link
                href={`/leer/${bookmark.chapterId}?page=${bookmark.lastPageNumber}`}
                className={buttonStyles({ variant: "primary" })}
                data-od-id="continue-reading-button"
              >
                Continuar — Cap. {bookmark.chapter.number}, pág. {bookmark.lastPageNumber}
              </Link>
            )}
            {!bookmark && series.chapters.length > 0 && (
              <Link
                href={`/leer/${series.chapters[0].id}`}
                className={buttonStyles({ variant: "primary" })}
                data-od-id="start-reading-button"
              >
                Empezar a leer
              </Link>
            )}
            {user ? (
              <FavoriteButton seriesId={series.id} initialFavorite={series.favorites.length > 0} />
            ) : (
              <Link
                href="/login"
                className={buttonStyles({ variant: "secondary" })}
              >
                Iniciá sesión para leer y guardar progreso
              </Link>
            )}
          </div>
        </div>
      </section>

      <section data-od-id="chapter-list">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="text-4xl text-ink">Capítulos</h2>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">Orden ascendente</span>
        </div>
        {series.chapters.length === 0 ? (
          <EmptyState title="Todavía no hay capítulos" description="Esta serie aún no tiene archivos publicados." />
        ) : (
          <ul className="border-b-2 border-line bg-panel">
            {series.chapters.map((c) => {
              const prog = c.progress[0];
              const done = prog && prog.lastPageNumber >= c.pageCount;
              return (
                <li key={c.id}>
                  <Link
                    href={`/leer/${c.id}${prog ? `?page=${prog.lastPageNumber}` : ""}`}
                    className="flex min-h-14 items-center gap-3 border-t-2 border-line px-4 py-3 transition hover:bg-[var(--surface-raised)]"
                    data-od-id={`chapter-${c.id}`}
                  >
                    <span className="font-display text-xl font-semibold text-ink">Capítulo {c.number}</span>
                    {c.title && <span className="truncate text-sm text-subtle">{c.title}</span>}
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-subtle">
                      {c.pageCount} págs.
                    </span>
                    {prog && (
                      <span
                        className={`shrink-0 border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          done ? "border-success text-success" : "border-line text-subtle"
                        }`}
                      >
                        {done ? "Leído" : `pág. ${prog.lastPageNumber}/${c.pageCount}`}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
