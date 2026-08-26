"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimeGridCard, type AnimeCard } from "@/components/anime/AnimeGridCard";
import { SectionHeading, Surface } from "@/components/ui/Surface";

const SORTS = [
  { key: "popular", label: "Populares" },
  { key: "trending", label: "En tendencia" },
  { key: "score", label: "Mejor valorados" },
  { key: "newest", label: "Más recientes" },
  { key: "title", label: "A–Z" },
];

const FORMATS = [
  { key: "TV", label: "Serie TV" },
  { key: "MOVIE", label: "Película" },
  { key: "OVA", label: "OVA" },
  { key: "ONA", label: "ONA" },
  { key: "SPECIAL", label: "Especial" },
];

const STATUSES = [
  { key: "RELEASING", label: "En emisión" },
  { key: "FINISHED", label: "Finalizado" },
  { key: "NOT_YET_RELEASED", label: "Próximamente" },
];

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Horror",
  "Mahou Shoujo", "Mecha", "Music", "Mystery", "Psychological", "Romance",
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller",
];

const GENRE_ES: Record<string, string> = {
  Action: "Acción", Adventure: "Aventura", Comedy: "Comedia", Drama: "Drama",
  Ecchi: "Ecchi", Fantasy: "Fantasía", Horror: "Terror", "Mahou Shoujo": "Mahou Shoujo",
  Mecha: "Mecha", Music: "Música", Mystery: "Misterio", Psychological: "Psicológico",
  Romance: "Romance", "Sci-Fi": "Ciencia ficción", "Slice of Life": "Recuentos de la vida",
  Sports: "Deportes", Supernatural: "Sobrenatural", Thriller: "Suspenso",
};

export default function AnimePage() {
  const [anime, setAnime] = useState<AnimeCard[] | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("popular");
  const [season, setSeason] = useState(false);
  const [format, setFormat] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const params = new URLSearchParams({ sort, page: String(page) });
    if (search.trim()) params.set("q", search.trim());
    if (season) params.set("season", "actual");
    if (format) params.set("format", format);
    if (status) params.set("status", status);
    for (const g of genres) params.append("genre", g);

    try {
      const res = await fetch(`/api/anime?${params}`);
      if (!res.ok) throw new Error("fallo");
      const data = await res.json();
      setAnime(data.anime);
      setLastPage(data.last_page);
    } catch {
      setError(true);
      setAnime([]);
    }
  }, [search, sort, season, format, status, genres, page]);

  useEffect(() => {
    setAnime(null);
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    setPage(1);
  }, [search, sort, season, format, status, genres]);

  const activeFilters = (format ? 1 : 0) + (status ? 1 : 0) + genres.length + (season ? 1 : 0);

  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow="Catálogo de anime"
        title="Anime"
        description="Explorá series y películas, seguí lo que estás viendo y descubrí dónde verlas oficialmente."
        action={
          <Link
            href="/anime/mi-lista"
            className="inline-flex min-h-11 items-center rounded-xl border border-accent bg-accent px-5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bg)] transition hover:opacity-90"
          >
            Mi lista
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          disabled={Boolean(search.trim())}
          className="rounded-xl border border-line bg-[var(--surface-raised)] px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink outline-none focus:border-accent disabled:opacity-40"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => setSeason((v) => !v)}
          className={`rounded-xl border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition ${
            season
              ? "border-accent bg-[var(--accent-soft)] text-accent"
              : "border-line text-subtle hover:text-ink"
          }`}
        >
          Temporada actual
        </button>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`rounded-xl border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition ${
            activeFilters > 0
              ? "border-accent bg-[var(--accent-soft)] text-accent"
              : "border-line text-subtle hover:text-ink"
          }`}
        >
          Filtros {activeFilters > 0 ? `(${activeFilters})` : ""}
        </button>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar anime…"
          className="ml-auto w-full max-w-sm rounded-xl border border-line bg-[var(--surface-raised)] px-4 py-2.5 text-sm text-ink placeholder-subtle outline-none focus:border-accent"
        />
      </div>

      {showFilters && (
        <Surface className="space-y-5 p-5">
          <div>
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
              Formato
            </p>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFormat(format === f.key ? null : f.key)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    format === f.key
                      ? "border-accent bg-[var(--accent-soft)] text-accent"
                      : "border-line text-subtle hover:text-ink"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
              Estado
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatus(status === s.key ? null : s.key)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    status === s.key
                      ? "border-accent bg-[var(--accent-soft)] text-accent"
                      : "border-line text-subtle hover:text-ink"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
              Géneros
            </p>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() =>
                    setGenres(genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g])
                  }
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    genres.includes(g)
                      ? "border-accent bg-[var(--accent-soft)] text-accent"
                      : "border-line text-subtle hover:text-ink"
                  }`}
                >
                  {GENRE_ES[g] ?? g}
                </button>
              ))}
            </div>
          </div>

          {activeFilters > 0 && (
            <button
              onClick={() => {
                setFormat(null);
                setStatus(null);
                setGenres([]);
                setSeason(false);
              }}
              className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-accent"
            >
              ✕ Limpiar filtros
            </button>
          )}
        </Surface>
      )}

      {error && (
        <Surface className="p-6 text-center text-sm text-subtle">
          No se pudo conectar con el catálogo de anime. Intentá de nuevo en un momento.
        </Surface>
      )}

      {anime === null ? (
        <p className="py-16 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
          Cargando catálogo...
        </p>
      ) : anime.length === 0 && !error ? (
        <Surface className="p-12 text-center">
          <p className="text-lg font-bold text-ink">Sin resultados</p>
          <p className="mt-1 text-sm text-subtle">Probá con otro término o cambiá los filtros.</p>
        </Surface>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {anime.map((a) => (
            <AnimeGridCard key={a.id} anime={a} />
          ))}
        </div>
      )}

      {anime !== null && anime.length > 0 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
            Página {page} de {lastPage}
          </span>
          <button
            disabled={page >= lastPage}
            onClick={() => setPage(page + 1)}
            className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      <p className="border-t border-line pt-6 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
        Datos de anime provistos por AniList · MangaTotal no aloja ni reproduce video
      </p>
    </div>
  );
}
