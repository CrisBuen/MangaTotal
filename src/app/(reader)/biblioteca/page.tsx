"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PortadaExterna } from "@/components/fuentes/PortadaExterna";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { fieldControlClass } from "@/components/ui/Field";
import { Surface } from "@/components/ui/Surface";
import { Chip } from "@/components/ui/Chip";
import { EstadoActualizacion, useActualizaciones } from "@/components/library/ActualizacionesBiblioteca";
import { FavoritoBiblioteca, MenuBiblioteca, grillaBiblioteca, useOpcionesBiblioteca } from "@/components/library/MenuBiblioteca";
import { fechaBiblioteca, ordenarBiblioteca, serieFinalizada } from "@/lib/opcionesBiblioteca";
import { pendientesBiblioteca } from "@/lib/colaBiblioteca";
import { SeccionAnimadas } from "@/components/library/SeccionAnimadas";
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

interface EntradaHistorial {
  source: string;
  external_id: string;
  title: string;
  cover_url: string | null;
  last_chapter_name: string | null;
  last_page_number?: number | null;
  href: string;
  href_continuar: string;
  created_at?: string | null;
  updated_at?: string | null;
}

const NOMBRE_FUENTE: Record<string, string> = {
  mangadex: "MangaDex",
  olympus: "Olympus",
  tmo: "ZonaTMO",
  ikigai: "Ikigai",
  leercapitulo: "LeerCapítulo",
  catharsis: "Catharsis",
};

type Filter = "normal" | "adult" | "favoritos" | "historial";

export default function BibliotecaPage() {
  const router = useRouter();
  const urlParams = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [continues, setContinues] = useState<ContinueItem[]>([]);
  const [filter, setFilter] = useState<Filter>("normal");
  const [seccion, setSeccion] = useState<"lectura" | "animelist">("lectura");
  const [search, setSearch] = useState("");
  const [restored, setRestored] = useState(false);
  const [guardadas, setGuardadas] = useState<SerieGuardada[]>([]);
  const [historial, setHistorial] = useState<EntradaHistorial[]>([]);
  const regresoDeLectura = useRef(false);
  const { usuario, trabajos, iniciar } = useActualizaciones();
  const { opciones, cambiar, favorito } = useOpcionesBiblioteca("lectura");
  const trabajo = trabajos.lectura;
  const novedades = trabajo?.resultados ?? {};
  const revisando = trabajo?.estado === "activo";
  const avance = { hechas: trabajo?.hechas.length ?? 0, total: trabajo?.tareas.length ?? 0 };

  const loggedIn = Boolean(me?.nickname);

  const cargarHistorial = useCallback(async () => {
    try {
      const data = await cargarConCacheAndroid<EntradaHistorial[]>(
        "biblioteca:historial",
        async (signal) => {
          const r = await fetch("/api/externo/historial", { signal });
          if (!r.ok) throw new Error("historial");
          return r.json();
        },
        { privateData: true, onCached: setHistorial }
      );
      if (Array.isArray(data)) setHistorial(data);
    } catch {
      setHistorial([]);
    }
  }, []);

  async function quitarHistorial(e: EntradaHistorial) {
    setHistorial((prev) => {
      const next = (prev ?? []).filter(
        (x) => !(x.source === e.source && x.external_id === e.external_id)
      );
      void guardarCacheAndroid("biblioteca:historial", next, { privateData: true });
      return next;
    });
    await fetch(
      `/api/externo/historial?source=${e.source}&id=${encodeURIComponent(e.external_id)}`,
      { method: "DELETE" }
    ).catch(() => {});
  }

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
    const params = new URLSearchParams(window.location.search);
    // Los marcadores antiguos llevan a la misma colección, ahora en Explorar.
    // Solo cambia su ubicación: no se borra ni migra ninguna referencia.
    if (params.get("s") === "anime-animado") {
      const destino = new URLSearchParams({ seccion: "animada", vista: "milista" });
      if (params.get("q")) destino.set("q", params.get("q")!);
      router.replace(`/explorar?${destino}`);
      return;
    }
    const aplicarMe = (actual: Me) => {
      setMe(actual);
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

    void cargarHistorial();

    // restaurar el estado desde la URL: pestaña activa, tag y búsqueda
    // (así "atrás" desde una serie vuelve a la misma sección)
    const urlSeccion = params.get("s");
    if (urlSeccion === "animadas" || urlSeccion === "animelist") setSeccion("animelist");
    const urlFilter = params.get("f");
    if (urlFilter && ["normal", "adult", "favoritos", "historial"].includes(urlFilter)) {
      setFilter(urlFilter as Filter);
    }
    const urlSearch = params.get("q");
    if (urlSearch) setSearch(urlSearch);
    setRestored(true);
  }, [router, cargarHistorial]);

  // La barra común cambia Mi biblioteca/Favoritos sin desmontar esta página.
  // También se restaura Atrás/Adelante; no se toca la colección ni su progreso.
  useEffect(() => {
    if (!restored) return;
    const section = urlParams.get("s");
    setSeccion(section === "animadas" || section === "animelist" ? "animelist" : "lectura");
    const nextFilter = urlParams.get("f");
    setFilter(
      nextFilter === "adult" || nextFilter === "favoritos" || nextFilter === "historial"
        ? nextFilter
        : "normal"
    );
    setSearch(urlParams.get("q") ?? "");
  }, [urlParams, restored]);

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

  const claveDe = (g: SerieGuardada) => `${g.source}-${g.external_id}`;

  // Favoritos es una revisión deliberadamente acotada: no consulta las
  // demás fichas ni reemplaza la cola completa que ya conserva sus datos.
  const seriesParaActualizar = filter === "favoritos"
    ? guardadas.filter((g) => opciones.favoritos.includes(claveDe(g)))
    : filter === "normal"
      ? guardadas
      : [];
  function actualizarCatalogo() {
    if (revisando || seriesParaActualizar.length === 0) return;
    iniciar(
      "lectura",
      seriesParaActualizar.map((g) => ({
        source: g.source,
        external_id: g.external_id,
        slug: g.slug,
        type: g.type,
        last_chapter_name: g.last_chapter_name,
      }))
    );
  }

  // primero las que tienen capítulos sin leer, de mayor a menor
  const esAdulta = (g: SerieGuardada) => /^(adult|\+18|hentai)$/i.test(g.type ?? "");
  const guardadasVisibles = guardadas.filter((g) =>
    filter === "favoritos"
      ? opciones.favoritos.includes(claveDe(g))
      : filter === "adult"
        ? esAdulta(g)
        : !esAdulta(g)
  );
  const guardadasOrdenadas = ordenarBiblioteca(
    guardadasVisibles.filter((g) =>
      g.title.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es"))
    ),
    opciones,
    (g) => {
      const n = novedades[claveDe(g)];
      return {
        clave: claveDe(g),
        titulo: g.title,
        cantidad: n?.total,
        lectura: g.last_chapter_name ? fechaBiblioteca(g.updated_at) : null,
        comprobacion: n?.comprobado,
        pendientes: pendientesBiblioteca(n, g.last_chapter_name),
        reciente: n?.ultimo != null ? Number(n.ultimo) : null,
        obtencion: n?.publicado ?? n?.obtenido,
        antiguedad: fechaBiblioteca(g.created_at),
        empezado: g.last_chapter_name !== null,
        favorito: opciones.favoritos.includes(claveDe(g)),
        completado: serieFinalizada(n?.estado),
      };
    }
  );
  // El filtro se aplica igual a las lecturas propias y a las otras fuentes.
  const continuesVisible =
    filter === "favoritos"
      ? continues.filter((c) => c.series.is_favorite)
      : continues.filter((c) => c.series.type === filter);

  const externasEmpezadas = guardadasVisibles.filter((g) => g.last_chapter_name);

  const hayQueContinuar = continuesVisible.length + externasEmpezadas.length > 0;

  const busquedaNormalizada = search.trim().toLocaleLowerCase("es");
  const historialFiltrado = historial.filter((e) =>
    busquedaNormalizada ? e.title.toLocaleLowerCase("es").includes(busquedaNormalizada) : true
  );
  const guardadasEmpezadasFiltradas = externasEmpezadas.filter((g) =>
    busquedaNormalizada ? g.title.toLocaleLowerCase("es").includes(busquedaNormalizada) : true
  );
  const continuesFiltradas = continuesVisible.filter((c) =>
    busquedaNormalizada ? c.series.title.toLocaleLowerCase("es").includes(busquedaNormalizada) : true
  );

  const filters: { key: Filter; label: string }[] = [
    { key: "normal", label: "Normal" },
    ...(me?.show_adult_content ? [{ key: "adult" as Filter, label: "+18" }] : []),
    ...(loggedIn ? [{ key: "favoritos" as Filter, label: "Favoritos" }] : []),
    ...(loggedIn ? [{ key: "historial" as Filter, label: "Historial" }] : []),
  ];

  return (
    <div className="space-y-6 sm:space-y-8" data-od-id="library-page">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <span className="od-eyebrow">Tu colección personal</span>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-4xl">Mi biblioteca</h1>
          <p className="mt-1 text-sm text-subtle">
            {filter === "historial"
              ? `${historial.length + externasEmpezadas.length} series con registro de lectura`
              : guardadas.length > 0
                ? `${guardadas.length} series guardadas en tu colección`
                : "Tus mangas, manhwas y favoritos en un solo lugar"}
          </p>
        </div>
        {loggedIn && seccion === "lectura" && filter !== "adult" && filter !== "historial" && guardadas.length > 0 && (
          <button
            onClick={actualizarCatalogo}
            disabled={revisando || !usuario || seriesParaActualizar.length === 0}
            title={
              filter === "favoritos"
                ? "Revisa solamente las series marcadas como favoritas"
                : "Revisa todas tus series guardadas y adelanta las que tienen capítulos nuevos"
            }
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-line-strong px-4 text-sm font-semibold text-subtle transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
            data-od-id={filter === "favoritos" ? "actualizar-favoritos" : "actualizar-todo"}
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-3.5 w-3.5 fill-current ${revisando ? "animate-spin" : ""}`}
              aria-hidden="true"
            >
              <path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
            </svg>
            {revisando
              ? `Revisando ${avance.hechas}/${avance.total}`
              : filter === "favoritos"
                ? "Actualizar favoritos"
                : "Actualizar todo"}
          </button>
        )}
      </div>

      {/* Selector de sección de biblioteca: lectura o AniList */}
      <div className="od-tabs" role="tablist" aria-label="Tipo de biblioteca">
        {([
          { key: "lectura", label: "Series de lectura" },
          { key: "animelist" as const, label: "AniList" },
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
      ) : (
        <>
          {/* 1. Herramientas y filtros de la colección en la parte superior */}
          <section
            className="flex flex-col gap-4 rounded-[10px] border border-line bg-panel p-3 sm:flex-row sm:items-center"
            data-od-id="library-controls"
          >
            <div className="flex min-w-0 gap-1 overflow-x-auto" role="tablist" aria-label="Secciones de biblioteca">
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
              placeholder={filter === "historial" ? "Buscar en el historial…" : "Buscar serie…"}
              className={`min-w-0 sm:ml-auto sm:max-w-sm ${fieldControlClass}`}
              aria-label="Buscar serie"
              data-od-id="library-search"
            />
            <MenuBiblioteca opciones={opciones} cambiar={cambiar} />
          </section>

          {/* Si está en la pestaña Historial, vista dedicada de todo el historial */}
          {filter === "historial" ? (
            <section data-od-id="library-history-view" className="space-y-8">
              {historialFiltrado.length === 0 &&
              guardadasEmpezadasFiltradas.length === 0 &&
              continuesFiltradas.length === 0 ? (
                <div className="my-8 rounded-lg border border-line bg-panel p-8 text-center">
                  <p className="text-base font-semibold text-ink">
                    {search
                      ? "Ninguna serie del historial coincide con la búsqueda."
                      : "No tenés lecturas en el historial todavía."}
                  </p>
                  <p className="mt-1 text-sm text-subtle">
                    {search
                      ? "Probá con otro término o limpiá la búsqueda."
                      : "Las series y capítulos que leas en cualquier fuente van a aparecer acá para que puedas continuar donde quedaste."}
                  </p>
                  <div className="mt-4">
                    <Link href="/lectura/descubrir" className="od-outline">
                      Explorar fuentes →
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {historialFiltrado.length > 0 && (
                    <div>
                      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <span className="od-eyebrow">Leído recientemente</span>
                          <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                            Historial de lectura
                          </h2>
                        </div>
                        <span className="font-mono text-xs text-subtle">
                          {historialFiltrado.length}{" "}
                          {historialFiltrado.length === 1 ? "serie" : "series"}
                        </span>
                      </div>
                      <div
                        className={`${grillaBiblioteca(opciones)} mt-4`}
                        data-vista={opciones.vista}
                        data-titulos={opciones.titulos}
                      >
                        {historialFiltrado.map((h) => (
                          <div
                            key={`${h.source}-${h.external_id}`}
                            className="group relative min-w-0 pb-8"
                          >
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.preventDefault();
                                ev.stopPropagation();
                                void quitarHistorial(h);
                              }}
                              title="Sacar del historial"
                              aria-label={`Sacar ${h.title} del historial`}
                              className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--bg)_85%,transparent)] text-sm text-subtle shadow-sm transition hover:bg-red-500/20 hover:text-red-400 focus-visible:opacity-100"
                            >
                              ×
                            </button>
                            <Link
                              href={h.href_continuar}
                              onClick={abrirDesdeBiblioteca}
                              className="biblioteca-tarjeta group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
                            >
                              <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] transition-colors group-hover:border-line-strong">
                                {h.cover_url && (
                                  <PortadaExterna
                                    source={h.source}
                                    externalId={h.external_id}
                                    src={h.cover_url}
                                    alt={h.title}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                                <span className="absolute left-2.5 top-2.5 rounded-md border border-line-strong bg-[color-mix(in_oklch,var(--bg)_92%,transparent)] px-2 py-0.5 font-mono text-[11px] text-ink">
                                  {NOMBRE_FUENTE[h.source] ?? h.source}
                                </span>
                              </div>
                              <div className="px-1 pt-3">
                                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink transition-colors group-hover:text-accent-ink sm:text-base">
                                  {h.title}
                                </h3>
                                <p className="mt-1 font-mono text-[12px] text-faint sm:text-[13px]">
                                  {h.last_chapter_name ? `Cap. ${h.last_chapter_name}` : "Empezado"}
                                </p>
                              </div>
                            </Link>
                            <div className="mt-2 flex items-center justify-between px-1">
                              <Link
                                href={h.href}
                                onClick={abrirDesdeBiblioteca}
                                title="Ver ficha y capítulos"
                                className="text-xs text-subtle transition hover:text-accent-ink"
                              >
                                Ficha →
                              </Link>
                              <Link
                                href={h.href_continuar}
                                onClick={abrirDesdeBiblioteca}
                                className="rounded border border-line px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-ink transition hover:border-accent"
                              >
                                Continuar
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(guardadasEmpezadasFiltradas.length > 0 || continuesFiltradas.length > 0) && (
                    <div className="border-t border-line/60 pt-6">
                      <div className="mb-4">
                        <span className="od-eyebrow">Colección en curso</span>
                        <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                          Series guardadas empezadas
                        </h2>
                      </div>
                      <div
                        className={`${grillaBiblioteca(opciones)} mt-4`}
                        data-vista={opciones.vista}
                        data-titulos={opciones.titulos}
                      >
                        {guardadasEmpezadasFiltradas.map((g) => (
                          <div
                            key={`${g.source}-${g.external_id}`}
                            className="relative min-w-0 pb-8"
                          >
                            <Link
                              href={g.href_continuar}
                              onClick={abrirDesdeBiblioteca}
                              className="biblioteca-tarjeta group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
                            >
                              <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] transition-colors group-hover:border-line-strong">
                                {g.cover_url && (
                                  <PortadaExterna
                                    source={g.source}
                                    externalId={g.external_id}
                                    src={g.cover_url}
                                    alt={g.title}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                                <span className="absolute left-2.5 top-2.5 rounded-md border border-line-strong bg-[color-mix(in_oklch,var(--bg)_92%,transparent)] px-2 py-0.5 font-mono text-[11px] text-ink">
                                  {NOMBRE_FUENTE[g.source] ?? g.source}
                                </span>
                              </div>
                              <div className="px-1 pt-3">
                                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink transition-colors group-hover:text-accent-ink sm:text-base">
                                  {g.title}
                                </h3>
                                <p className="mt-1 font-mono text-[12px] text-faint sm:text-[13px]">
                                  Cap. {g.last_chapter_name}
                                </p>
                              </div>
                            </Link>
                            <div className="mt-2 flex items-center justify-between px-1">
                              <Link
                                href={g.href}
                                onClick={abrirDesdeBiblioteca}
                                title="Ver ficha y capítulos"
                                className="text-xs text-subtle transition hover:text-accent-ink"
                              >
                                Ficha →
                              </Link>
                              <Link
                                href={g.href_continuar}
                                onClick={abrirDesdeBiblioteca}
                                className="rounded border border-line px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-ink transition hover:border-accent"
                              >
                                Continuar
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          ) : (
            <>
              {/* Continuar leyendo arriba de la colección para acceso rápido sin scroll infinito */}
              {loggedIn && filter === "normal" && hayQueContinuar && (
                <section data-od-id="continue-reading" className="mb-6">
                      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
                        <div>
                          <span className="od-eyebrow">Progreso</span>
                          <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                            Continuar leyendo
                          </h2>
                        </div>
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
                                  href={`/series/${c.series.slug}`}
                                  onClick={abrirDesdeBiblioteca}
                                  title="Ver ficha y capítulos"
                                  aria-label={`Ver ficha de ${c.series.title}`}
                                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line text-sm text-subtle transition hover:border-line-strong hover:text-accent-ink"
                                >
                                  →
                                </Link>
                              </div>
                              <p className="mt-1 font-mono text-[13px] text-faint">
                                Cap. {c.chapter.number}
                                {c.lastPageNumber > 1 ? ` · pág. ${c.lastPageNumber}` : ""}
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
                                  <PortadaExterna
                                    source={g.source}
                                    externalId={g.external_id}
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

              {/* 2. Colección guardada (el centro de Mi Biblioteca) */}
              <section data-od-id="library-external">
                <EstadoActualizacion tipo="lectura" />

                {!loggedIn && me !== null && (
                  <Surface
                    className="mt-4 grid gap-5 border-accent p-6 sm:grid-cols-[1fr_auto] sm:items-center"
                    data-od-id="guest-library-callout"
                  >
                    <p className="text-sm text-subtle">
                      <Link href="/registro" className="font-bold text-ink underline underline-offset-4">
                        Creá tu cuenta
                      </Link>{" "}
                      o{" "}
                      <Link href="/login" className="font-bold text-ink underline underline-offset-4">
                        iniciá sesión
                      </Link>{" "}
                      para guardar series en tu colección, marcar favoritos y sincronizar tu avance.
                    </p>
                    <Link href="/registro" className={buttonStyles({ variant: "primary", size: "sm" })}>
                      Crear cuenta
                    </Link>
                  </Surface>
                )}

                {loggedIn && (
                  <>
                    {guardadasOrdenadas.length === 0 ? (
                      <div className="my-8 rounded-lg border border-line bg-panel p-8 text-center">
                        <p className="text-base font-semibold text-ink">
                          {search
                            ? "Ninguna serie coincide con la búsqueda."
                            : filter === "favoritos"
                              ? "No tenés series marcadas como favoritas."
                              : "Tu colección está vacía."}
                        </p>
                        <p className="mt-1 text-sm text-subtle">
                          {filter === "favoritos"
                            ? "Marcá una serie con la estrella para verla acá."
                            : "Explorá tus fuentes favoritas y tocá 'Guardar' para agregar obras a tu biblioteca."}
                        </p>
                        <div className="mt-4">
                          <Link href="/lectura/descubrir" className="od-outline">
                            Explorar fuentes →
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`${grillaBiblioteca(opciones)} mt-4`}
                        data-vista={opciones.vista}
                        data-titulos={opciones.titulos}
                      >
                        {guardadasOrdenadas.map((g) => (
                          <div key={`${g.source}-${g.external_id}`} className="relative min-w-0 pb-8">
                            <Link
                              href={g.href}
                              onClick={abrirDesdeBiblioteca}
                              className="biblioteca-tarjeta group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
                            >
                              <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] transition-colors group-hover:border-line-strong">
                                {g.cover_url && (
                                  <PortadaExterna
                                    source={g.source}
                                    externalId={g.external_id}
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
                            <FavoritoBiblioteca
                              titulo={g.title}
                              activo={opciones.favoritos.includes(claveDe(g))}
                              onClick={() => favorito(claveDe(g))}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
