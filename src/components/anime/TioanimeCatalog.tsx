"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Surface } from "@/components/ui/Surface";
import { cargarConCacheAndroid } from "@/lib/androidCache";
import { GENEROS_TIOANIME, type SerieTioanime } from "@/lib/tioanime";

const TIPOS = [
  ["0", "Serie TV"],
  ["1", "Película"],
  ["2", "OVA"],
  ["3", "Especial"],
] as const;
const ESTADOS = [
  ["", "Todos"],
  ["1", "En emisión"],
  ["2", "Finalizado"],
  ["3", "Próximamente"],
] as const;
const ORDENES = [
  ["recent", "Más recientes"],
  ["-recent", "Más antiguos"],
] as const;
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: ANIO_ACTUAL - 1949 }, (_, indice) => ANIO_ACTUAL - indice);

interface CatalogResponse {
  series: SerieTioanime[];
  page: number;
  lastPage: number;
  total: number | null;
  error?: string;
}

function alternar(lista: string[], valor: string): string[] {
  return lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];
}

export function TioanimeCatalog() {
  const [series, setSeries] = useState<SerieTioanime[] | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [types, setTypes] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const fresh = useRef(false);

  const activeFilters = types.length + genres.length + Number(Boolean(status)) +
    Number(Boolean(yearFrom || yearTo));

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), sort });
    if (search.trim()) params.set("q", search.trim());
    for (const type of types) params.append("type", type);
    for (const genre of genres) params.append("genre", genre);
    if (status) params.set("status", status);
    if (yearFrom || yearTo) {
      const desde = Number(yearFrom || 1950);
      const hasta = Number(yearTo || ANIO_ACTUAL);
      params.set("year_from", String(Math.min(desde, hasta)));
      params.set("year_to", String(Math.max(desde, hasta)));
    }
    if (fresh.current) params.set("fresh", "1");

    setError(null);
    if (!fresh.current) setSeries(null);
    try {
      const forzar = fresh.current;
      const cacheKey = params.toString().replace(/&?fresh=1/, "");
      const data = await cargarConCacheAndroid<CatalogResponse>(
        `explorar:tioanime:${cacheKey}`,
        async (signal) => {
          const res = await fetch(`/api/anime/tioanime?${params}`, { signal });
          const respuesta = (await res.json()) as CatalogResponse;
          if (!res.ok) throw new Error(respuesta.error ?? "TioAnime no respondió");
          return respuesta;
        },
        {
          force: forzar,
          freshForMs: 15 * 60 * 1000,
          onCached: (guardado) => {
            setSeries(guardado.series);
            setPage(guardado.page);
            setLastPage(guardado.lastPage);
          },
        }
      );
      setSeries(data.series);
      setPage(data.page);
      setLastPage(data.lastPage);
    } catch (err) {
      setSeries([]);
      setError(err instanceof Error ? err.message : "No se pudo cargar TioAnime");
    } finally {
      fresh.current = false;
      setRefreshing(false);
    }
  }, [genres, page, reload, search, sort, status, types, yearFrom, yearTo]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => setPage(1), [genres, search, sort, status, types, yearFrom, yearTo]);

  function limpiar() {
    setTypes([]);
    setGenres([]);
    setStatus("");
    setYearFrom("");
    setYearTo("");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="rounded-md border border-line bg-[var(--surface-raised)] px-3 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em] text-ink outline-none focus:border-accent"
          aria-label="Ordenar catálogo de TioAnime"
        >
          {ORDENES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setShowFilters((value) => !value)}
          className={`rounded-md border px-4 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em] transition ${
            activeFilters ? "border-accent bg-[var(--accent-soft)] text-accent-ink" : "border-line text-subtle hover:text-ink"
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
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar anime..."
          className="ml-auto w-full max-w-sm rounded-md border border-line bg-[var(--surface-raised)] px-4 py-2.5 text-sm text-ink placeholder-subtle outline-none focus:border-accent"
        />
      </div>

      {showFilters && (
        <Surface className="space-y-5 p-5">
          <div>
            <p className="mb-2 font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">Tipo</p>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setTypes((current) => alternar(current, value))}
                  className={`rounded-full border px-3 py-2 text-[13px] transition ${
                    types.includes(value) ? "border-accent bg-[var(--accent-soft)] text-accent-ink" : "border-line text-subtle hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-2">
              <span className="block font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">Estado</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-md border border-line bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent">
                {ESTADOS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="block font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">Desde el año</span>
              <select value={yearFrom} onChange={(event) => setYearFrom(event.target.value)} className="w-full rounded-md border border-line bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent">
                <option value="">Cualquiera</option>
                {[...ANIOS].reverse().map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="block font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">Hasta el año</span>
              <select value={yearTo} onChange={(event) => setYearTo(event.target.value)} className="w-full rounded-md border border-line bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent">
                <option value="">Cualquiera</option>
                {ANIOS.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">Géneros</p>
            <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto pr-2">
              {GENEROS_TIOANIME.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setGenres((current) => alternar(current, value))}
                  className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                    genres.includes(value) ? "border-accent bg-[var(--accent-soft)] text-accent-ink" : "border-line text-subtle hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {activeFilters > 0 && (
            <button type="button" onClick={limpiar} className="font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink">
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
        <p className="py-16 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">Cargando catálogo de TioAnime...</p>
      ) : series.length === 0 && !error ? (
        <Surface className="p-12 text-center">
          <p className="text-lg font-bold text-ink">Sin resultados</p>
          <p className="mt-1 text-sm text-subtle">Probá con otro término o cambiá los filtros.</p>
        </Surface>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {series.map((anime) => (
            <Link key={anime.slug} href={`/explorar/tioanime/${anime.slug}`} className="group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[var(--surface-raised)] border border-line transition-colors group-hover:border-line-strong">
                {anime.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={anime.cover_url} alt={anime.title} className="h-full w-full object-cover transition duration-500" loading="lazy" referrerPolicy="no-referrer" />
                ) : <div className="grid h-full place-items-center text-[13px] text-subtle">Sin portada</div>}
              </div>
              <div className="px-1 pt-4">
                <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">{anime.title}</h3>
                <p className="mt-1 font-mono text-[13px] text-faint">TioAnime</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {series && series.length > 0 && lastPage > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-line px-4 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle disabled:opacity-40">← Anterior</button>
          <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">Página {page} de {lastPage}</span>
          <button type="button" disabled={page >= lastPage} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-line px-4 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle disabled:opacity-40">Siguiente →</button>
        </div>
      )}

      <p className="border-t border-line pt-6 text-center font-mono text-[11px] tracking-[0.06em] text-subtle">Catálogo, fichas y episodios provistos por TioAnime con su permiso</p>
    </div>
  );
}
