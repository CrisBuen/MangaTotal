"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SeriesCard, type SeriesSummary } from "@/components/library/SeriesCard";
import { buttonStyles } from "@/components/ui/Button";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { fieldControlClass } from "@/components/ui/Field";
import { SectionHeading, Surface } from "@/components/ui/Surface";
import { Chip } from "@/components/ui/Chip";
import { buscarNovedades, type Novedad } from "@/components/library/novedades";
import { SeccionAnimadas } from "@/components/library/SeccionAnimadas";
import { SeccionAnimeExterno } from "@/components/library/SeccionAnimeExterno";
import { SeccionHistorial } from "@/components/library/SeccionHistorial";
import { isAndroidApp } from "@/lib/appVersion";
import {
  borrarCachePrivadaAndroid,
  cargarConCacheAndroid,
  fetchConLimiteAndroid,
  guardarCacheAndroid,
  leerCacheAndroid,
} from "@/lib/androidCache";

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
    cargarConCacheAndroid<TagChip[]>(
      `biblioteca:tags:${qs}`,
      async (signal) => {
        const r = await fetch(`/api/tags${qs}`, { signal });
        if (!r.ok) throw new Error("tags");
        return r.json();
      },
      {
        privateData: true,
        freshForMs: 12 * 60 * 60 * 1000,
        onCached: setTags,
      }
    )
      .then((d) => Array.isArray(d) && setTags(d))
      .catch(() => {});
  }, [filter]);

  useEffect(() => {
    const aplicarMe = (actual: Me) => {
        setMe(actual);
        const permitido = !isAndroidApp() || Boolean(actual.anime_enabled);
        setAnimeAnimadoHabilitado(permitido);
        if (!permitido) {
          setSeccion((valor) => (valor === "anime-animado" ? "lectura" : valor));
        }
    };

    void (async () => {
      const guardada = await leerCacheAndroid<Me>("sesion:me", {
        privateData: true,
        maxAgeMs: 30 * 24 * 60 * 60 * 1000,
      });
      if (guardada) aplicarMe(guardada.value);

      try {
        const r = await fetchConLimiteAndroid("/api/auth/me", {}, 8_000);
        if (r.status === 401) {
          await borrarCachePrivadaAndroid();
          aplicarMe({});
          return;
        }
        if (!r.ok) throw new Error("sesion");
        const actual = (await r.json()) as Me;
        aplicarMe(actual);
        await guardarCacheAndroid("sesion:me", actual, { privateData: true });
      } catch {
        // Un corte de señal no cierra la sesión. Si había copia local se
        // conserva; si no, se espera a poder comprobarla de verdad.
      }
    })();

    cargarConCacheAndroid<ContinueItem[]>(
      "biblioteca:continuar",
      async (signal) => {
        const r = await fetch("/api/progress/continue", { signal });
        if (!r.ok) throw new Error("continuar");
        return r.json();
      },
      { privateData: true, onCached: setContinues }
    )
      .then((d) => Array.isArray(d) && setContinues(d))
      .catch(() => {});

    cargarConCacheAndroid<SerieGuardada[]>(
      "biblioteca:externas",
      async (signal) => {
        const r = await fetch("/api/externo/biblioteca", { signal });
        if (!r.ok) throw new Error("externas");
        return r.json();
      },
      { privateData: true, onCached: setGuardadas }
    )
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
      const data = await cargarConCacheAndroid<SeriesSummary[]>(
        `biblioteca:series:${params.toString()}`,
        async (signal) => {
          const res = await fetch(`/api/series?${params}`, { signal });
          if (!res.ok) throw new Error("catalog");
          return res.json();
        },
        {
          privateData: true,
          // Favoritos y progreso pueden cambiar recién antes de entrar:
          // se muestra la copia ya, pero siempre se confirma en segundo plano.
          freshForMs: 0,
          onCached: (guardada) => {
            setSeries(guardada);
            setSeriesError(false);
          },
        }
      );
      setSeries(data);
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
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipo de biblioteca">
        {([
          { key: "lectura", label: "Series de lectura" },
          { key: "animelist" as const, label: "AnimeList" },
          ...(animeAnimadoHabilitado
            ? [{ key: "anime-animado" as const, label: "Anime animado" }]
            : []),
        ] as const).map((t) => (
          <Chip
            key={t.key}
            onClick={() => setSeccion(t.key)}
            role="tab"
            aria-selected={seccion === t.key}
            selected={seccion === t.key}
            className="px-4"
          >
            {t.label}
          </Chip>
        ))}
      </div>

      {seccion === "animelist" ? (
        <SeccionAnimadas busqueda={search} />
      ) : seccion === "anime-animado" && animeAnimadoHabilitado ? (
        <SeccionAnimeExterno busqueda={search} />
      ) : (
       <>
      <section className="flex flex-col gap-4 rounded-[10px] border border-line bg-panel p-3 sm:flex-row sm:items-center" data-od-id="library-controls">
        <div
          className="flex min-w-0 gap-1 overflow-x-auto"
          role="tablist"
          aria-label="Secciones de biblioteca"
        >
          {filters.map((f) => (
            <Chip
              key={f.key}
              onClick={() => setFilter(f.key)}
              selected={filter === f.key}
              className="shrink-0"
              role="tab"
              aria-selected={filter === f.key}
              data-od-id={`library-filter-${f.key}`}
            >
              {f.label}
            </Chip>
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
            <h2 className="min-w-0 font-display text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-tight tracking-[-0.035em] text-ink">
              Categorías
            </h2>
            <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-faint">
              Explorar
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-panel p-4">
            {tags.map((t) => (
              <Chip
                key={t.id}
                onClick={() => toggleTag(t.slug)}
                selected={selectedTag === t.slug}
                aria-pressed={selectedTag === t.slug}
              >
                {t.name} <span className="font-mono opacity-70">{t.series_count}</span>
              </Chip>
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
            <h2 className="min-w-0 font-display text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-tight tracking-[-0.035em] text-ink">
              Continuar leyendo
            </h2>
            <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-faint">
              Tu progreso
            </span>
          </div>
          <div
            className="flex min-w-0 gap-4 overflow-x-auto rounded-[10px] border border-line bg-panel p-4"
            data-od-id="continue-reading-list"
          >
            {continuesVisible.map((c) => (
              <Link
                key={c.series.id}
                href={`/leer/${c.chapter.id}?page=${c.lastPageNumber}`}
                className="group w-40 shrink-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] transition-colors group-hover:border-line-strong">
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
                  <p className="truncate text-base font-semibold text-ink">{c.series.title}</p>
                  <p className="mt-1 font-mono text-[13px] text-faint">
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
                <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] transition-colors group-hover:border-line-strong">
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
                  <span className="absolute left-2 top-2 rounded-md border border-line-strong bg-[color-mix(in_oklch,var(--bg)_92%,transparent)] px-2 py-1 font-mono text-[11px] text-ink">
                    {g.source}
                  </span>
                </div>
                <div className="pt-3">
                  <p className="truncate text-base font-semibold text-ink">{g.title}</p>
                  <p className="mt-1 font-mono text-[13px] text-faint">
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

        {me !== null && !loggedIn && (
          <Surface className="grid gap-5 border-accent p-6  sm:grid-cols-[1fr_auto] sm:items-center" data-od-id="guest-library-callout">
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
            <h2 className="min-w-0 font-display text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-tight tracking-[-0.035em] text-ink">
              Guardadas de otras fuentes
            </h2>
            <button
              onClick={actualizarTodo}
              disabled={revisando}
              title="Revisa todas tus series guardadas y adelanta las que tienen capítulos nuevos"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-line-strong px-4 py-2.5 text-sm font-semibold text-subtle transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {guardadasOrdenadas.map((g) => (
              <Link
                key={`${g.source}-${g.external_id}`}
                href={g.href}
                className="group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] transition-colors group-hover:border-line-strong">
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
                  <span className="absolute left-3 top-3 rounded-md border border-line-strong bg-[color-mix(in_oklch,var(--bg)_92%,transparent)] px-2 py-1 font-mono text-[11px] text-ink">
                    {g.source}
                  </span>
                  {(novedades[claveDe(g)]?.sinLeer ?? 0) > 0 && (
                    <span className="absolute right-3 top-3 rounded-md bg-accent px-2 py-1 font-mono text-[11px] font-medium text-[var(--on-accent)]">
                      +{novedades[claveDe(g)].sinLeer}
                    </span>
                  )}
                </div>
                <div className="px-1 pt-4">
                  <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
                    {g.title}
                  </h3>
                  <p className="mt-1 font-mono text-[13px] text-faint">
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
            <h2 className="min-w-0 font-display text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-tight tracking-[-0.035em] text-ink">
              Catálogo
            </h2>
            <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-faint">
              MangaTotal
            </span>
          </div>

          {series === null ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" aria-label="Cargando catálogo">
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
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" data-od-id="series-grid">
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
