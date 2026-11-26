"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Surface } from "@/components/ui/Surface";
import { cargarConCacheAndroid } from "@/lib/androidCache";
import {
  GENEROS_HENTAITV,
  serieHentaitvDesdePublica,
  type SerieHentaitv,
} from "@/lib/hentaitv";
import {
  escribirUrlHistorial,
  fueEscritaPorNosotros,
  guardarEstadoFuente,
  guardarScrollRuta,
  guardarUltimaFuente,
  guardarUltimoExplorar,
  marcarScrollArriba,
  normalizarClaveRuta,
  useRestaurarScroll,
} from "@/lib/navegacionEstado";

const ORDENES = [
  ["date_desc", "Más recientes"],
  ["modified_desc", "Actualizados"],
  ["date_asc", "Más antiguos"],
  ["title_asc", "A–Z"],
] as const;
const ANIOS = Array.from({ length: new Date().getFullYear() - 1995 }, (_, index) =>
  String(new Date().getFullYear() - index)
);
const DESTACADOS = [
  { label: `Nuevos ${new Date().getFullYear()}`, year: String(new Date().getFullYear()) },
  { label: "Sin censura", genre: 5 },
  { label: "Harem", genre: 68 },
  { label: "Milfs", genre: 7 },
  { label: "Yuri", genre: 73 },
] as const;

interface CatalogResponse {
  series: SerieHentaitv[];
  page: number;
  lastPage: number;
  total: number;
  error?: string;
}

/**
 * HentaiTV autoriza por CORS a mangatotal.com. Este camino se usa solamente
 * si Cloudflare rechaza la IP del servidor de produccion; conserva los mismos
 * filtros y vuelve a validar cada ficha antes de mostrarla.
 */
async function catalogoHentaitvDirecto(
  params: URLSearchParams,
  signal: AbortSignal
): Promise<CatalogResponse> {
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [orderby, order] = (params.get("sort") ?? "date_desc").split("_");
  const publica = new URL("https://hentaila.tv/wp-json/wp/v2/wp-manga");
  publica.searchParams.set("per_page", "24");
  publica.searchParams.set("page", String(page));
  publica.searchParams.set("orderby", orderby);
  publica.searchParams.set("order", order);
  publica.searchParams.set("wp-manga-genre_exclude", "178,364,69,8,92,262");
  const q = params.get("q")?.trim();
  const genre = Number(params.get("genre"));
  if (q) publica.searchParams.set("search", q.slice(0, 120));
  if (GENEROS_HENTAITV.some(([id]) => id === genre)) {
    publica.searchParams.set("wp-manga-genre", String(genre));
  }

  const year = params.get("year");
  if (year && /^(?:19|20)\d{2}$/.test(year)) {
    const releaseUrl = new URL("https://hentaila.tv/wp-json/wp/v2/wp-manga-release");
    releaseUrl.searchParams.set("slug", year);
    releaseUrl.searchParams.set("per_page", "1");
    releaseUrl.searchParams.set("_fields", "id");
    const releaseRes = await fetch(releaseUrl, {
      signal,
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
    if (releaseRes.ok) {
      const releases = (await releaseRes.json()) as { id?: number }[];
      if (releases[0]?.id) publica.searchParams.set("wp-manga-release", String(releases[0].id));
    }
  }

  const res = await fetch(publica, {
    signal,
    cache: "no-store",
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HentaiTV no devolvió el catálogo (${res.status})`);
  const items = (await res.json()) as unknown[];
  const series = items
    .map(serieHentaitvDesdePublica)
    .filter((item): item is SerieHentaitv => item !== null);
  return {
    series,
    page,
    lastPage: Math.max(1, Number(res.headers.get("x-wp-totalpages")) || 1),
    total: Math.max(0, Number(res.headers.get("x-wp-total")) || series.length),
  };
}

function leerEstadoHentaitv(getParam: (key: string) => string | null) {
  const genreNum = Number(getParam("genre"));
  const genre = Number.isFinite(genreNum) && genreNum > 0 ? genreNum : null;
  const rawPage = Number(getParam("anime_page") ?? getParam("page") ?? "1");
  return {
    search: getParam("q") ?? "",
    sort: getParam("sort") ?? "date_desc",
    genre,
    year: getParam("year") ?? "",
    page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
  };
}

function construirUrlHentaitv(
  pathname: string,
  baseSearch: string,
  estado: { search: string; sort: string; genre: number | null; year: string; page: number }
): string {
  const sp = new URLSearchParams(baseSearch);
  sp.set("seccion", "animada");
  sp.set("anime_fuente", "hentaitv");
  sp.delete("page");
  if (sp.get("vista") !== "catalogo") sp.delete("vista");

  const entradas: [string, string][] = [
    ["q", estado.search.trim() ? estado.search : ""],
    ["sort", estado.sort && estado.sort !== "date_desc" ? estado.sort : ""],
    ["genre", estado.genre ? String(estado.genre) : ""],
    ["year", estado.year],
    ["anime_page", estado.page > 1 ? String(estado.page) : ""],
  ];
  for (const [k, v] of entradas) {
    if (v) sp.set(k, v);
    else sp.delete(k);
  }
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function HentaitvCatalog() {
  const pathname = usePathname() || "/explorar";
  const searchParams = useSearchParams();
  const searchParamsStr = searchParams.toString();

  const estadoInicial = useMemo(
    () => leerEstadoHentaitv((k) => searchParams.get(k)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [series, setSeries] = useState<SerieHentaitv[] | null>(null);
  const [search, setSearch] = useState(estadoInicial.search);
  const [sort, setSort] = useState(estadoInicial.sort);
  const [genre, setGenre] = useState<number | null>(estadoInicial.genre);
  const [year, setYear] = useState(estadoInicial.year);
  const [showFilters, setShowFilters] = useState(Boolean(estadoInicial.genre || estadoInicial.year));
  const [page, setPage] = useState(estadoInicial.page);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [claveCargada, setClaveCargada] = useState("");
  const fresh = useRef(false);
  const requestId = useRef(0);
  const modoUrlRef = useRef<"skip" | "push" | "replace">("skip");
  const activeFilters = Number(Boolean(genre)) + Number(Boolean(year));

  const estadoActual = useMemo(
    () => ({ search, sort, genre, year, page }),
    [search, sort, genre, year, page]
  );

  const claveConsultaActual = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), sort });
    if (search.trim()) params.set("q", search.trim());
    if (genre) params.set("genre", String(genre));
    if (year) params.set("year", year);
    return params.toString();
  }, [genre, page, search, sort, year]);

  const claveRutaActual = useMemo(() => {
    const url = construirUrlHentaitv(pathname, searchParamsStr, estadoActual);
    const idx = url.indexOf("?");
    return normalizarClaveRuta(pathname, idx >= 0 ? url.slice(idx + 1) : "");
  }, [pathname, searchParamsStr, estadoActual]);

  useRestaurarScroll(
    claveRutaActual,
    series !== null && series.length > 0 && claveCargada === claveConsultaActual,
    true
  );

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const params = new URLSearchParams(claveConsultaActual);
    if (fresh.current) params.set("fresh", "1");

    setError(null);
    if (!fresh.current) setSeries(null);
    try {
      const forzar = fresh.current;
      const data = await cargarConCacheAndroid<CatalogResponse>(
        `explorar:hentaitv:${claveConsultaActual}`,
        async (signal) => {
          const res = await fetch(`/api/anime/hentaitv?${params}`, { signal, cache: "no-store" });
          if (res.status === 502) return catalogoHentaitvDirecto(params, signal);
          const respuesta = (await res.json()) as CatalogResponse;
          if (!res.ok) throw new Error(respuesta.error ?? "HentaiTV no respondió");
          return respuesta;
        },
        {
          force: forzar,
          freshForMs: 15 * 60 * 1000,
          privateData: true,
          onCached: (guardado) => {
            if (id !== requestId.current) return;
            setSeries(guardado.series);
            setLastPage(guardado.lastPage);
            setTotal(guardado.total);
            setClaveCargada(claveConsultaActual);
          },
        }
      );
      if (id !== requestId.current) return;
      setSeries(data.series);
      if (data.page > 0 && data.page !== page) setPage(data.page);
      setLastPage(data.lastPage);
      setTotal(data.total);
      setClaveCargada(claveConsultaActual);
    } catch (err) {
      if (id !== requestId.current) return;
      setSeries([]);
      setClaveCargada(claveConsultaActual);
      setError(err instanceof Error ? err.message : "No se pudo cargar HentaiTV");
    } finally {
      if (id === requestId.current) {
        fresh.current = false;
        setRefreshing(false);
      }
    }
  }, [claveConsultaActual, page, reload]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => {
      clearTimeout(timer);
      requestId.current++;
    };
  }, [load, search]);

  const aplicarParams = useCallback((sp: URLSearchParams, limpiarLista: boolean) => {
    if (sp.get("seccion") !== "animada" || sp.get("anime_fuente") !== "hentaitv") return;
    const vista = sp.get("vista");
    if (vista === "milista" || vista === "historial") return;
    const next = leerEstadoHentaitv((k) => sp.get(k));
    modoUrlRef.current = "skip";
    if (limpiarLista) setSeries(null);
    setSearch(next.search);
    setSort(next.sort);
    setGenre(next.genre);
    setYear(next.year);
    if (next.genre || next.year) setShowFilters(true);
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
    const url = new URL(location.href);
    if (url.searchParams.get("seccion") !== "animada" || url.searchParams.get("anime_fuente") !== "hentaitv") return;
    const vista = url.searchParams.get("vista");
    if (vista === "milista" || vista === "historial") return;

    const urlRelativa = construirUrlHentaitv(pathname, url.search, estadoActual);
    const claveDestino = normalizarClaveRuta(
      pathname,
      urlRelativa.includes("?") ? urlRelativa.slice(urlRelativa.indexOf("?") + 1) : ""
    );
    const claveVentana = normalizarClaveRuta(window.location.pathname, window.location.search);

    guardarUltimaFuente("anime", "hentaitv");
    guardarEstadoFuente("anime", "hentaitv", urlRelativa);
    guardarUltimoExplorar("anime", urlRelativa);

    const modo = modoUrlRef.current;
    modoUrlRef.current = "skip";
    if (modo !== "skip" && claveDestino !== claveVentana) {
      escribirUrlHistorial(urlRelativa, modo);
    }
  }, [pathname, estadoActual]);

  const prepararNavegacionPaso = useCallback(
    (siguienteEstado: typeof estadoActual, modo: "push" | "replace") => {
      guardarScrollRuta(claveRutaActual, window.scrollY);
      const urlDestino = construirUrlHentaitv(pathname, window.location.search, siguienteEstado);
      const qsDestino = urlDestino.includes("?") ? urlDestino.slice(urlDestino.indexOf("?") + 1) : "";
      const claveDestino = normalizarClaveRuta(pathname, qsDestino);
      if (modo === "push") marcarScrollArriba(claveDestino);
      modoUrlRef.current = modo;
    },
    [claveRutaActual, pathname]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {DESTACADOS.map((item) => {
          const selected = ("genre" in item && genre === item.genre) || ("year" in item && year === item.year);
          return (
            <button
              type="button"
              key={item.label}
              onClick={() => {
                const nextGenre = "genre" in item ? (genre === item.genre ? null : item.genre) : null;
                const nextYear = "year" in item ? (year === item.year ? "" : item.year) : "";
                prepararNavegacionPaso(
                  { ...estadoActual, genre: nextGenre, year: nextYear, page: 1 },
                  "push"
                );
                setGenre(nextGenre);
                setYear(nextYear);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-2 text-[13px] transition ${
                selected
                  ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                  : "border-line text-subtle hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sort}
          onChange={(event) => {
            const nextSort = event.target.value;
            prepararNavegacionPaso({ ...estadoActual, sort: nextSort, page: 1 }, "push");
            setSort(nextSort);
            setPage(1);
          }}
          className="rounded-md border border-line bg-[var(--surface-raised)] px-3 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em] text-ink outline-none focus:border-accent"
          aria-label="Ordenar catálogo de HentaiTV"
        >
          {ORDENES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setShowFilters((value) => !value)}
          className={`rounded-md border px-4 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em] transition ${
            activeFilters
              ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
              : "border-line text-subtle hover:text-ink"
          }`}
        >
          Filtros {activeFilters ? `(${activeFilters})` : ""}
        </button>
        <button
          type="button"
          onClick={() => {
            fresh.current = true;
            setRefreshing(true);
            setReload((value) => value + 1);
          }}
          disabled={refreshing}
          className="rounded-md border border-line px-4 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:border-line-strong hover:text-ink disabled:opacity-40"
        >
          ↻ {refreshing ? "Actualizando" : "Actualizar"}
        </button>
        <input
          value={search}
          onChange={(event) => {
            const nextSearch = event.target.value;
            prepararNavegacionPaso({ ...estadoActual, search: nextSearch, page: 1 }, "replace");
            setSearch(nextSearch);
            setPage(1);
          }}
          placeholder="Buscar en HentaiTV..."
          className="ml-auto w-full max-w-sm rounded-md border border-line bg-[var(--surface-raised)] px-4 py-2.5 text-sm text-ink placeholder-subtle outline-none focus:border-accent"
        />
      </div>

      {showFilters && (
        <Surface className="grid gap-5 p-5 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="block font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">Categoría</span>
            <select
              value={genre ?? ""}
              onChange={(event) => {
                const nextGenre = Number(event.target.value) || null;
                prepararNavegacionPaso({ ...estadoActual, genre: nextGenre, page: 1 }, "push");
                setGenre(nextGenre);
                setPage(1);
              }}
              className="w-full rounded-md border border-line bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="">Todas las permitidas</option>
              {GENEROS_HENTAITV.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="block font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">Año</span>
            <select
              value={year}
              onChange={(event) => {
                const nextYear = event.target.value;
                prepararNavegacionPaso({ ...estadoActual, year: nextYear, page: 1 }, "push");
                setYear(nextYear);
                setPage(1);
              }}
              className="w-full rounded-md border border-line bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="">Cualquier año</option>
              {ANIOS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={() => {
                prepararNavegacionPaso({ ...estadoActual, genre: null, year: "", page: 1 }, "push");
                setGenre(null);
                setYear("");
                setPage(1);
              }}
              className="justify-self-start font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink"
            >
              × Limpiar filtros
            </button>
          )}
        </Surface>
      )}

      {error && (
        <Surface className="p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button type="button" onClick={load} className="mt-3 font-mono text-[11px] text-accent-ink">Reintentar</button>
        </Surface>
      )}

      {series === null ? (
        <p className="py-16 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">Cargando catálogo de HentaiTV...</p>
      ) : series.length === 0 && !error ? (
        <Surface className="p-12 text-center">
          <p className="text-lg font-bold text-ink">Sin resultados</p>
          <p className="mt-1 text-sm text-subtle">Probá con otro término o cambiá los filtros.</p>
        </Surface>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {series.map((anime) => (
            <Link key={anime.id} prefetch={false} href={`/explorar/hentaitv/${anime.slug}`} className="group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] transition-colors group-hover:border-line-strong">
                {anime.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={anime.cover_url} alt={anime.title} className="h-full w-full object-cover transition duration-500" loading="lazy" referrerPolicy="no-referrer" />
                ) : <div className="grid h-full place-items-center text-[13px] text-subtle">Sin portada</div>}
              </div>
              <div className="px-1 pt-4">
                <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">{anime.title}</h3>
                <p className="mt-1 font-mono text-[13px] text-faint">{["HentaiTV", anime.year].filter(Boolean).join(" · ")}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {series && series.length > 0 && lastPage > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              const siguiente = Math.max(1, page - 1);
              prepararNavegacionPaso({ ...estadoActual, page: siguiente }, "push");
              setPage(siguiente);
            }}
            className="rounded-md border border-line px-4 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">Página {page} de {lastPage} · {total} títulos</span>
          <button
            type="button"
            disabled={page >= lastPage}
            onClick={() => {
              const siguiente = page + 1;
              prepararNavegacionPaso({ ...estadoActual, page: siguiente }, "push");
              setPage(siguiente);
            }}
            className="rounded-md border border-line px-4 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      <p className="border-t border-line pt-6 text-center font-mono text-[11px] tracking-[0.06em] text-subtle">
        Catálogo y fichas provistos por HentaiTV con su permiso
      </p>
    </div>
  );
}
