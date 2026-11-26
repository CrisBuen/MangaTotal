"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimeGridCard, type AnimeCard } from "@/components/anime/AnimeGridCard";
import { SectionHeading, Surface } from "@/components/ui/Surface";
import {
  escribirUrlHistorial,
  fueEscritaPorNosotros,
  guardarScrollRuta,
  marcarScrollArriba,
  normalizarClaveRuta,
  useRestaurarScroll,
} from "@/lib/navegacionEstado";

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

function leerEstadoAnilist(sp: Pick<URLSearchParams, "get" | "getAll">) {
  const genreParam = sp.getAll("genre");
  const genres =
    genreParam.length > 0
      ? genreParam.flatMap((g) => g.split(",")).map((g) => g.trim()).filter(Boolean)
      : [];
  const rawPage = Number(sp.get("page") ?? "1");
  return {
    search: sp.get("q") ?? "",
    sort: sp.get("sort") ?? "popular",
    season: sp.get("season") === "actual" || sp.get("season") === "1",
    format: sp.get("format") || null,
    status: sp.get("status") || null,
    genres,
    page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
  };
}

function construirUrlAnilist(
  pathname: string,
  estado: {
    search: string;
    sort: string;
    season: boolean;
    format: string | null;
    status: string | null;
    genres: string[];
    page: number;
  }
): string {
  const sp = new URLSearchParams();
  if (estado.search.trim()) sp.set("q", estado.search);
  if (estado.sort && estado.sort !== "popular") sp.set("sort", estado.sort);
  if (estado.season) sp.set("season", "actual");
  if (estado.format) sp.set("format", estado.format);
  if (estado.status) sp.set("status", estado.status);
  for (const g of estado.genres) sp.append("genre", g);
  if (estado.page > 1) sp.set("page", String(estado.page));
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function AnimePageContent() {
  const pathname = usePathname() || "/anime";
  const searchParams = useSearchParams();
  const searchParamsStr = searchParams.toString();

  const inicial = useMemo(
    () => leerEstadoAnilist(new URLSearchParams(searchParamsStr)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [anime, setAnime] = useState<AnimeCard[] | null>(null);
  const [search, setSearch] = useState(inicial.search);
  const [sort, setSort] = useState(inicial.sort);
  const [season, setSeason] = useState(inicial.season);
  const [format, setFormat] = useState<string | null>(inicial.format);
  const [status, setStatus] = useState<string | null>(inicial.status);
  const [genres, setGenres] = useState<string[]>(inicial.genres);
  const [showFilters, setShowFilters] = useState(
    Boolean(inicial.format || inicial.status || inicial.genres.length || inicial.season)
  );
  const [page, setPage] = useState(inicial.page);
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState(false);
  const [claveCargada, setClaveCargada] = useState("");
  const requestId = useRef(0);
  const modoUrlRef = useRef<"skip" | "push" | "replace">("skip");

  const estadoActual = useMemo(
    () => ({ search, sort, season, format, status, genres, page }),
    [search, sort, season, format, status, genres, page]
  );

  const claveConsultaActual = useMemo(() => {
    const params = new URLSearchParams({ sort, page: String(page) });
    if (search.trim()) params.set("q", search.trim());
    if (season) params.set("season", "actual");
    if (format) params.set("format", format);
    if (status) params.set("status", status);
    for (const g of genres) params.append("genre", g);
    return params.toString();
  }, [search, sort, season, format, status, genres, page]);

  const claveRutaActual = useMemo(() => {
    const url = construirUrlAnilist(pathname, estadoActual);
    const idx = url.indexOf("?");
    return normalizarClaveRuta(pathname, idx >= 0 ? url.slice(idx + 1) : "");
  }, [pathname, estadoActual]);

  useRestaurarScroll(
    claveRutaActual,
    anime !== null && anime.length > 0 && claveCargada === claveConsultaActual,
    true
  );

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setError(false);
    setAnime(null);
    try {
      const res = await fetch(`/api/anime?${claveConsultaActual}`);
      if (id !== requestId.current) return;
      if (!res.ok) throw new Error("fallo");
      const data = await res.json();
      if (id !== requestId.current) return;
      setAnime(data.anime);
      setLastPage(data.last_page);
      setClaveCargada(claveConsultaActual);
    } catch {
      if (id !== requestId.current) return;
      setError(true);
      setAnime([]);
      setClaveCargada(claveConsultaActual);
    }
  }, [claveConsultaActual]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => {
      clearTimeout(t);
      requestId.current++;
    };
  }, [load, search]);

  const aplicarParams = useCallback((sp: URLSearchParams, limpiarLista: boolean) => {
    const next = leerEstadoAnilist(sp);
    modoUrlRef.current = "skip";
    if (limpiarLista) setAnime(null);
    setSearch(next.search);
    setSort(next.sort);
    setSeason(next.season);
    setFormat(next.format);
    setStatus(next.status);
    setGenres(next.genres);
    if (next.format || next.status || next.genres.length || next.season) setShowFilters(true);
    setPage(next.page);
  }, []);

  useEffect(() => {
    if (fueEscritaPorNosotros(pathname, searchParamsStr)) return;
    aplicarParams(new URLSearchParams(searchParamsStr), false);
  }, [pathname, searchParamsStr, aplicarParams]);

  useEffect(() => {
    const onPopState = () => {
      aplicarParams(new URLSearchParams(window.location.search), true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [aplicarParams]);

  useEffect(() => {
    const urlRelativa = construirUrlAnilist(pathname, estadoActual);
    const claveDestino = normalizarClaveRuta(
      pathname,
      urlRelativa.includes("?") ? urlRelativa.slice(urlRelativa.indexOf("?") + 1) : ""
    );
    const claveVentana = normalizarClaveRuta(window.location.pathname, window.location.search);
    const modo = modoUrlRef.current;
    modoUrlRef.current = "skip";
    if (modo !== "skip" && claveDestino !== claveVentana) {
      escribirUrlHistorial(urlRelativa, modo);
    }
  }, [pathname, estadoActual]);

  const prepararNavegacionPaso = useCallback(
    (siguienteEstado: typeof estadoActual, modo: "push" | "replace") => {
      guardarScrollRuta(claveRutaActual, window.scrollY);
      const urlDestino = construirUrlAnilist(pathname, siguienteEstado);
      const qsDestino = urlDestino.includes("?") ? urlDestino.slice(urlDestino.indexOf("?") + 1) : "";
      const claveDestino = normalizarClaveRuta(pathname, qsDestino);
      if (modo === "push") marcarScrollArriba(claveDestino);
      modoUrlRef.current = modo;
    },
    [claveRutaActual, pathname]
  );

  const activeFilters = (format ? 1 : 0) + (status ? 1 : 0) + genres.length + (season ? 1 : 0);

  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow="Catálogo de AniList"
        title="AniList"
        description="Información de series animadas y plataformas oficiales. MangaTotal no reproduce anime en esta sección."
        action={
          <Link
            href="/anime/mi-lista"
            className="inline-flex min-h-11 items-center rounded-md border border-accent bg-accent px-5 font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)] transition hover:opacity-90"
          >
            Mi lista
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sort}
          onChange={(e) => {
            const nextSort = e.target.value;
            prepararNavegacionPaso({ ...estadoActual, sort: nextSort, page: 1 }, "push");
            setSort(nextSort);
            setPage(1);
          }}
          disabled={Boolean(search.trim())}
          className="rounded-md border border-line bg-[var(--surface-raised)] px-3 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em] text-ink outline-none focus:border-accent disabled:opacity-40"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            const nextSeason = !season;
            prepararNavegacionPaso({ ...estadoActual, season: nextSeason, page: 1 }, "push");
            setSeason(nextSeason);
            setPage(1);
          }}
          className={`rounded-md border px-4 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em] transition ${
            season
              ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
              : "border-line text-subtle hover:text-ink"
          }`}
        >
          Temporada actual
        </button>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`rounded-md border px-4 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em] transition ${
            activeFilters > 0
              ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
              : "border-line text-subtle hover:text-ink"
          }`}
        >
          Filtros {activeFilters > 0 ? `(${activeFilters})` : ""}
        </button>

        <input
          value={search}
          onChange={(e) => {
            const nextSearch = e.target.value;
            prepararNavegacionPaso({ ...estadoActual, search: nextSearch, page: 1 }, "replace");
            setSearch(nextSearch);
            setPage(1);
          }}
          placeholder="Buscar anime…"
          className="ml-auto w-full max-w-sm rounded-md border border-line bg-[var(--surface-raised)] px-4 py-2.5 text-sm text-ink placeholder-subtle outline-none focus:border-accent"
        />
      </div>

      {showFilters && (
        <Surface className="space-y-5 p-5">
          <div>
            <p className="mb-2 font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">
              Formato
            </p>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => {
                    const nextFormat = format === f.key ? null : f.key;
                    prepararNavegacionPaso({ ...estadoActual, format: nextFormat, page: 1 }, "push");
                    setFormat(nextFormat);
                    setPage(1);
                  }}
                  className={`rounded-full border px-3 py-1 text-[13px] transition ${
                    format === f.key
                      ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                      : "border-line text-subtle hover:text-ink"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">
              Estado
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    const nextStatus = status === s.key ? null : s.key;
                    prepararNavegacionPaso({ ...estadoActual, status: nextStatus, page: 1 }, "push");
                    setStatus(nextStatus);
                    setPage(1);
                  }}
                  className={`rounded-full border px-3 py-1 text-[13px] transition ${
                    status === s.key
                      ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                      : "border-line text-subtle hover:text-ink"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">
              Géneros
            </p>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    const nextGenres = genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g];
                    prepararNavegacionPaso({ ...estadoActual, genres: nextGenres, page: 1 }, "push");
                    setGenres(nextGenres);
                    setPage(1);
                  }}
                  className={`rounded-full border px-3 py-1 text-[13px] transition ${
                    genres.includes(g)
                      ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
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
                prepararNavegacionPaso({ ...estadoActual, format: null, status: null, genres: [], season: false, page: 1 }, "push");
                setFormat(null);
                setStatus(null);
                setGenres([]);
                setSeason(false);
                setPage(1);
              }}
              className="font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink"
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
        <p className="py-16 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
          Cargando catálogo...
        </p>
      ) : anime.length === 0 && !error ? (
        <Surface className="p-12 text-center">
          <p className="text-lg font-bold text-ink">Sin resultados</p>
          <p className="mt-1 text-sm text-subtle">Probá con otro término o cambiá los filtros.</p>
        </Surface>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {anime.map((a) => (
            <AnimeGridCard key={a.id} anime={a} />
          ))}
        </div>
      )}

      {anime !== null && anime.length > 0 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => {
              const siguiente = Math.max(1, page - 1);
              prepararNavegacionPaso({ ...estadoActual, page: siguiente }, "push");
              setPage(siguiente);
            }}
            className="rounded-md border border-line px-4 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:border-line-strong hover:text-ink disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">
            Página {page} de {lastPage}
          </span>
          <button
            disabled={page >= lastPage}
            onClick={() => {
              const siguiente = page + 1;
              prepararNavegacionPaso({ ...estadoActual, page: siguiente }, "push");
              setPage(siguiente);
            }}
            className="rounded-md border border-line px-4 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:border-line-strong hover:text-ink disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      <p className="border-t border-line pt-6 text-center font-mono text-[11px] tracking-[0.06em] text-subtle">
        Datos de anime provistos por AniList · MangaTotal no aloja ni reproduce video
      </p>
    </div>
  );
}

export default function AnimePage() {
  return (
    <Suspense fallback={<p className="py-16 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">Cargando catálogo...</p>}>
      <AnimePageContent />
    </Suspense>
  );
}
