"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SectionHeading, Surface } from "@/components/ui/Surface";
import {
  IKIGAI_GENEROS,
  IKIGAI_ORDENES,
  IKIGAI_TIPOS,
  catalogoIkigai,
  ikigaiDisponible,
  type SerieIkigai,
} from "@/lib/ikigai";
import {
  LC_GENEROS,
  LC_INICIALES,
  LC_LISTAS,
  catalogoLc,
  type SerieLc,
} from "@/lib/leercapitulo";
import {
  TMO_DEMOGRAFIAS,
  TMO_ESTADOS,
  TMO_GENEROS,
  TMO_ORDENES,
  TMO_TIPOS,
  catalogoTmo,
  popularesTmo,
  type SerieTmo,
} from "@/lib/zonatmo";

interface ExternalSeries {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  year: number | null;
  is_adult: boolean;
  tags: string[];
  cover_url: string | null;
  chapter_count: number | null;
}

const LANGS = [
  { key: "es", label: "Español" },
  { key: "en", label: "Inglés" },
];

const ORDERS = [
  { key: "latest", label: "Novedades" },
  { key: "popular", label: "Populares" },
  { key: "rating", label: "Mejor valoradas" },
  { key: "title", label: "A–Z" },
];

const ORIGINS = [
  { key: "ja", label: "Manga" },
  { key: "ko", label: "Manhwa" },
  { key: "zh", label: "Manhua" },
];

const STATUSES = [
  { key: "ongoing", label: "En curso" },
  { key: "completed", label: "Completada" },
  { key: "hiatus", label: "En pausa" },
  { key: "cancelled", label: "Cancelada" },
];

interface SerieOlympus {
  id: number;
  slug: string;
  title: string;
  cover_url: string | null;
  status: string | null;
  chapter_count: number | null;
  type: string;
  /** Solo en "Nuevos lanzamientos": lo último que publicó Olympus. */
  ultimos?: { id: number; name: string; published_at: string }[];
}

const FUENTES = [
  { key: "mangadex", label: "MangaDex" },
  { key: "olympus", label: "Olympus" },
];

interface Genre {
  id: string;
  name: string;
}

export default function ExplorarPage() {
  const [series, setSeries] = useState<ExternalSeries[] | null>(null);
  const [lang, setLang] = useState("es");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [order, setOrder] = useState("latest");
  const [status, setStatus] = useState<string[]>([]);
  const [origin, setOrigin] = useState<string[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [fuente, setFuente] = useState("mangadex");
  const [olympus, setOlympus] = useState<SerieOlympus[] | null>(null);
  const [olympusPage, setOlympusPage] = useState(1);
  const [olympusLastPage, setOlympusLastPage] = useState(1);
  const [olyOrden, setOlyOrden] = useState("novedades");
  const [olyGenero, setOlyGenero] = useState<number | null>(null);
  const [olyEstado, setOlyEstado] = useState<number | null>(null);
  const [olyTipo, setOlyTipo] = useState<string | null>(null);
  const [tmoTipo, setTmoTipo] = useState<string | null>(null);
  const [tmoDemo, setTmoDemo] = useState<string | null>(null);
  const [tmoEstado, setTmoEstado] = useState<string | null>(null);
  const [tmoGenero, setTmoGenero] = useState<string | null>(null);
  const [tmoOrden, setTmoOrden] = useState<string | null>(null);
  const [ikiTipo, setIkiTipo] = useState<string | null>(null);
  const [ikiGenero, setIkiGenero] = useState<string | null>(null);
  const [ikiOrden, setIkiOrden] = useState("recientes");
  const [ikigaiHay, setIkigaiHay] = useState(false);
  const [lc, setLc] = useState<SerieLc[] | null>(null);
  const [lcPage, setLcPage] = useState(1);
  const [lcGenero, setLcGenero] = useState<string | null>(null);
  const [lcInicial, setLcInicial] = useState<string | null>(null);
  const [lcMas, setLcMas] = useState(false);
  const [lcPaginable, setLcPaginable] = useState(false);
  const [lcLista, setLcLista] = useState("");

  // Botón de actualizar: vuelve a pedir SOLO lo que está en pantalla, y
  // saltea la caché para que aparezcan los capítulos recién subidos.
  const [recarga, setRecarga] = useState(0);
  const [refrescando, setRefrescando] = useState(false);
  const pedirFresco = useRef(false);

  const cargarLc = useCallback(async () => {
    setError(false);
    const fresco = pedirFresco.current;
    try {
      const r = await catalogoLc(
        lcPage,
        {
          q: search.trim() || undefined,
          genero: lcGenero ?? undefined,
          inicial: lcInicial ?? undefined,
          lista: lcLista || undefined,
        },
        fresco
      );
      setLc(r.series);
      setLcMas(r.hayMas);
      setLcPaginable(r.paginable);
    } catch (err) {
      setError(true);
      setErrorDetalle(err instanceof Error ? err.message : null);
      setLc([]);
    } finally {
      pedirFresco.current = false;
      setRefrescando(false);
    }
  }, [lcPage, search, lcGenero, lcInicial, lcLista, recarga]);

  useEffect(() => {
    if (fuente !== "leercapitulo") return;
    // al refrescar no se vacía la grilla: se reemplaza cuando llega
    if (!pedirFresco.current) setLc(null);
    const t = setTimeout(cargarLc, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [cargarLc, search, fuente]);

  useEffect(() => {
    setLcPage(1);
  }, [search, fuente, lcGenero, lcInicial, lcLista]);

  const refrescar = useCallback(() => {
    pedirFresco.current = true;
    setRefrescando(true);
    setRecarga((n) => n + 1);
  }, []);

  useEffect(() => {
    setIkigaiHay(ikigaiDisponible());
  }, []);
  const [tmo, setTmo] = useState<SerieTmo[] | null>(null);
  const [tmoPage, setTmoPage] = useState(1);
  const [tmoMas, setTmoMas] = useState(false);
  const [tmoPaginas, setTmoPaginas] = useState(1);
  const [tmoPopulares, setTmoPopulares] = useState<SerieTmo[]>([]);

  // lo más leído de la semana, tal como lo publica ZonaTMO
  useEffect(() => {
    if (fuente !== "tmo" || tmoPopulares.length > 0) return;
    popularesTmo("week")
      .then(setTmoPopulares)
      .catch(() => setTmoPopulares([]));
  }, [fuente, tmoPopulares.length]);

  const cargarTmo = useCallback(async () => {
    setError(false);
    const fresco = pedirFresco.current;
    try {
      const r = await catalogoTmo(
        tmoPage,
        {
          q: search.trim() || undefined,
          tipo: tmoTipo ?? undefined,
          demografia: tmoDemo ?? undefined,
          estado: tmoEstado ?? undefined,
          genero: tmoGenero ?? undefined,
          orden: tmoOrden ?? undefined,
        },
        fresco
      );
      setTmo(r.series);
      setTmoMas(r.hayMas);
      setTmoPaginas(r.totalPaginas);
    } catch (err) {
      setError(true);
      setErrorDetalle(err instanceof Error ? err.message : null);
      setTmo([]);
    } finally {
      pedirFresco.current = false;
      setRefrescando(false);
    }
  }, [tmoPage, search, tmoTipo, tmoDemo, tmoEstado, tmoGenero, tmoOrden, recarga]);

  useEffect(() => {
    if (fuente !== "tmo") return;
    if (!pedirFresco.current) setTmo(null);
    const t = setTimeout(cargarTmo, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [cargarTmo, search, fuente]);

  useEffect(() => {
    setTmoPage(1);
  }, [search, fuente, tmoTipo, tmoDemo, tmoEstado, tmoGenero, tmoOrden]);

  const [iki, setIki] = useState<SerieIkigai[] | null>(null);
  const [ikiPage, setIkiPage] = useState(1);
  const [ikiMas, setIkiMas] = useState(false);

  const cargarIki = useCallback(async () => {
    setError(false);
    try {
      const r = await catalogoIkigai(ikiPage, {
        q: search.trim() || undefined,
        tipo: ikiTipo ?? undefined,
        genero: ikiGenero ?? undefined,
        orden: ikiOrden,
      });
      setIki(r.series);
      setIkiMas(r.hayMas);
    } catch (err) {
      setError(true);
      setErrorDetalle(err instanceof Error ? err.message : null);
      setIki([]);
    } finally {
      pedirFresco.current = false;
      setRefrescando(false);
    }
  }, [ikiPage, search, ikiTipo, ikiGenero, ikiOrden, recarga]);

  useEffect(() => {
    if (fuente !== "ikigai") return;
    if (!pedirFresco.current) setIki(null);
    const t = setTimeout(cargarIki, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [cargarIki, search, fuente]);

  useEffect(() => {
    setIkiPage(1);
  }, [search, fuente, ikiTipo, ikiGenero, ikiOrden]);

  const [olyOpciones, setOlyOpciones] = useState<{
    generos: { id: number; name: string }[];
    estados: { id: number; name: string }[];
    tipos: { id: string; name: string }[];
    ordenes: { id: string; name: string }[];
  } | null>(null);

  useEffect(() => {
    if (fuente !== "olympus" || olyOpciones) return;
    fetch("/api/externo/olympus/filtros")
      .then((r) => r.json())
      .then(setOlyOpciones)
      .catch(() => {});
  }, [fuente, olyOpciones]);

  useEffect(() => {
    fetch("/api/externo/generos")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setGenres(d))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setError(false);
    const params = new URLSearchParams({ lang, offset: String(offset), order });
    for (const o of origin) params.append("origin", o);
    for (const s of status) params.append("status", s);
    for (const g of selectedGenres) params.append("tag", g);
    if (search.trim()) params.set("q", search.trim());
    const fresco = pedirFresco.current;
    try {
      const res = await fetch(`/api/externo/series?${params}`, {
        cache: fresco ? "no-store" : "default",
      });
      if (!res.ok) throw new Error("fallo");
      const data = await res.json();
      setSeries(data.series);
      setTotal(data.total);
    } catch {
      setError(true);
      setSeries([]);
    } finally {
      pedirFresco.current = false;
      setRefrescando(false);
    }
  }, [lang, search, offset, order, status, selectedGenres, origin, recarga]);

  useEffect(() => {
    if (fuente !== "mangadex") return;
    if (!pedirFresco.current) setSeries(null);
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search, fuente]);

  const cargarOlympus = useCallback(async () => {
    setError(false);
    const params = new URLSearchParams({ page: String(olympusPage), orden: olyOrden });
    if (search.trim()) params.set("q", search.trim());
    if (olyGenero) params.set("genero", String(olyGenero));
    if (olyEstado) params.set("estado", String(olyEstado));
    if (olyTipo) params.set("tipo", olyTipo);
    const fresco = pedirFresco.current;
    try {
      const res = await fetch(`/api/externo/olympus/series?${params}`, {
        cache: fresco ? "no-store" : "default",
      });
      if (!res.ok) throw new Error("fallo");
      const data = await res.json();
      setOlympus(data.series);
      setOlympusLastPage(data.last_page);
    } catch {
      setError(true);
      setOlympus([]);
    } finally {
      pedirFresco.current = false;
      setRefrescando(false);
    }
  }, [olympusPage, search, olyOrden, olyGenero, olyEstado, olyTipo, recarga]);

  useEffect(() => {
    if (fuente !== "olympus") return;
    if (!pedirFresco.current) setOlympus(null);
    const t = setTimeout(cargarOlympus, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [cargarOlympus, search, fuente]);

  useEffect(() => {
    setOlympusPage(1);
  }, [search, fuente, olyOrden, olyGenero, olyEstado, olyTipo]);

  // cambiar cualquier filtro vuelve a la primera página
  useEffect(() => {
    setOffset(0);
  }, [lang, search, order, status, selectedGenres, origin]);

  function toggleIn(list: string[], value: string, set: (v: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const activeFilters = status.length + selectedGenres.length + origin.length;

  const page = Math.floor(offset / 24) + 1;
  const lastPage = Math.max(1, Math.ceil(Math.min(total, 9500) / 24));

  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow="Catálogo externo"
        title="Explorar"
        description="Series publicadas por grupos de scanlation en MangaDex. Se leen acá mismo, con tu progreso guardado."
      />

      {/* fuente: cada grupo publica su propio catálogo */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
          Fuente
        </span>
        {[
          ...FUENTES,
          { key: "tmo", label: "ZonaTMO" },
          { key: "leercapitulo", label: "LeerCapítulo" },
          // Ikigai sí necesita el puente nativo: bloquea a los centros de datos
          ...(ikigaiHay ? [{ key: "ikigai", label: "Ikigai" }] : []),
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFuente(f.key)}
            className={`rounded-xl border px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition ${
              fuente === f.key
                ? "border-accent bg-[var(--accent-soft)] text-accent"
                : "border-line text-subtle hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {fuente === "mangadex" && (
        <div className="flex gap-1 rounded-xl border border-line bg-[var(--surface-raised)] p-1">
          {LANGS.map((l) => (
            <button
              key={l.key}
              onClick={() => setLang(l.key)}
              className={`rounded-lg px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                lang === l.key ? "bg-accent text-[var(--bg)]" : "text-subtle hover:text-ink"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        )}
        {fuente === "mangadex" && (
        <select
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          disabled={Boolean(search.trim())}
          className="rounded-xl border border-line bg-[var(--surface-raised)] px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink outline-none focus:border-accent disabled:opacity-40"
          title={search.trim() ? "Al buscar, el orden es por relevancia" : "Ordenar por"}
        >
          {ORDERS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        )}
        {fuente === "mangadex" && (
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
        )}

        {fuente === "olympus" && olyOpciones && (
          <>
            <select
              value={olyOrden}
              onChange={(e) => setOlyOrden(e.target.value)}
              className="rounded-xl border border-line bg-[var(--surface-raised)] px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink outline-none focus:border-accent"
            >
              {olyOpciones.ordenes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`rounded-xl border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                olyGenero || olyEstado || olyTipo
                  ? "border-accent bg-[var(--accent-soft)] text-accent"
                  : "border-line text-subtle hover:text-ink"
              }`}
            >
              Filtros{" "}
              {[olyGenero, olyEstado, olyTipo].filter(Boolean).length > 0
                ? `(${[olyGenero, olyEstado, olyTipo].filter(Boolean).length})`
                : ""}
            </button>
          </>
        )}

        {fuente === "ikigai" && (
          <select
            value={ikiOrden}
            onChange={(e) => setIkiOrden(e.target.value)}
            className="rounded-xl border border-line bg-[var(--surface-raised)] px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink outline-none focus:border-accent"
          >
            {IKIGAI_ORDENES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}

        {fuente === "leercapitulo" && (
          <select
            value={lcLista}
            onChange={(e) => setLcLista(e.target.value)}
            className="rounded-xl border border-line bg-[var(--surface-raised)] px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink outline-none focus:border-accent"
          >
            {LC_LISTAS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}

        {fuente === "tmo" && (
          <select
            value={tmoOrden ?? ""}
            onChange={(e) => setTmoOrden(e.target.value || null)}
            className="rounded-xl border border-line bg-[var(--surface-raised)] px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink outline-none focus:border-accent"
          >
            {TMO_ORDENES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}

        {(fuente === "tmo" || fuente === "ikigai" || fuente === "leercapitulo") && (
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`rounded-xl border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition ${
              (fuente === "tmo"
                ? tmoTipo || tmoDemo || tmoEstado || tmoGenero
                : fuente === "leercapitulo"
                  ? lcGenero || lcInicial
                  : ikiTipo || ikiGenero)
                ? "border-accent bg-[var(--accent-soft)] text-accent"
                : "border-line text-subtle hover:text-ink"
            }`}
          >
            Filtros
          </button>
        )}

        <button
          onClick={refrescar}
          disabled={refrescando}
          title="Volver a pedir esta lista, sin usar lo guardado"
          className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-60"
          data-od-id="boton-actualizar"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 fill-current ${refrescando ? "animate-spin" : ""}`}
            aria-hidden="true"
          >
            <path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
          </svg>
          {refrescando ? "Actualizando" : "Actualizar"}
        </button>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar serie..."
          className="ml-auto w-full max-w-sm rounded-xl border border-line bg-[var(--surface-raised)] px-4 py-2.5 text-sm text-ink placeholder-subtle outline-none focus:border-accent"
        />
      </div>

      {showFilters && fuente === "mangadex" && (
        <Surface className="space-y-5 p-5">
          <div>
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
              Tipo
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ORIGINS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => toggleIn(origin, o.key, setOrigin)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    origin.includes(o.key)
                      ? "border-accent bg-[var(--accent-soft)] text-accent"
                      : "border-line text-subtle hover:text-ink"
                  }`}
                >
                  {o.label}
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
                  onClick={() => toggleIn(status, s.key, setStatus)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    status.includes(s.key)
                      ? "border-accent bg-[var(--accent-soft)] text-accent"
                      : "border-line text-subtle hover:text-ink"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {genres.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
                Géneros
              </p>
              <div className="flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => toggleIn(selectedGenres, g.id, setSelectedGenres)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      selectedGenres.includes(g.id)
                        ? "border-accent bg-[var(--accent-soft)] text-accent"
                        : "border-line text-subtle hover:text-ink"
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeFilters > 0 && (
            <button
              onClick={() => {
                setStatus([]);
                setSelectedGenres([]);
                setOrigin([]);
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
          {errorDetalle ?? "No se pudo conectar con el catálogo externo. Intentá de nuevo en un momento."}
        </Surface>
      )}

      {fuente === "mangadex" && (series === null ? (
        <p className="py-16 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
          Cargando catálogo...
        </p>
      ) : series.length === 0 && !error ? (
        <Surface className="p-12 text-center">
          <p className="text-lg font-bold text-ink">Sin resultados</p>
          <p className="mt-1 text-sm text-subtle">Probá con otro término o cambiá el idioma.</p>
        </Surface>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {series.map((s) => (
            <Link
              key={s.id}
              href={`/externo/${s.id}`}
              className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
                {s.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.cover_url}
                    alt={s.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
                    Sin portada
                  </div>
                )}
                {s.is_adult && (
                  <span className="absolute left-3 top-3 rounded-full border border-danger bg-[color-mix(in_oklch,var(--bg)_82%,transparent)] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-danger backdrop-blur-md">
                    +18
                  </span>
                )}
              </div>
              <div className="px-1 pt-4">
                <h3 className="line-clamp-2 text-lg font-bold leading-[1.12] text-ink transition group-hover:text-accent">
                  {s.title}
                </h3>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                  {[
                    s.chapter_count !== null
                      ? `${s.chapter_count} cap${s.chapter_count === 1 ? "" : "s"}.`
                      : null,
                    s.status,
                    s.year,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ))}

      {fuente === "mangadex" && series !== null && series.length > 0 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 24))}
            className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
            Página {page} de {lastPage}
          </span>
          <button
            disabled={page >= lastPage}
            onClick={() => setOffset(offset + 24)}
            className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      {showFilters && fuente === "olympus" && olyOpciones && (
        <Surface className="space-y-5 p-5">
          <div>
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
              Tipo
            </p>
            <div className="flex flex-wrap gap-1.5">
              {olyOpciones.tipos.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOlyTipo(olyTipo === t.id ? null : t.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    olyTipo === t.id
                      ? "border-accent bg-[var(--accent-soft)] text-accent"
                      : "border-line text-subtle hover:text-ink"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
              Estado
            </p>
            <div className="flex flex-wrap gap-1.5">
              {olyOpciones.estados.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setOlyEstado(olyEstado === e.id ? null : e.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    olyEstado === e.id
                      ? "border-accent bg-[var(--accent-soft)] text-accent"
                      : "border-line text-subtle hover:text-ink"
                  }`}
                >
                  {e.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
              Género <span className="normal-case opacity-70">(uno por vez)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {olyOpciones.generos.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setOlyGenero(olyGenero === g.id ? null : g.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    olyGenero === g.id
                      ? "border-accent bg-[var(--accent-soft)] text-accent"
                      : "border-line text-subtle hover:text-ink"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {(olyGenero || olyEstado || olyTipo) && (
            <button
              onClick={() => {
                setOlyGenero(null);
                setOlyEstado(null);
                setOlyTipo(null);
              }}
              className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-accent"
            >
              ✕ Limpiar filtros
            </button>
          )}
        </Surface>
      )}

      {fuente === "olympus" && (
        olympus === null ? (
          <p className="py-16 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
            Cargando catálogo de Olympus...
          </p>
        ) : olympus.length === 0 && !error ? (
          <Surface className="p-12 text-center">
            <p className="text-lg font-bold text-ink">Sin resultados</p>
            <p className="mt-1 text-sm text-subtle">Probá con otro término.</p>
          </Surface>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
              {olympus.map((s) => (
                <Link
                  key={s.id}
                  href={`/externo/olympus/${s.slug}`}
                  className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
                    {s.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.cover_url}
                        alt={s.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className="px-1 pt-4">
                    <h3 className="line-clamp-2 text-lg font-bold leading-[1.12] text-ink transition group-hover:text-accent">
                      {s.title}
                    </h3>
                    <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                      {[
                        s.ultimos?.length
                          ? `Cap. ${s.ultimos[0].name}`
                          : s.chapter_count !== null
                            ? `${s.chapter_count} caps.`
                            : null,
                        s.status,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {olympusLastPage > 1 && (
              <div className="flex items-center justify-center gap-3 pt-8">
                <button
                  disabled={olympusPage <= 1}
                  onClick={() => setOlympusPage(olympusPage - 1)}
                  className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
                  Página {olympusPage} de {olympusLastPage}
                </span>
                <button
                  disabled={olympusPage >= olympusLastPage}
                  onClick={() => setOlympusPage(olympusPage + 1)}
                  className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )
      )}

      {showFilters && (fuente === "tmo" || fuente === "ikigai" || fuente === "leercapitulo") && (
        <Surface className="space-y-5 p-5">
          {(fuente === "leercapitulo"
            ? [
                { titulo: "Género", opciones: LC_GENEROS, valor: lcGenero, set: setLcGenero },
                { titulo: "Inicial", opciones: LC_INICIALES, valor: lcInicial, set: setLcInicial },
              ]
            : fuente === "tmo"
            ? [
                { titulo: "Tipo", opciones: TMO_TIPOS, valor: tmoTipo, set: setTmoTipo },
                { titulo: "Género", opciones: TMO_GENEROS, valor: tmoGenero, set: setTmoGenero },
                { titulo: "Demografía", opciones: TMO_DEMOGRAFIAS, valor: tmoDemo, set: setTmoDemo },
                { titulo: "Estado", opciones: TMO_ESTADOS, valor: tmoEstado, set: setTmoEstado },
              ]
            : [
                { titulo: "Tipo", opciones: IKIGAI_TIPOS, valor: ikiTipo, set: setIkiTipo },
                { titulo: "Género", opciones: IKIGAI_GENEROS, valor: ikiGenero, set: setIkiGenero },
              ]
          ).map((grupo) => (
            <div key={grupo.titulo}>
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
                {grupo.titulo}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {grupo.opciones.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => grupo.set(grupo.valor === o.id ? null : o.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      grupo.valor === o.id
                        ? "border-accent bg-[var(--accent-soft)] text-accent"
                        : "border-line text-subtle hover:text-ink"
                    }`}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={() => {
              setTmoTipo(null);
              setTmoDemo(null);
              setTmoEstado(null);
              setTmoGenero(null);
              setIkiTipo(null);
              setIkiGenero(null);
              setLcGenero(null);
              setLcInicial(null);
            }}
            className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-accent"
          >
            ✕ Limpiar filtros
          </button>
        </Surface>
      )}

      {fuente === "tmo" &&
        tmoPopulares.length > 0 &&
        tmoPage === 1 &&
        !search &&
        !tmoTipo &&
        !tmoGenero &&
        !tmoDemo &&
        !tmoEstado && (
          <section>
            <h2 className="mb-4 font-display text-xl font-black uppercase tracking-[-0.03em] text-ink">
              Lo más leído esta semana
            </h2>
            <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
              {tmoPopulares.map((t) => (
                <Link
                  key={t.id}
                  href={`/externo/tmo/${t.tipo}/${t.id}/${t.slug}`}
                  className="group w-32 shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-36"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-accent">
                    {t.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.cover_url}
                        alt={t.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-tight text-ink transition group-hover:text-accent">
                    {t.title}
                  </h3>
                </Link>
              ))}
            </div>
          </section>
        )}

      {fuente === "leercapitulo" && (
        lc === null ? (
          <p className="py-16 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
            Cargando catálogo de LeerCapítulo...
          </p>
        ) : lc.length === 0 ? (
          <Surface className="p-12 text-center">
            <p className="text-lg font-bold text-ink">Sin resultados</p>
            <p className="mt-1 text-sm text-subtle">Probá con otro término o género.</p>
          </Surface>
        ) : (
          <>
            {!lcPaginable && !search && (
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
                Últimas actualizaciones · elegí un género o una inicial para recorrer todo
              </p>
            )}
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
              {lc.map((t) => (
                <Link
                  key={t.id}
                  href={`/externo/leercapitulo/${t.id}/${t.slug}`}
                  className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
                    {t.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.cover_url}
                        alt={t.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <h3 className="mt-3 line-clamp-2 px-1 text-lg font-bold leading-[1.12] text-ink transition group-hover:text-accent">
                    {t.title}
                  </h3>
                </Link>
              ))}
            </div>

            {lcPaginable && (
              <div className="flex items-center justify-center gap-3 pt-8">
                <button
                  disabled={lcPage <= 1}
                  onClick={() => setLcPage(lcPage - 1)}
                  className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
                  Página {lcPage}
                </span>
                <button
                  disabled={!lcMas}
                  onClick={() => setLcPage(lcPage + 1)}
                  className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )
      )}

      {fuente === "tmo" && (
        tmo === null ? (
          <p className="py-16 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
            Cargando catálogo de ZonaTMO...
          </p>
        ) : tmo.length === 0 ? (
          <Surface className="p-12 text-center">
            <p className="text-lg font-bold text-ink">Sin resultados</p>
            <p className="mt-1 text-sm text-subtle">Probá con otro término.</p>
          </Surface>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
              {tmo.map((t) => (
                <Link
                  key={t.id}
                  href={`/externo/tmo/${t.tipo}/${t.id}/${t.slug}`}
                  className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
                    {t.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.cover_url}
                        alt={t.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className="px-1 pt-4">
                    <h3 className="line-clamp-2 text-lg font-bold leading-[1.12] text-ink transition group-hover:text-accent">
                      {t.title}
                    </h3>
                    <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                      {t.tipo}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3 pt-8">
              <button
                disabled={tmoPage <= 1}
                onClick={() => setTmoPage(tmoPage - 1)}
                className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
                Página {tmoPage} de {tmoPaginas}
              </span>
              <button
                disabled={!tmoMas}
                onClick={() => setTmoPage(tmoPage + 1)}
                className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </>
        )
      )}

      {fuente === "ikigai" && (
        iki === null ? (
          <p className="py-16 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
            Cargando catálogo de Ikigai...
          </p>
        ) : iki.length === 0 ? (
          <Surface className="p-12 text-center">
            <p className="text-lg font-bold text-ink">Sin resultados</p>
            <p className="mt-1 text-sm text-subtle">Probá con otro término.</p>
          </Surface>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
              {iki.map((s) => (
                <Link
                  key={s.slug}
                  href={`/externo/ikigai/${s.slug}`}
                  className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
                    {s.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.cover_url}
                        alt={s.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className="px-1 pt-4">
                    <h3 className="line-clamp-2 text-lg font-bold leading-[1.12] text-ink transition group-hover:text-accent">
                      {s.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3 pt-8">
              <button
                disabled={ikiPage <= 1}
                onClick={() => setIkiPage(ikiPage - 1)}
                className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
                Página {ikiPage}
              </span>
              <button
                disabled={!ikiMas}
                onClick={() => setIkiPage(ikiPage + 1)}
                className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </>
        )
      )}

      <p className="border-t border-line pt-6 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
        Catálogo y capítulos provistos por MangaDex y sus grupos de scanlation
      </p>
    </div>
  );
}
