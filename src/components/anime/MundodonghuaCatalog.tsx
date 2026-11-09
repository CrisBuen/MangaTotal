"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Surface } from "@/components/ui/Surface";
import { cargarConCacheAndroid } from "@/lib/androidCache";
import { GENEROS_MUNDODONGHUA, type SerieMundodonghua } from "@/lib/mundodonghua";

const ESTADOS = [
  ["", "Todas las series"],
  ["emision", "En emisión"],
  ["finalizados", "Finalizadas"],
  ["recopilados", "Recopiladas"],
] as const;

interface CatalogResponse {
  series: SerieMundodonghua[];
  page: number;
  lastPage: number;
  total: number | null;
  error?: string;
}

export function MundodonghuaCatalog({ initial = {} }: { initial?: Record<string, string> }) {
  const [series, setSeries] = useState<SerieMundodonghua[] | null>(null);
  const [search, setSearch] = useState(initial.q ?? "");
  const [status, setStatus] = useState(initial.status ?? "");
  const [genero, setGenero] = useState(initial.genre ?? initial.genero ?? "");
  const [showFilters, setShowFilters] = useState(Boolean(initial.status || initial.genre || initial.genero));
  const [page, setPage] = useState(() => Math.max(1, Math.floor(Number(initial.anime_page) || 1)));
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [guardadas, setGuardadas] = useState<{ slug?: string | null; external_id: string; title?: string }[]>([]);

  const reloadBiblioteca = useCallback(() => {
    let vigente = true;
    fetch("/api/anime/externo/biblioteca", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (vigente && Array.isArray(data)) {
          setGuardadas(data.filter((e: any) => e.source === "mundodonghua"));
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
  const lastFilters = useRef(JSON.stringify([search, status, genero]));

  const activeFilters = Number(Boolean(status)) + Number(Boolean(genero));

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const params = new URLSearchParams({ page: String(page) });
    if (search.trim()) params.set("q", search.trim());
    if (status) params.set("status", status);
    if (genero) params.set("genre", genero);
    if (fresh.current) params.set("fresh", "1");

    setError(null);
    if (!fresh.current) setSeries(null);
    try {
      const forzar = fresh.current;
      const cacheKey = params.toString().replace(/&?fresh=1/, "");
      const data = await cargarConCacheAndroid<CatalogResponse>(
        `explorar:mundodonghua:${cacheKey}`,
        async (signal) => {
          const res = await fetch(`/api/anime/mundodonghua?${params}`, { signal });
          const respuesta = (await res.json()) as CatalogResponse;
          if (!res.ok) throw new Error(respuesta.error ?? "MundoDonghua no respondió");
          return respuesta;
        },
        {
          force: forzar,
          freshForMs: 15 * 60 * 1000,
          onCached: (guardado) => {
            if (id !== requestId.current) return;
            setSeries(guardado.series);
            setPage(guardado.page);
            setLastPage(guardado.lastPage);
          },
        }
      );
      if (id !== requestId.current) return;
      setSeries(data.series);
      setPage(data.page);
      setLastPage(data.lastPage);
    } catch (err) {
      if (id !== requestId.current) return;
      setSeries([]);
      setError(err instanceof Error ? err.message : "No se pudo cargar MundoDonghua");
    } finally {
      if (id === requestId.current) {
        fresh.current = false;
        setRefreshing(false);
      }
    }
  }, [genero, page, reload, search, status]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => {
      clearTimeout(timer);
      requestId.current++;
    };
  }, [load, search]);

  useEffect(() => {
    const key = JSON.stringify([search, status, genero]);
    if (key !== lastFilters.current) {
      lastFilters.current = key;
      setPage(1);
    }
  }, [genero, search, status]);

  useEffect(() => {
    const url = new URL(location.href);
    if (url.searchParams.get("seccion") !== "animada") return;
    for (const [key, value] of Object.entries({
      q: search,
      status,
      genre: genero,
      anime_page: String(page),
    })) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    history.replaceState(history.state, "", url);
  }, [genero, page, search, status]);

  function limpiar() {
    setStatus("");
    setGenero("");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
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
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar donghua..."
          className="ml-auto w-full max-w-sm rounded-md border border-line bg-[var(--surface-raised)] px-4 py-2.5 text-sm text-ink placeholder-subtle outline-none focus:border-accent"
        />
      </div>

      {showFilters && (
        <Surface className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="block font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">
                Estado
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="w-full rounded-md border border-line bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
              >
                {ESTADOS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="block font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">
                Género
              </span>
              <select
                value={genero}
                onChange={(event) => setGenero(event.target.value)}
                className="w-full rounded-md border border-line bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
              >
                <option value="">Todos los géneros</option>
                {GENEROS_MUNDODONGHUA.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">
              Géneros populares
            </p>
            <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto pr-2">
              {GENEROS_MUNDODONGHUA.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setGenero((curr) => (curr === value ? "" : value))}
                  className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                    genero === value
                      ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                      : "border-line text-subtle hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {activeFilters > 0 && (
            <button
              type="button"
              onClick={limpiar}
              className="font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink"
            >
              × Limpiar filtros
            </button>
          )}
        </Surface>
      )}

      {error && (
        <Surface className="p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 font-mono text-[11px] text-accent-ink"
          >
            Reintentar
          </button>
        </Surface>
      )}

      {series === null ? (
        <p className="py-16 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
          Cargando catálogo de Donghuas...
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
                prefetch={false}
                href={`/explorar/mundodonghua/${anime.slug}`}
                className={`od-catalog-card group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  estaGuardada ? "opacity-60" : ""
                }`}
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
                    <div className="grid h-full place-items-center text-[13px] text-subtle">
                      Sin portada
                    </div>
                  )}
                </div>
                <div className="px-1 pt-4">
                  <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
                    {anime.title}
                  </h3>
                  <p className="mt-1 font-mono text-[13px] text-faint">MundoDonghua</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {series && series.length > 0 && lastPage > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-md border border-line px-4 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">
            Página {page} de {lastPage}
          </span>
          <button
            type="button"
            disabled={page >= lastPage}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-md border border-line px-4 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      <p className="border-t border-line pt-6 text-center font-mono text-[11px] tracking-[0.06em] text-subtle">
        Catálogo, fichas y episodios provistos por MundoDonghua · Animación China
      </p>
    </div>
  );
}
