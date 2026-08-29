"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SeriesCard, type SeriesSummary } from "@/components/library/SeriesCard";
import { buttonStyles } from "@/components/ui/Button";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { fieldControlClass } from "@/components/ui/Field";
import { SectionHeading, Surface } from "@/components/ui/Surface";
import { buscarNovedades, type Novedad } from "@/components/library/novedades";
import { SeccionAnimadas } from "@/components/library/SeccionAnimadas";
import { SeccionAnimeExterno } from "@/components/library/SeccionAnimeExterno";
import { SeccionHistorial } from "@/components/library/SeccionHistorial";
import { isAndroidApp } from "@/lib/appVersion";

interface ContinueItem {
  series: { id: number; title: string; slug: string; type: string; cover_image_path: string | null };
  chapter: { id: number; number: number; page_count: number };
  lastPageNumber: number;
}

interface Me {
  nickname?: string;
  show_adult_content?: boolean;
  anime_enabled?: boolean;
}

interface SerieGuardada {
  source: string;
  external_id: string;
  slug: string | null;
  title: string;
  cover_url: string | null;
  type: string | null;
  last_chapter_name: string | null;
  last_page_number: number | null;
  href: string;
  /** Al capítulo y la página donde quedó, no a la ficha. */
  href_continuar: string;
}

interface TagChip {
  id: number;
  name: string;
  slug: string;
  series_count: number;
}

type Filter = "normal" | "adult" | "favoritos";

export default function BibliotecaPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [series, setSeries] = useState<SeriesSummary[] | null>(null);
  const [seriesError, setSeriesError] = useState(false);
  const [continues, setContinues] = useState<ContinueItem[]>([]);
  const [filter, setFilter] = useState<Filter>("normal");
  const [seccion, setSeccion] = useState<"lectura" | "animelist" | "anime-animado">("lectura");
  const [animeAnimadoHabilitado, setAnimeAnimadoHabilitado] = useState(false);
  const [search, setSearch] = useState("");
  const [tags, setTags] = useState<TagChip[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [guardadas, setGuardadas] = useState<SerieGuardada[]>([]);
  const [novedades, setNovedades] = useState<Record<string, Novedad>>({});
  const [revisando, setRevisando] = useState(false);
  const [avance, setAvance] = useState({ hechas: 0, total: 0 });

  const loggedIn = Boolean(me?.nickname);

  // Las categorías siguen a la pestaña, y solo se muestran dentro de
  // "Normal" o "+18". En "Todo" no aparecen: ahí las del +18 quedaban a la
  // vista de cualquiera, que no es donde corresponde.
  useEffect(() => {
    const qs = `?tipo=${filter === "adult" ? "adult" : "normal"}`;
    fetch(`/api/tags${qs}`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setTags(d))
      .catch(() => {});
  }, [filter]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const actual = d ?? {};
        setMe(actual);
        const permitido = !isAndroidApp() || Boolean(actual.anime_enabled);
        setAnimeAnimadoHabilitado(permitido);
        if (!permitido) {
          setSeccion((valor) => (valor === "anime-animado" ? "lectura" : valor));
        }
      })
      .catch(() => setMe({}));
    fetch("/api/progress/continue")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setContinues(d))
      .catch(() => {});
    fetch("/api/externo/biblioteca")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => Array.isArray(d) && setGuardadas(d))
      .catch(() => {});
    // restaurar el estado desde la URL: pestaña activa, tag y búsqueda
    // (así "atrás" desde una serie vuelve a la misma sección)
    const params = new URLSearchParams(window.location.search);
    const urlSeccion = params.get("s");
    if (urlSeccion === "animadas" || urlSeccion === "animelist") setSeccion("animelist");
    if (urlSeccion === "anime-animado") setSeccion("anime-animado");
    const urlFilter = params.get("f");
    if (urlFilter && ["normal", "adult", "favoritos"].includes(urlFilter)) {
      setFilter(urlFilter as Filter);
    }
    const urlTag = params.get("tag");
    if (urlTag) setSelectedTag(urlTag);
    const urlSearch = params.get("q");
    if (urlSearch) setSearch(urlSearch);
    setRestored(true);
  }, []);

  // reflejar el estado en la URL (replaceState: no ensucia el historial)
  useEffect(() => {
    if (!restored) return;
    const url = new URL(window.location.href);
    if (seccion !== "lectura") url.searchParams.set("s", seccion);
    else url.searchParams.delete("s");
    if (filter !== "normal") url.searchParams.set("f", filter);
    else url.searchParams.delete("f");
    if (selectedTag) url.searchParams.set("tag", selectedTag);
    else url.searchParams.delete("tag");
    if (search.trim()) url.searchParams.set("q", search.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url.toString());
  }, [restored, seccion, filter, selectedTag, search]);

  // el filtro por tag muestra catálogo aunque la pestaña sea "Todo"

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter === "normal" || filter === "adult") params.set("type", filter);
    if (filter === "favoritos") params.set("favorites", "true");
    if (search.trim()) params.set("search", search.trim());
    if (selectedTag) params.set("tag", selectedTag);
    setSeriesError(false);
    try {
      const res = await fetch(`/api/series?${params}`);
      if (!res.ok) throw new Error("catalog");
      setSeries(await res.json());
    } catch {
      setSeries([]);
      setSeriesError(true);
    }
  }, [filter, search, selectedTag]);

  // Revisa todas las series guardadas y pone adelante las que sacaron
  // capítulo nuevo desde la última vez que las leíste.
  async function actualizarTodo() {
    if (revisando || guardadas.length === 0) return;
    setRevisando(true);
    setAvance({ hechas: 0, total: guardadas.length });
    try {
      const r = await buscarNovedades(guardadas, (hechas, total) => setAvance({ hechas, total }));
      setNovedades(r);
    } finally {
      setRevisando(false);
    }
  }

  const claveDe = (g: SerieGuardada) => `${g.source}-${g.external_id}`;

  // primero las que tienen capítulos sin leer, de mayor a menor
  const guardadasOrdenadas = [...guardadas].sort((a, b) => {
    const sa = novedades[claveDe(a)]?.sinLeer ?? 0;
    const sb = novedades[claveDe(b)]?.sinLeer ?? 0;
    return sb - sa;
  });

  function toggleTag(slug: string) {
    setSelectedTag(selectedTag === slug ? null : slug);
  }

  // en Normal/+18 se acota a esa sección; en Todo y Favoritos se ve completo
  const continuesVisible =
    filter === "normal" || filter === "adult"
      ? continues.filter((c) => c.series.type === filter)
      : continues;

  // Las series de otras fuentes también son lecturas empezadas: van en la
  // misma fila, después de las propias. En Favoritos y +18 no aplican,
  // porque esas pestañas son del catálogo propio.
  const externasEmpezadas =
    filter === "favoritos" || filter === "adult"
      ? []
      : guardadas.filter((g) => g.last_chapter_name);

  const hayQueContinuar = continuesVisible.length + externasEmpezadas.length > 0;

  useEffect(() => {
    setSeries(null);
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search, filter, selectedTag]);

  const filters: { key: Filter; label: string }[] = [
    { key: "normal", label: "Normal" },
    ...(me?.show_adult_content ? [{ key: "adult" as Filter, label: "+18" }] : []),
    ...(loggedIn ? [{ key: "favoritos" as Filter, label: "Favoritos" }] : []),
  ];

  return (
    <div className="space-y-12 sm:space-y-16" data-od-id="library-page">
      <SectionHeading
        eyebrow="Catálogo MangaTotal"
        title="Biblioteca"
        description="Explorá tus series, retomá lecturas y encontrá contenido por categoría."
      />
      {/* Lectura, AniList y fuentes animadas se guardan por separado. */}
      <div className="flex gap-1" role="tablist" aria-label="Tipo de biblioteca">
        {([
          { key: "lectura", label: "Series de lectura" },
          { key: "animelist" as const, label: "AnimeList" },
          ...(animeAnimadoHabilitado
            ? [{ key: "anime-animado" as const, label: "Anime animado" }]
            : []),
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setSeccion(t.key)}
            role="tab"
            aria-selected={seccion === t.key}
            className={`min-h-11 rounded-xl px-5 text-[11px] font-bold uppercase tracking-[0.12em] transition ${
              seccion === t.key
                ? "bg-accent text-[var(--bg)] shadow-[var(--glow)]"
                : "border border-line text-subtle hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {seccion === "animelist" ? (
        <SeccionAnimadas busqueda={search} />
      ) : seccion === "anime-animado" && animeAnimadoHabilitado ? (
        <SeccionAnimeExterno busqueda={search} />
      ) : (
       <>
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-3 sm:flex-row sm:items-center" data-od-id="library-controls">
        <div
          className="flex min-w-0 gap-1 overflow-x-auto"
          role="tablist"
          aria-label="Secciones de biblioteca"
        >
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`relative min-h-11 shrink-0 rounded-xl px-4 text-[11px] font-bold uppercase tracking-[0.12em] transition ${
                filter === f.key
                  ? "bg-[var(--accent-soft)] text-accent shadow-[var(--glow)] ring-1 ring-accent"
                  : "text-subtle hover:bg-[var(--surface-raised)] hover:text-ink"
              }`}
              role="tab"
              aria-selected={filter === f.key}
              data-od-id={`library-filter-${f.key}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar serie…"
          className={`min-w-0 sm:ml-auto sm:max-w-sm ${fieldControlClass}`}
          aria-label="Buscar serie"
          data-od-id="library-search"
        />
      </section>

      {/* Historial: lo que abriste para leer y no llegaste a guardar */}
      {loggedIn && <SeccionHistorial />}

      {/* Categorías: solo dentro de Normal o +18, nunca en Todo */}
      {tags.length > 0 && (filter === "normal" || filter === "adult") && (
        <section id="categorias" className="scroll-mt-28" data-od-id="library-tags">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <h2 className="min-w-0 font-display text-3xl font-black uppercase leading-none text-ink sm:text-4xl">
              Categorías
            </h2>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
              Explorar
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-panel p-4">
            {tags.map((t) => (
              <button
                key={t.id}
                onClick={() => toggleTag(t.slug)}
                className={`min-h-9 border px-3 text-xs transition ${
                  selectedTag === t.slug
                    ? "border-accent bg-[var(--accent-soft)] text-accent shadow-[var(--glow)]"
                    : "border-line bg-transparent text-subtle hover:border-accent hover:text-ink"
                }`}
                aria-pressed={selectedTag === t.slug}
              >
                {t.name} <span className="font-mono opacity-70">{t.series_count}</span>
              </button>
            ))}
            {selectedTag && (
              <button
                onClick={() => toggleTag(selectedTag)}
                className={buttonStyles({ variant: "ghost", size: "sm" })}
              >
                Limpiar
              </button>
            )}
          </div>
        </section>
      )}

      {/* Continuar leyendo */}
      {loggedIn && hayQueContinuar && (
        <section data-od-id="continue-reading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <h2 className="min-w-0 font-display text-3xl font-black uppercase leading-none text-ink sm:text-4xl">
              Continuar leyendo
            </h2>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
              Tu progreso
            </span>
          </div>
          <div
            className="flex min-w-0 gap-5 overflow-x-auto rounded-2xl border border-line bg-panel p-5"
            data-od-id="continue-reading-list"
          >
            {continuesVisible.map((c) => (
              <Link
                key={c.series.id}
                href={`/leer/${c.chapter.id}?page=${c.lastPageNumber}`}
                className="group w-40 shrink-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-xl bg-[var(--surface-raised)] ring-1 ring-line transition group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
                  {c.series.cover_image_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/images/${c.series.cover_image_path}`}
                      alt={c.series.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="pt-3">
                  <p className="truncate font-display text-lg font-semibold text-ink">{c.series.title}</p>
                  <p className="mt-1 font-mono text-[10px] text-subtle">
                    Cap. {c.chapter.number} · pág. {c.lastPageNumber}/{c.chapter.page_count}
                  </p>
                </div>
              </Link>
            ))}

            {externasEmpezadas.map((g) => (
              <Link
                key={`${g.source}-${g.external_id}`}
                href={g.href_continuar}
                className="group w-40 shrink-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[var(--surface-raised)] ring-1 ring-line transition group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
                  {g.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.cover_url}
                      alt={g.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-[color-mix(in_oklch,var(--bg)_75%,transparent)] px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-ink backdrop-blur">
                    {g.source}
                  </span>
                </div>
                <div className="pt-3">
                  <p className="truncate font-display text-lg font-semibold text-ink">{g.title}</p>
                  <p className="mt-1 font-mono text-[10px] text-subtle">
                    Cap. {g.last_chapter_name}
                    {g.last_page_number && g.last_page_number > 1
                      ? ` · pág. ${g.last_page_number}`
                      : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

        {!loggedIn && (
          <Surface className="grid gap-5 border-accent p-6 shadow-[var(--glow)] sm:grid-cols-[1fr_auto] sm:items-center" data-od-id="guest-library-callout">
            <p className="text-sm text-subtle">
              <Link href="/registro" className="font-bold text-ink underline underline-offset-4">
                Creá tu cuenta
              </Link>{" "}
              o{" "}
              <Link href="/login" className="font-bold text-ink underline underline-offset-4">
                iniciá sesión
              </Link>{" "}
              para leer, guardar tu progreso y marcar favoritos.
            </p>
            <Link href="/registro" className={buttonStyles({ variant: "primary", size: "sm" })}>
              Crear cuenta
            </Link>
          </Surface>
        )}

      {loggedIn && guardadas.length > 0 && filter === "normal" && (
        <section data-od-id="library-external">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <h2 className="min-w-0 font-display text-3xl font-black uppercase leading-none text-ink sm:text-4xl">
              Guardadas de otras fuentes
            </h2>
            <button
              onClick={actualizarTodo}
              disabled={revisando}
              title="Revisa todas tus series guardadas y adelanta las que tienen capítulos nuevos"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-60"
              data-od-id="actualizar-todo"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-3.5 w-3.5 fill-current ${revisando ? "animate-spin" : ""}`}
                aria-hidden="true"
              >
                <path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
              </svg>
              {revisando ? `Revisando ${avance.hechas}/${avance.total}` : "Actualizar todo"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {guardadasOrdenadas.map((g) => (
              <Link
                key={`${g.source}-${g.external_id}`}
                href={g.href}
                className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
                  {g.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.cover_url}
                      alt={g.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-[color-mix(in_oklch,var(--bg)_86%,transparent)] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-accent backdrop-blur-md">
                    {g.source}
                  </span>
                  {(novedades[claveDe(g)]?.sinLeer ?? 0) > 0 && (
                    <span className="absolute right-3 top-3 rounded-full bg-accent px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--bg)]">
                      +{novedades[claveDe(g)].sinLeer}
                    </span>
                  )}
                </div>
                <div className="px-1 pt-4">
                  <h3 className="line-clamp-2 text-lg font-bold leading-[1.12] text-ink transition group-hover:text-accent">
                    {g.title}
                  </h3>
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                    {g.last_chapter_name ? `Vas por el cap. ${g.last_chapter_name}` : "Sin empezar"}
                    {novedades[claveDe(g)]?.ultimo
                      ? ` · último ${novedades[claveDe(g)].ultimo}`
                      : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section data-od-id="library-catalog">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <h2 className="min-w-0 font-display text-3xl font-black uppercase leading-none text-ink sm:text-4xl">
              Catálogo
            </h2>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
              MangaTotal
            </span>
          </div>

          {series === null ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 xl:grid-cols-5" aria-label="Cargando catálogo">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="aspect-[2/3]" />
              ))}
            </div>
          ) : seriesError ? (
            <EmptyState
              title="No se pudo cargar el catálogo"
              description="Revisá la conexión con la base de datos y volvé a intentarlo."
              action={
                <button type="button" onClick={load} className={buttonStyles({ variant: "secondary" })}>
                  Reintentar
                </button>
              }
            />
          ) : series.length === 0 ? (
            <div className="border border-dashed border-line bg-panel py-16 text-center text-subtle">
              {filter === "favoritos" ? (
                <>
                  <p className="mb-1 text-lg">Todavía no tenés favoritos</p>
                  <p className="text-sm">Marcá una serie con ★ y va a quedar guardada acá.</p>
                </>
              ) : (
                <>
                  <p className="mb-1 text-lg">No hay series en esta sección</p>
                  <p className="text-sm">Pronto se va a agregar contenido nuevo.</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 xl:grid-cols-5" data-od-id="series-grid">
              {series.map((s) => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </div>
          )}
      </section>
       </>
      )}
    </div>
  );
}
