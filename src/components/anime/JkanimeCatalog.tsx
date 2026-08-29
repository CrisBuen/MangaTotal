"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Surface } from "@/components/ui/Surface";
import type { SerieJkanime } from "@/lib/jkanime";

const SORTS = [
  { value: "", label: "Más recientes" },
  { value: "popularidad", label: "Populares" },
  { value: "nombre", label: "A–Z" },
];

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

interface CatalogResponse {
  series: SerieJkanime[];
  page: number;
  lastPage: number;
  total: number | null;
  adult_enabled: boolean;
  error?: string;
}

export function JkanimeCatalog() {
  const [series, setSeries] = useState<SerieJkanime[] | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [adultEnabled, setAdultEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const fresh = useRef(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (search.trim()) params.set("q", search.trim());
    if (sort) params.set("sort", sort);
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    if (fresh.current) params.set("fresh", "1");

    setError(null);
    if (!fresh.current) setSeries(null);
    try {
      const res = await fetch(`/api/anime/jkanime?${params}`);
      const data = (await res.json()) as CatalogResponse;
      if (!res.ok) throw new Error(data.error ?? "JKAnime no respondió");
      setSeries(data.series);
      setPage(data.page);
      setLastPage(data.lastPage);
      setTotal(data.total);
      setAdultEnabled(data.adult_enabled);
    } catch (err) {
      setSeries([]);
      setError(err instanceof Error ? err.message : "No se pudo cargar JKAnime");
    } finally {
      fresh.current = false;
      setRefreshing(false);
    }
  }, [filters, page, reload, search, sort]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    setPage(1);
  }, [filters, search, sort]);

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
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          disabled={Boolean(search.trim())}
          className="rounded-xl border border-line bg-[var(--surface-raised)] px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink outline-none focus:border-accent disabled:opacity-40"
          aria-label="Ordenar catálogo de JKAnime"
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button
          onClick={() => setShowFilters((value) => !value)}
          className={`rounded-xl border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition ${
            activeFilters
              ? "border-accent bg-[var(--accent-soft)] text-accent"
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
          className="rounded-xl border border-line px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
        >
          ↻ {refreshing ? "Actualizando" : "Actualizar"}
        </button>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar anime..."
          className="ml-auto w-full max-w-sm rounded-xl border border-line bg-[var(--surface-raised)] px-4 py-2.5 text-sm text-ink placeholder-subtle outline-none focus:border-accent"
        />
      </div>

      {showFilters && (
        <Surface className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {filterGroups.map((group) => (
            <label key={group.key} className="space-y-2">
              <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-subtle">
                {group.label}
              </span>
              <select
                value={filters[group.key]}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, [group.key]: event.target.value }))
                }
                disabled={Boolean(search.trim())}
                className="w-full rounded-xl border border-line bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-40"
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
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="self-end justify-self-start font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-accent"
            >
              × Limpiar filtros
            </button>
          )}
        </Surface>
      )}

      {error && (
        <Surface className="p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={load} className="mt-3 font-mono text-[10px] uppercase text-accent">
            Reintentar
          </button>
        </Surface>
      )}

      {series === null ? (
        <p className="py-16 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
          Cargando catálogo de JKAnime...
        </p>
      ) : series.length === 0 && !error ? (
        <Surface className="p-12 text-center">
          <p className="text-lg font-bold text-ink">Sin resultados</p>
          <p className="mt-1 text-sm text-subtle">Probá con otro término o cambiá los filtros.</p>
        </Surface>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {series.map((anime) => (
            <Link
              key={anime.slug}
              href={`/anime/jkanime/${anime.slug}`}
              className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
                {anime.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={anime.cover_url}
                    alt={anime.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-subtle">Sin portada</div>
                )}
              </div>
              <div className="px-1 pt-4">
                <h3 className="line-clamp-2 text-lg font-bold leading-[1.12] text-ink transition group-hover:text-accent">
                  {anime.title}
                </h3>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                  {[anime.type, anime.status].filter(Boolean).join(" · ")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {series && series.length > 0 && !search.trim() && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
            Página {page} de {lastPage}{total !== null ? ` · ${total} títulos` : ""}
          </span>
          <button
            disabled={page >= lastPage}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      <p className="border-t border-line pt-6 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
        Catálogo, fichas y episodios provistos por JKAnime con su permiso
      </p>
    </div>
  );
}
