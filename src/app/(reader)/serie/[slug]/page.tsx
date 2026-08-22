import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FavoriteButton } from "@/components/library/FavoriteButton";

const STATUS_LABEL: Record<string, string> = {
  ongoing: "En curso",
  completed: "Completada",
  dropped: "Abandonada",
};

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
    },
  });

  if (!series) notFound();
  if (series.type === "adult" && !user?.showAdultContent && !user?.isAdmin) notFound();

  const bookmark = series.progress[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-40 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800 sm:w-48">
          <div className="aspect-[2/3]">
            {series.coverImagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/images/${series.coverImagePath}`}
                alt={series.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-5xl text-zinc-600">
                📖
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{series.title}</h1>
            {series.type === "adult" && (
              <span className="rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                +18
              </span>
            )}
          </div>
          {series.originalTitle && (
            <p className="mb-2 text-sm text-zinc-500">{series.originalTitle}</p>
          )}
          <p className="mb-3 text-sm text-zinc-400">
            {STATUS_LABEL[series.status] ?? series.status} · {series.chapters.length} capítulo
            {series.chapters.length === 1 ? "" : "s"}
          </p>
          {series.description && (
            <p className="mb-4 whitespace-pre-line text-sm text-zinc-300">{series.description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {bookmark && (
              <Link
                href={`/leer/${bookmark.chapterId}?page=${bookmark.lastPageNumber}`}
                className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Continuar — Cap. {bookmark.chapter.number}, pág. {bookmark.lastPageNumber}
              </Link>
            )}
            {!bookmark && series.chapters.length > 0 && (
              <Link
                href={`/leer/${series.chapters[0].id}`}
                className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Empezar a leer
              </Link>
            )}
            {user ? (
              <FavoriteButton seriesId={series.id} initialFavorite={series.favorites.length > 0} />
            ) : (
              <Link
                href="/login"
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
              >
                Iniciá sesión para leer y guardar progreso
              </Link>
            )}
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">Capítulos</h2>
        {series.chapters.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 py-10 text-center text-sm text-zinc-500">
            Todavía no hay capítulos en esta serie.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            {series.chapters.map((c) => {
              const prog = c.progress[0];
              const done = prog && prog.lastPageNumber >= c.pageCount;
              return (
                <li key={c.id}>
                  <Link
                    href={`/leer/${c.id}${prog ? `?page=${prog.lastPageNumber}` : ""}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-zinc-800/60"
                  >
                    <span className="font-medium text-zinc-100">Capítulo {c.number}</span>
                    {c.title && <span className="truncate text-sm text-zinc-400">{c.title}</span>}
                    <span className="ml-auto shrink-0 text-xs text-zinc-500">
                      {c.pageCount} págs.
                    </span>
                    {prog && (
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          done ? "bg-green-600/20 text-green-400" : "bg-violet-600/20 text-violet-300"
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
