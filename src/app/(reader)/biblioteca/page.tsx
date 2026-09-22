"use client";

import Link from "next/link";
import { ImagenFuente } from "@/components/fuentes/ImagenFuente";
import { useEffect, useRef, useState } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { fieldControlClass } from "@/components/ui/Field";
import { SectionHeading, Surface } from "@/components/ui/Surface";
import { Chip } from "@/components/ui/Chip";
import { EstadoActualizacion, useActualizaciones } from "@/components/library/ActualizacionesBiblioteca";
import { FavoritoBiblioteca, MenuBiblioteca, grillaBiblioteca, useOpcionesBiblioteca } from "@/components/library/MenuBiblioteca";
import { fechaBiblioteca, ordenarBiblioteca, serieFinalizada } from "@/lib/opcionesBiblioteca";
import { pendientesBiblioteca } from "@/lib/colaBiblioteca";
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
  series: {
    id: number;
    title: string;
    slug: string;
    type: string;
    cover_image_path: string | null;
    is_favorite: boolean;
  };
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
  created_at?: string | null;
  updated_at?: string | null;
}

type Filter = "normal" | "adult" | "favoritos";

export default function BibliotecaPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [continues, setContinues] = useState<ContinueItem[]>([]);
  const [filter, setFilter] = useState<Filter>("normal");
  const [seccion, setSeccion] = useState<"lectura" | "animelist" | "anime-animado">("lectura");
  const [animeAnimadoHabilitado, setAnimeAnimadoHabilitado] = useState(false);
  const [search, setSearch] = useState("");
  const [restored, setRestored] = useState(false);
  const [guardadas, setGuardadas] = useState<SerieGuardada[]>([]);
  const regresoDeLectura = useRef(false);
  const { usuario, trabajos, iniciar } = useActualizaciones();
  const { opciones, cambiar, favorito } = useOpcionesBiblioteca("lectura");
  const trabajo = trabajos.lectura;
  const novedades = trabajo?.resultados ?? {};
  const revisando = trabajo?.estado === "activo";
  const avance = { hechas: trabajo?.hechas.length ?? 0, total: trabajo?.tareas.length ?? 0 };

  const loggedIn = Boolean(me?.nickname);

  useEffect(() => {
    regresoDeLectura.current = sessionStorage.getItem("biblioteca:regreso") === "1";
    sessionStorage.removeItem("biblioteca:regreso");
    if (regresoDeLectura.current) window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    if (!regresoDeLectura.current || guardadas.length === 0) return;
    requestAnimationFrame(() => window.scrollTo(0, 0));
    regresoDeLectura.current = false;
  }, [guardadas.length]);
  const abrirDesdeBiblioteca = () => sessionStorage.setItem("biblioteca:regreso", "1");

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
    if (search.trim()) url.searchParams.set("q", search.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url.toString());
  }, [restored, seccion, filter, search]);

  // Revisa todas las series guardadas y pone adelante las que sacaron
  // capítulo nuevo desde la última vez que las leíste.
  async function actualizarTodo() {
    if (revisando || guardadas.length === 0) return;
    iniciar("lectura", guardadas.map(g => ({ source: g.source, external_id: g.external_id, slug: g.slug, type: g.type, last_chapter_name: g.last_chapter_name })));
  }

  const claveDe = (g: SerieGuardada) => `${g.source}-${g.external_id}`;

  // primero las que tienen capítulos sin leer, de mayor a menor
  const esAdulta = (g: SerieGuardada) => /^(adult|\+18|hentai)$/i.test(g.type ?? "");
  const guardadasVisibles = guardadas.filter(g =>
    filter === "favoritos" ? opciones.favoritos.includes(claveDe(g)) :
      filter === "adult" ? esAdulta(g) : !esAdulta(g));
  const guardadasOrdenadas = ordenarBiblioteca(guardadasVisibles.filter(g => g.title.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es"))), opciones, g => {
    const n = novedades[claveDe(g)];
    return { clave: claveDe(g), titulo: g.title, cantidad: n?.total, lectura: g.last_chapter_name ? fechaBiblioteca(g.updated_at) : null,
      comprobacion: n?.comprobado, pendientes: pendientesBiblioteca(n, g.last_chapter_name),
      reciente: n?.ultimo != null ? Number(n.ultimo) : null, obtencion: n?.obtenido, antiguedad: fechaBiblioteca(g.created_at),
      empezado: g.last_chapter_name !== null, favorito: opciones.favoritos.includes(claveDe(g)), completado: serieFinalizada(n?.estado) };
  });
  // El filtro se aplica igual a las lecturas propias y a las otras fuentes.
  const continuesVisible =
    filter === "favoritos"
      ? continues.filter((c) => c.series.is_favorite)
      : continues.filter((c) => c.series.type === filter);

  const externasEmpezadas = guardadasVisibles.filter((g) => g.last_chapter_name);

  const hayQueContinuar = continuesVisible.length + externasEmpezadas.length > 0;

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
          { key: "animelist" as const, label: "AniList" },
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
      {/* Historial: lo que abriste para leer y no llegaste a guardar */}
      {loggedIn && filter === "normal" && <SeccionHistorial tipo="normal" alAbrir={abrirDesdeBiblioteca} />}

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
              <div key={c.series.id} className="group w-40 shrink-0">
              <Link
                href={`/leer/${c.chapter.id}?page=${c.lastPageNumber}`}
                onClick={abrirDesdeBiblioteca}
                className="block transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
              </Link>
                <div className="pt-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/leer/${c.chapter.id}?page=${c.lastPageNumber}`}
                      onClick={abrirDesdeBiblioteca}
                      className="min-w-0 flex-1 truncate text-base font-semibold text-ink hover:text-accent-ink"
                    >
                      {c.series.title}
                    </Link>
                    <Link
                      href={`/serie/${c.series.slug}`}
                      onClick={abrirDesdeBiblioteca}
                      title="Ver ficha y capítulos"
                      aria-label={`Ver ficha de ${c.series.title}`}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line text-sm text-subtle transition hover:border-line-strong hover:text-accent-ink"
                    >
                      →
                    </Link>
                  </div>
                  <p className="mt-1 font-mono text-[13px] text-faint">
                    Cap. {c.chapter.number} · pág. {c.lastPageNumber}/{c.chapter.page_count}
                  </p>
                </div>
              </div>
            ))}

            {externasEmpezadas.map((g) => (
              <div key={`${g.source}-${g.external_id}`} className="group w-40 shrink-0">
              <Link
                href={g.href_continuar}
                onClick={abrirDesdeBiblioteca}
                className="block transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] transition-colors group-hover:border-line-strong">
                  {g.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <ImagenFuente
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
              </Link>
                <div className="pt-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={g.href_continuar}
                      onClick={abrirDesdeBiblioteca}
                      className="min-w-0 flex-1 truncate text-base font-semibold text-ink hover:text-accent-ink"
                    >
                      {g.title}
                    </Link>
                    <Link
                      href={g.href}
                      onClick={abrirDesdeBiblioteca}
                      title="Ver ficha y capítulos"
                      aria-label={`Ver ficha de ${g.title}`}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line text-sm text-subtle transition hover:border-line-strong hover:text-accent-ink"
                    >
                      →
                    </Link>
                  </div>
                  <p className="mt-1 font-mono text-[13px] text-faint">
                    Cap. {g.last_chapter_name}
                    {g.last_page_number && g.last_page_number > 1
                      ? ` · pág. ${g.last_page_number}`
                      : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-[10px] border border-line bg-panel p-3 sm:flex-row sm:items-center" data-od-id="library-controls">
        <div className="flex min-w-0 gap-1 overflow-x-auto" role="tablist" aria-label="Secciones de biblioteca">
          {filters.map((f) => (
            <Chip key={f.key} onClick={() => setFilter(f.key)} selected={filter === f.key}
              className="shrink-0" role="tab" aria-selected={filter === f.key}
              data-od-id={`library-filter-${f.key}`}>
              {f.label}
            </Chip>
          ))}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar serie…"
          className={`min-w-0 sm:ml-auto sm:max-w-sm ${fieldControlClass}`}
          aria-label="Buscar serie" data-od-id="library-search" />
        <MenuBiblioteca opciones={opciones} cambiar={cambiar} />
      </section>

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

      {loggedIn && guardadas.length > 0 && (
        <section data-od-id="library-external">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <h2 className="min-w-0 font-display text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-tight tracking-[-0.035em] text-ink">
              CATÁLOGO
            </h2>
            <button
              onClick={actualizarTodo}
              disabled={revisando || !usuario}
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
          <EstadoActualizacion tipo="lectura" />
          {guardadasOrdenadas.length === 0 && <p className="py-6 text-subtle">Ninguna serie coincide con estos filtros.</p>}
          <div className={`${grillaBiblioteca(opciones)} mt-5`} data-vista={opciones.vista} data-titulos={opciones.titulos}>
            {guardadasOrdenadas.map((g) => (
              <div key={`${g.source}-${g.external_id}`} className="relative min-w-0 pb-8">
              <Link
                key={`${g.source}-${g.external_id}`}
                href={g.href}
                onClick={abrirDesdeBiblioteca}
                className="biblioteca-tarjeta group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] transition-colors group-hover:border-line-strong">
                  {g.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <ImagenFuente
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
                  {(pendientesBiblioteca(novedades[claveDe(g)], g.last_chapter_name) ?? 0) > 0 && (
                    <span className="absolute right-3 top-3 rounded-md bg-accent px-2 py-1 font-mono text-[11px] font-medium text-[var(--on-accent)]">
                      +{pendientesBiblioteca(novedades[claveDe(g)], g.last_chapter_name)}
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
              <FavoritoBiblioteca titulo={g.title} activo={opciones.favoritos.includes(claveDe(g))} onClick={() => favorito(claveDe(g))} />
              </div>
            ))}
          </div>
        </section>
      )}

       </>
      )}
    </div>
  );
}
