"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Surface } from "@/components/ui/Surface";
import { cargarConCacheAndroid } from "@/lib/androidCache";
import type { SerieJkanime } from "@/lib/jkanime";
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

const GENRES = [
  ["accion", "Acción"], ["aventura", "Aventura"], ["autos", "Autos"],
  ["comedia", "Comedia"], ["dementia", "Dementia"], ["demonios", "Demonios"],
  ["misterio", "Misterio"], ["drama", "Drama"], ["ecchi", "Ecchi"],
  ["fantasia", "Fantasía"], ["juegos", "Juegos"], ["hentai", "Hentai"],
  ["historico", "Histórico"], ["terror", "Terror"], ["nios", "Niños"],
  ["magia", "Magia"], ["artes-marciales", "Artes marciales"], ["mecha", "Mecha"],
  ["musica", "Música"], ["parodia", "Parodia"], ["samurai", "Samurái"],
  ["romance", "Romance"], ["colegial", "Escolar"], ["sci-fi", "Ciencia ficción"],
  ["shoujo", "Shoujo"], ["shoujo-ai", "Shoujo Ai"], ["shounen", "Shounen"],
  ["shounen-ai", "Shounen Ai"], ["space", "Espacio"], ["deportes", "Deportes"],
  ["super-poderes", "Superpoderes"], ["vampiros", "Vampiros"], ["yaoi", "Yaoi"],
  ["yuri", "Yuri"], ["harem", "Harem"], ["cosas-de-la-vida", "Cosas de la vida"],
  ["sobrenatural", "Sobrenatural"], ["militar", "Militar"], ["policial", "Policial"],
  ["psicologico", "Psicológico"], ["thriller", "Thriller"], ["seinen", "Seinen"],
  ["josei", "Josei"], ["latino", "Español latino"], ["isekai", "Isekai"],
] as const;

const DEMOGRAPHICS = [
  ["nios", "Niños"], ["shoujo", "Shoujo"], ["shounen", "Shounen"],
  ["seinen", "Seinen"], ["josei", "Josei"],
] as const;
const CATEGORIES = [["donghua", "Donghua"], ["latino", "Latino"]] as const;
const TYPES = [
  ["animes", "Serie"], ["peliculas", "Película"], ["especiales", "Especial"],
  ["ovas", "OVA"], ["onas", "ONA"],
] as const;
const STATUSES = [
  ["emision", "En emisión"], ["finalizados", "Finalizado"], ["estrenos", "Por estrenar"],
] as const;
const SEASONS = [
  ["invierno", "Invierno"], ["primavera", "Primavera"],
  ["verano", "Verano"], ["otoño", "Otoño"],
] as const;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((v) => [v.toLowerCase(), v] as const);
const YEARS = Array.from({ length: new Date().getFullYear() - 1980 }, (_, i) => {
  const value = String(new Date().getFullYear() - i);
  return [value, value] as const;
});

type FilterKey =
  | "genre" | "letter" | "demographic" | "category"
  | "type" | "status" | "year" | "season" | "order";

const EMPTY_FILTERS: Record<FilterKey, string> = {
  genre: "", letter: "", demographic: "", category: "",
  type: "", status: "", year: "", season: "", order: "",
};

const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as FilterKey[];

function leerEstadoJkanime(getParam: (key: string) => string | null) {
  const filters = Object.fromEntries(
    FILTER_KEYS.map((key) => [key, getParam(key) ?? ""])
  ) as Record<FilterKey, string>;
  const rawPage = Number(getParam("anime_page") ?? getParam("page") ?? "1");
  return {
    search: getParam("q") ?? "",
    sort: getParam("sort") ?? "",
    filters,
    page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
  };
}

function construirUrlJkanime(
  pathname: string,
  baseSearch: string,
  estado: { search: string; sort: string; filters: Record<FilterKey, string>; page: number }
): string {
  const sp = new URLSearchParams(baseSearch);
  sp.set("seccion", "animada");
  sp.set("anime_fuente", "jkanime");
  sp.set("vista", "catalogo");
  sp.delete("page");

  for (const key of FILTER_KEYS) {
    const val = estado.filters[key];
    if (val) sp.set(key, val);
    else sp.delete(key);
  }
  if (estado.search.trim()) sp.set("q", estado.search);
  else sp.delete("q");
  if (estado.sort) sp.set("sort", estado.sort);
  else sp.delete("sort");
  if (estado.page > 1) sp.set("anime_page", String(estado.page));
  else sp.delete("anime_page");

  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

interface CatalogResponse {
  series: SerieJkanime[];
  page: number;
  lastPage: number;
  total: number | null;
  adult_enabled: boolean;
  error?: string;
}

export function JkanimeCatalog({ initial = {} }: { initial?: Record<string, string> }) {
  const pathname = usePathname() || "/explorar";
  const searchParams = useSearchParams();
  const searchParamsStr = searchParams.toString();

  const estadoInicial = useMemo(
    () => leerEstadoJkanime((key) => initial[key] ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [series, setSeries] = useState<SerieJkanime[] | null>(null);
  const [search, setSearch] = useState(estadoInicial.search);
  const [sort, setSort] = useState(estadoInicial.sort);
  const [filters, setFilters] = useState(estadoInicial.filters);
  const [showFilters, setShowFilters] = useState(Boolean(estadoInicial.filters.genre || estadoInicial.filters.status));
  const [page, setPage] = useState(estadoInicial.page);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [adultEnabled, setAdultEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [claveCargada, setClaveCargada] = useState("");
  const [guardadas, setGuardadas] = useState<{ slug?: string | null; external_id: string; title?: string }[]>([]);
  const reloadBiblioteca = useCallback(() => {
    let vigente = true;
    fetch("/api/anime/externo/biblioteca", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (vigente && Array.isArray(data)) {
          setGuardadas(data.filter((e: any) => e.source === "jkanime"));
        }
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    const cancelar = reloadBiblioteca();
    window.addEventListener("focus", reloadBiblioteca);
    window.addEventListener("pageshow", reloadBiblioteca);
    return () => {
      cancelar();
      window.removeEventListener("focus", reloadBiblioteca);
      window.removeEventListener("pageshow", reloadBiblioteca);
    };
  }, [reloadBiblioteca]);

  const fresh = useRef(false);
  const requestId = useRef(0);
  const modoUrlRef = useRef<"skip" | "push" | "replace">("skip");

  const estadoActual = useMemo(
    () => ({ search, sort, filters, page }),
    [search, sort, filters, page]
  );

  const claveConsultaActual = useMemo(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (search.trim()) params.set("q", search.trim());
    if (sort) params.set("sort", sort);
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    return params.toString();
  }, [filters, page, search, sort]);

  const claveRutaActual = useMemo(() => {
    const url = construirUrlJkanime(pathname, searchParamsStr, estadoActual);
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
      const fresco = fresh.current;
      const data = await cargarConCacheAndroid<CatalogResponse>(
        `explorar:jkanime:${claveConsultaActual}`,
        async (signal) => {
          const res = await fetch(`/api/anime/jkanime?${params}`, { signal });
          const respuesta = (await res.json()) as CatalogResponse;
          if (!res.ok) throw new Error(respuesta.error ?? "JKAnime no respondió");
          return respuesta;
        },
        {
          force: fresco,
          freshForMs: 15 * 60 * 1000,
          onCached: (guardado) => {
            if (id !== requestId.current) return;
            setSeries(guardado.series);
            setLastPage(guardado.lastPage);
            setTotal(guardado.total);
            setAdultEnabled(guardado.adult_enabled);
            setClaveCargada(claveConsultaActual);
          },
        }
      );
      if (id !== requestId.current) return;
      setSeries(data.series);
      if (data.page > 0 && data.page !== page) setPage(data.page);
      setLastPage(data.lastPage);
      setTotal(data.total);
      setAdultEnabled(data.adult_enabled);
      setClaveCargada(claveConsultaActual);
    } catch (err) {
      if (id !== requestId.current) return;
      setSeries([]);
      setClaveCargada(claveConsultaActual);
      setError(err instanceof Error ? err.message : "No se pudo cargar JKAnime");
    } finally {
      if (id === requestId.current) { fresh.current = false; setRefreshing(false); }
    }
  }, [claveConsultaActual, page, reload]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => { clearTimeout(timer); requestId.current++; };
  }, [load, search]);

  // Sincronizamos cambios externos de URL (pestañas móvil/desktop o botón Atrás/Adelante).
  const aplicarParams = useCallback((sp: URLSearchParams, limpiarLista: boolean) => {
    if (sp.get("seccion") !== "animada" || sp.get("vista") !== "catalogo") return;
    const f = sp.get("anime_fuente");
    if (f && f !== "jkanime") return;
    const next = leerEstadoJkanime((k) => sp.get(k));
    modoUrlRef.current = "skip";
    if (limpiarLista) setSeries(null);
    setSearch(next.search);
    setSort(next.sort);
    setFilters(next.filters);
    if (next.filters.genre || next.filters.status) setShowFilters(true);
    setPage(next.page);
  }, []);

  useEffect(() => {
    if (fueEscritaPorNosotros(pathname, searchParamsStr)) return;
    const sp = new URLSearchParams(searchParamsStr);
    aplicarParams(sp, false);
  }, [pathname, searchParamsStr, aplicarParams]);

  useEffect(() => {
    const onPopState = () => {
      aplicarParams(new URLSearchParams(window.location.search), true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [aplicarParams]);

  // Escribimos URL e historial de la fuente sin provocar re-renders en loop.
  useEffect(() => {
    const currentUrl = new URL(location.href);
    if (currentUrl.searchParams.get("vista") !== "catalogo") return;
    const urlRelativa = construirUrlJkanime(pathname, currentUrl.search, estadoActual);
    const claveDestino = normalizarClaveRuta(
      pathname,
      urlRelativa.includes("?") ? urlRelativa.slice(urlRelativa.indexOf("?") + 1) : ""
    );
    const claveVentana = normalizarClaveRuta(window.location.pathname, window.location.search);

    guardarUltimaFuente("anime", "jkanime");
    guardarEstadoFuente("anime", "jkanime", urlRelativa);
    guardarUltimoExplorar("anime", urlRelativa);

    const modo = modoUrlRef.current;
    modoUrlRef.current = "skip";
    if (modo !== "skip" && claveDestino !== claveVentana) {
      escribirUrlHistorial(urlRelativa, modo);
    }
  }, [pathname, estadoActual]);

  const prepararNavegacionPaso = useCallback(
    (siguienteEstado: { search: string; sort: string; filters: Record<FilterKey, string>; page: number }, modo: "push" | "replace") => {
      guardarScrollRuta(claveRutaActual, window.scrollY);
      const urlDestino = construirUrlJkanime(pathname, window.location.search, siguienteEstado);
      const qsDestino = urlDestino.includes("?") ? urlDestino.slice(urlDestino.indexOf("?") + 1) : "";
      const claveDestino = normalizarClaveRuta(pathname, qsDestino);
      if (modo === "push") marcarScrollArriba(claveDestino);
      modoUrlRef.current = modo;
    },
    [claveRutaActual, pathname]
  );

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const filterGroups: { key: FilterKey; label: string; options: readonly (readonly [string, string])[] }[] = [
    { key: "genre", label: "Género", options: GENRES.filter(([value]) => adultEnabled || value !== "hentai") },
    { key: "letter", label: "Inicial", options: LETTERS },
    { key: "demographic", label: "Demografía", options: DEMOGRAPHICS },
    { key: "category", label: "Categoría", options: CATEGORIES },
    { key: "type", label: "Tipo", options: TYPES },
    { key: "status", label: "Estado", options: STATUSES },
    { key: "year", label: "Año", options: YEARS },
    { key: "season", label: "Temporada", options: SEASONS },
    { key: "order", label: "Dirección", options: [["asc", "Ascendente"]] },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
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
            prepararNavegacionPaso({ search: nextSearch, sort, filters, page: 1 }, "replace");
            setSearch(nextSearch);
            setPage(1);
          }}
          placeholder="Buscar anime..."
          className="ml-auto w-full max-w-sm rounded-md border border-line bg-[var(--surface-raised)] px-4 py-2.5 text-sm text-ink placeholder-subtle outline-none focus:border-accent"
        />
      </div>

      {showFilters && (
        <Surface className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {filterGroups.map((group) => (
            <label key={group.key} className="space-y-2">
              <span className="block font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">
                {group.label}
              </span>
              <select
                value={filters[group.key]}
                onChange={(event) => {
                  const nextFilters = { ...filters, [group.key]: event.target.value };
                  prepararNavegacionPaso({ search, sort, filters: nextFilters, page: 1 }, "push");
                  setFilters(nextFilters);
                  setPage(1);
                }}
                disabled={Boolean(search.trim())}
                className="w-full rounded-md border border-line bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-40"
              >
                <option value="">Todos</option>
                {group.options.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          ))}
          {activeFilters > 0 && (
            <button
              onClick={() => {
                prepararNavegacionPaso({ search, sort, filters: EMPTY_FILTERS, page: 1 }, "push");
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
              className="self-end justify-self-start font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink"
            >
              × Limpiar filtros
            </button>
          )}
        </Surface>
      )}

      {error && (
        <Surface className="p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={load} className="mt-3 font-mono text-[11px] text-accent-ink">
            Reintentar
          </button>
        </Surface>
      )}

      {series === null ? (
        <p className="py-16 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
          Cargando catálogo de JKAnime...
        </p>
      ) : series.length === 0 && !error ? (
        <Surface className="p-12 text-center">
          <p className="text-lg font-bold text-ink">Sin resultados</p>
          <p className="mt-1 text-sm text-subtle">Probá con otro término o cambiá los filtros.</p>
        </Surface>
      ) : (
        <div className="od-catalog-grid grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {series.map((anime) => {
            const estaGuardada = guardadas.some(
              (g) =>
                (g.slug && g.slug.toLowerCase() === anime.slug.toLowerCase()) ||
                (g.external_id && g.external_id.toLowerCase() === anime.slug.toLowerCase()) ||
                (g.title && anime.title && g.title.toLowerCase() === anime.title.toLowerCase())
            );
            return (
              <Link
                key={anime.slug}
                href={`/explorar/jkanime/${anime.slug}`}
                prefetch={false}
                className={`od-catalog-card group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${estaGuardada ? "opacity-60" : ""}`}
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[var(--surface-raised)] border border-line transition-colors group-hover:border-line-strong">
                  {estaGuardada && (
                    <span
                      className="absolute left-2 top-2 z-10 rounded-md border border-line bg-panel px-2 py-1 text-[11px] font-semibold text-ink shadow-sm"
                      aria-label="En biblioteca"
                    >
                      ▣ En biblioteca
                    </span>
                  )}
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
                    <div className="grid h-full place-items-center text-[13px] text-subtle">Sin portada</div>
                  )}
                </div>
                <div className="px-1 pt-4">
                  <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
                    {anime.title}
                  </h3>
                  <p className="mt-1 font-mono text-[13px] text-faint">
                    {[anime.type, anime.status].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {series && series.length > 0 && !search.trim() && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => {
              const siguiente = Math.max(1, page - 1);
              prepararNavegacionPaso({ search, sort, filters, page: siguiente }, "push");
              setPage(siguiente);
            }}
            className="rounded-md border border-line px-4 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">
            Página {page} de {lastPage}{total !== null ? ` · ${total} títulos` : ""}
          </span>
          <button
            disabled={page >= lastPage}
            onClick={() => {
              const siguiente = page + 1;
              prepararNavegacionPaso({ search, sort, filters, page: siguiente }, "push");
              setPage(siguiente);
            }}
            className="rounded-md border border-line px-4 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      <p className="border-t border-line pt-6 text-center font-mono text-[11px] tracking-[0.06em] text-subtle">
        Catálogo, fichas y episodios provistos por JKAnime con su permiso
      </p>
    </div>
  );
}
