"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buscarReferenciaBiblioteca, type ReferenciaBiblioteca } from "@/lib/identidadBiblioteca";
import { ImagenFuente } from "@/components/fuentes/ImagenFuente";
import { retryThroughProxy } from "@/components/reader/pageImage";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { SectionHeading, Surface } from "@/components/ui/Surface";
import { Chip } from "@/components/ui/Chip";
import { fieldControlClass } from "@/components/ui/Field";
import { isAndroidApp, isPlayStoreApp } from "@/lib/appVersion";
import {
  cargarConCacheAndroid,
  fetchConLimiteAndroid,
  guardarCacheAndroid,
  leerCacheAndroid,
} from "@/lib/androidCache";
import {
  IKIGAI_GENEROS,
  IKIGAI_ORDENES,
  IKIGAI_TIPOS,
  catalogoIkigai,
  ikigaiDisponible,
  type SerieIkigai,
} from "@/lib/ikigai";
import { catalogoCw, imagenCw, type OrdenCw, type SerieCw } from "@/lib/catharsis";
import {
  LC_HABILITADA,
  LC_GENEROS,
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
import {
  EHENTAI_CATEGORIAS,
  EHENTAI_IDIOMAS,
  type SerieEhentai,
} from "@/lib/ehentai";
import {
  buscarEtiquetasEhentai,
  type EhentaiTag,
} from "@/lib/ehentaiTags";
import {
  HITOMI_IDIOMAS,
  HITOMI_TIPOS,
  HITOMI_ORDENES,
  type HitomiOrden,
  buscarEtiquetasHitomi,
  type HitomiTag,
  type SerieHitomi,
} from "@/lib/hitomiTipos";

function decodificarHtml(texto: string): string {
  return texto
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

// Leer manga no debe descargar también los tres catálogos de anime.
// dynamic(() => import("@/components/anime/JkanimeCatalog")
// dynamic(() => import("@/components/anime/TioanimeCatalog")
const cargandoAnime = () => <p role="status" className="py-12 text-center text-subtle">Cargando catálogo de anime...</p>;
const AnimeDiscover = dynamic(() => import("@/components/discover/AnimeDiscover").then((m) => m.AnimeDiscover), { loading: cargandoAnime });
const HentaitvCatalog = dynamic(() => import("@/components/anime/HentaitvCatalog").then((m) => m.HentaitvCatalog), { loading: cargandoAnime });

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

type SeccionExplorar = "lectura" | "animada";
type FuenteAnime = "jkanime" | "tioanime" | "hentaitv";

function MarcaGuardada({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <span className="absolute left-2 top-2 z-10 rounded-md border border-line bg-panel px-2 py-1 text-[11px] font-semibold text-ink shadow-sm" aria-label="En biblioteca">▣ En biblioteca</span>;
}

export default function ExplorarPage() {
  const navigation = useSearchParams();
  const seccion: SeccionExplorar = navigation.get("seccion") === "animada" ? "animada" : "lectura";
  const [guardadas, setGuardadas] = useState<ReferenciaBiblioteca[]>([]);
  useEffect(() => {
    let vigente = true;
    const cargar = async () => {
      const res = await fetch("/api/externo/biblioteca", { cache: "no-store" }).catch(() => null);
      if (!res?.ok || !vigente) return;
      const datos: ReferenciaBiblioteca[] = await res.json().catch(() => []);
      if (vigente && Array.isArray(datos)) setGuardadas(datos);
    };
    void cargar();
    window.addEventListener("focus", cargar);
    window.addEventListener("pageshow", cargar);
    return () => { vigente = false; window.removeEventListener("focus", cargar); window.removeEventListener("pageshow", cargar); };
  }, []);
  const guardada = (source: string, id: string, tipo?: string) => Boolean(buscarReferenciaBiblioteca(guardadas, source, id, tipo));
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
  const [restaurado, setRestaurado] = useState(false);
  const [animeFuente, setAnimeFuente] = useState<FuenteAnime>("jkanime");
  const [animeHabilitado, setAnimeHabilitado] = useState(false);
  const [animeAdultoHabilitado, setAnimeAdultoHabilitado] = useState(false);
  const [adultoComprobado, setAdultoComprobado] = useState(false);
  const lecturaActiva = restaurado && !(seccion === "animada" && animeHabilitado);
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
  const [cw, setCw] = useState<SerieCw[] | null>(null);
  const [cwPage, setCwPage] = useState(1);
  const [cwPaginas, setCwPaginas] = useState(1);
  const [cwOrden, setCwOrden] = useState<OrdenCw>("novedades");
  const [lc, setLc] = useState<SerieLc[] | null>(null);
  const [lcPage, setLcPage] = useState(1);
  const [lcGenero, setLcGenero] = useState<string | null>(null);
  const [lcInicial, setLcInicial] = useState<string | null>(null);
  const [lcMas, setLcMas] = useState(false);
  const [lcPaginable, setLcPaginable] = useState(false);
  const [lcLista, setLcLista] = useState("");

  const [ehGalleries, setEhGalleries] = useState<SerieEhentai[] | null>(null);
  const [ehPage, setEhPage] = useState(1);
  const [ehHayMas, setEhHayMas] = useState(false);
  const [ehCat, setEhCat] = useState("todos");
  const [ehLang, setEhLang] = useState("todos");
  const [ehTag, setEhTag] = useState<string | null>(null);
  const [ehModalTags, setEhModalTags] = useState(false);
  const [ehTagBusqueda, setEhTagBusqueda] = useState("");
  const ehCursors = useRef<Record<number, string | null>>({ 1: null });
  const [ehNextCursor, setEhNextCursor] = useState<string | null>(null);

  const [hitomiSeries, setHitomiSeries] = useState<SerieHitomi[] | null>(null);
  const [hitomiPage, setHitomiPage] = useState(1);
  const [hitomiTotalPaginas, setHitomiTotalPaginas] = useState(1);
  const [hitomiHayMas, setHitomiHayMas] = useState(false);
  const [hitomiLang, setHitomiLang] = useState("spanish");
  const [hitomiTipo, setHitomiTipo] = useState("todos");
  const [hitomiOrden, setHitomiOrden] = useState<HitomiOrden>("date_added");
  const [hitomiTag, setHitomiTag] = useState<string | null>(null);
  const [hitomiModalTags, setHitomiModalTags] = useState(false);
  const [hitomiTagBusqueda, setHitomiTagBusqueda] = useState("");
  const [hitomiTagsSugeridos, setHitomiTagsSugeridos] = useState<HitomiTag[]>([]);

  useEffect(() => {
    if (!hitomiModalTags) return;
    const partes = hitomiTagBusqueda.split(",");
    const q = (partes[partes.length - 1] ?? "").trim();
    if (q.length < 2) {
      setHitomiTagsSugeridos([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/externo/hitomi?suggest=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.tags)) {
          setHitomiTagsSugeridos(data.tags);
        }
      } catch {}
    }, 220);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [hitomiModalTags, hitomiTagBusqueda]);

  // Botón de actualizar: vuelve a pedir SOLO lo que está en pantalla, y
  // saltea la caché para que aparezcan los capítulos recién subidos.
  const [recarga, setRecarga] = useState(0);
  const [refrescando, setRefrescando] = useState(false);
  const pedirFresco = useRef(false);
  const solicitudes = useRef<Record<string, number>>({});

  // Una respuesta lenta de la consulta anterior no puede reemplazar la que
  // corresponde al texto que está visible ahora. Esto era especialmente
  // frecuente al escribir con 4G: el catálogo inicial llegaba después de la
  // búsqueda y hacía parecer que la lupa no funcionaba.
  const nuevaSolicitud = useCallback((clave: string) => {
    const version = (solicitudes.current[clave] ?? 0) + 1;
    solicitudes.current[clave] = version;
    return version;
  }, []);
  const solicitudVigente = useCallback(
    (clave: string, version: number) => solicitudes.current[clave] === version,
    []
  );
  const cancelarSolicitud = useCallback((clave: string, version: number) => {
    if (solicitudes.current[clave] === version) solicitudes.current[clave] = version + 1;
  }, []);

  const cargarCw = useCallback(async (solicitud: number) => {
    if (!solicitudVigente("catharsis", solicitud)) return;
    setError(false);
    const fresco = pedirFresco.current;
    try {
      const r = await cargarConCacheAndroid(
        `explorar:catharsis:${cwPage}:${cwOrden}:${search.trim()}`,
        () =>
          catalogoCw({
            busqueda: search.trim() || undefined,
            pagina: cwPage,
            orden: cwOrden,
            fresco,
          }),
        {
          force: fresco,
          freshForMs: 15 * 60 * 1000,
          onCached: (guardado) => {
            if (!solicitudVigente("catharsis", solicitud)) return;
            setCw(guardado.series);
            setCwPaginas(guardado.paginas);
          },
        }
      );
      if (!solicitudVigente("catharsis", solicitud)) return;
      setCw(r.series);
      setCwPaginas(r.paginas);
    } catch (err) {
      if (!solicitudVigente("catharsis", solicitud)) return;
      setError(true);
      setErrorDetalle(err instanceof Error ? err.message : null);
      setCw([]);
    } finally {
      if (!solicitudVigente("catharsis", solicitud)) return;
      pedirFresco.current = false;
      setRefrescando(false);
    }
    // recarga entra en las dependencias para que el botón de actualizar
    // vuelva a pedir aunque no haya cambiado ningún filtro
  }, [cwPage, cwOrden, search, recarga, solicitudVigente]);

  useEffect(() => {
    if (fuente !== "catharsis") return;
    const solicitud = nuevaSolicitud("catharsis");
    if (!pedirFresco.current) setCw(null);
    const t = setTimeout(() => void cargarCw(solicitud), search ? 400 : 0);
    return () => {
      clearTimeout(t);
      cancelarSolicitud("catharsis", solicitud);
    };
  }, [cargarCw, search, fuente, nuevaSolicitud, cancelarSolicitud]);

  const prevCwFiltros = useRef<string | null>(null);
  useEffect(() => {
    if (!restaurado) return;
    const clave = JSON.stringify({ search, cwOrden });
    if (prevCwFiltros.current === null) {
      prevCwFiltros.current = clave;
      return;
    }
    if (prevCwFiltros.current !== clave) {
      prevCwFiltros.current = clave;
      setCwPage(1);
    }
  }, [restaurado, search, cwOrden]);

  const cargarLc = useCallback(async (solicitud: number) => {
    if (!solicitudVigente("leercapitulo", solicitud)) return;
    setError(false);
    const fresco = pedirFresco.current;
    try {
      const r = await cargarConCacheAndroid(
        `explorar:leercapitulo:v2:${lcPage}:${lcGenero ?? ""}:${lcInicial ?? ""}:${lcLista}:${search.trim()}`,
        () =>
          catalogoLc(
            lcPage,
            {
              q: search.trim() || undefined,
              genero: lcGenero ?? undefined,
              inicial: lcInicial ?? undefined,
              lista: lcLista || undefined,
            },
            fresco
          ),
        {
          force: fresco,
          freshForMs: 15 * 60 * 1000,
          onCached: (guardado) => {
            if (!solicitudVigente("leercapitulo", solicitud)) return;
            setLc(guardado.series);
            setLcMas(guardado.hayMas);
            setLcPaginable(guardado.paginable);
          },
        },
      );
      if (!solicitudVigente("leercapitulo", solicitud)) return;
      setLc(r.series);
      setLcMas(r.hayMas);
      setLcPaginable(r.paginable);
    } catch (err) {
      if (!solicitudVigente("leercapitulo", solicitud)) return;
      setError(true);
      setErrorDetalle(err instanceof Error ? err.message : null);
      setLc([]);
    } finally {
      if (!solicitudVigente("leercapitulo", solicitud)) return;
      pedirFresco.current = false;
      setRefrescando(false);
    }
  }, [lcPage, search, lcGenero, lcInicial, lcLista, recarga, solicitudVigente]);

  useEffect(() => {
    if (fuente !== "leercapitulo") return;
    const solicitud = nuevaSolicitud("leercapitulo");
    // al refrescar no se vacía la grilla: se reemplaza cuando llega
    if (!pedirFresco.current) setLc(null);
    const t = setTimeout(() => void cargarLc(solicitud), search ? 400 : 0);
    return () => {
      clearTimeout(t);
      cancelarSolicitud("leercapitulo", solicitud);
    };
  }, [cargarLc, search, fuente, nuevaSolicitud, cancelarSolicitud]);

  const prevLcFiltros = useRef<string | null>(null);
  useEffect(() => {
    if (!restaurado) return;
    const clave = JSON.stringify({ search, lcGenero, lcInicial, lcLista });
    if (prevLcFiltros.current === null) {
      prevLcFiltros.current = clave;
      return;
    }
    if (prevLcFiltros.current !== clave) {
      prevLcFiltros.current = clave;
      setLcPage(1);
    }
  }, [restaurado, search, lcGenero, lcInicial, lcLista]);

  const refrescar = useCallback(() => {
    pedirFresco.current = true;
    setRefrescando(true);
    setRecarga((n) => n + 1);
  }, []);

  useEffect(() => {
    setIkigaiHay(ikigaiDisponible());
  }, []);

  useEffect(() => {
    // La fuente adulta depende siempre de la preferencia comprobada por el
    // servidor. En Play tampoco se conserva un permiso de la edición local.
    const enAndroid = isAndroidApp();
    if (!isPlayStoreApp()) setAnimeHabilitado(true);
    const aplicar = (me: {
      anime_enabled?: boolean;
      show_adult_content?: boolean;
      play_store_app?: boolean;
    } | null) => {
      if (enAndroid) {
        const habilitado = me ? Boolean(me.anime_enabled) : !isPlayStoreApp();
        setAnimeHabilitado(habilitado);
      }
      setAnimeAdultoHabilitado(
        Boolean(me?.show_adult_content) && !me?.play_store_app && !isPlayStoreApp()
      );
      setAdultoComprobado(true);
    };
    void (async () => {
      const guardada = await leerCacheAndroid<{
        anime_enabled?: boolean;
        show_adult_content?: boolean;
        play_store_app?: boolean;
      }>("sesion:me", {
        privateData: true,
        maxAgeMs: 30 * 24 * 60 * 60 * 1000,
      });
      if (guardada) aplicar(guardada.value);
      try {
        const res = await fetchConLimiteAndroid("/api/auth/me", {}, 8_000);
        if (!res.ok) { if (res.status === 401) aplicar(null); return; }
        const me = (await res.json()) as {
          anime_enabled?: boolean;
          show_adult_content?: boolean;
          play_store_app?: boolean;
        };
        aplicar(me);
        await guardarCacheAndroid("sesion:me", me, { privateData: true });
      } catch {
        // Con mala señal se conserva la preferencia comprobada anteriormente.
        setAdultoComprobado(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (adultoComprobado && animeFuente === "hentaitv" && !animeAdultoHabilitado) {
      setAnimeFuente("jkanime");
    }
  }, [adultoComprobado, animeAdultoHabilitado, animeFuente]);
  const [tmo, setTmo] = useState<SerieTmo[] | null>(null);
  const [tmoPage, setTmoPage] = useState(1);
  const [tmoMas, setTmoMas] = useState(false);
  const [tmoPaginas, setTmoPaginas] = useState(1);
  const [tmoPopulares, setTmoPopulares] = useState<SerieTmo[]>([]);

  // lo más leído de la semana, tal como lo publica ZonaTMO
  useEffect(() => {
    if (fuente !== "tmo" || tmoPopulares.length > 0) return;
    cargarConCacheAndroid(
      "explorar:tmo:populares:week",
      () => popularesTmo("week"),
      { freshForMs: 6 * 60 * 60 * 1000, onCached: setTmoPopulares }
    )
      .then(setTmoPopulares)
      .catch(() => setTmoPopulares([]));
  }, [fuente, tmoPopulares.length]);

  const cargarTmo = useCallback(async (solicitud: number) => {
    if (!solicitudVigente("tmo", solicitud)) return;
    setError(false);
    const fresco = pedirFresco.current;
    try {
      const r = await cargarConCacheAndroid(
        `explorar:tmo:${tmoPage}:${tmoTipo ?? ""}:${tmoDemo ?? ""}:${tmoEstado ?? ""}:${tmoGenero ?? ""}:${tmoOrden ?? ""}:${search.trim()}`,
        () =>
          catalogoTmo(
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
          ),
        {
          force: fresco,
          freshForMs: 15 * 60 * 1000,
          onCached: (guardado) => {
            if (!solicitudVigente("tmo", solicitud)) return;
            setTmo(guardado.series);
            setTmoMas(guardado.hayMas);
            setTmoPaginas(guardado.totalPaginas);
          },
        },
      );
      if (!solicitudVigente("tmo", solicitud)) return;
      setTmo(r.series);
      setTmoMas(r.hayMas);
      setTmoPaginas(r.totalPaginas);
    } catch (err) {
      if (!solicitudVigente("tmo", solicitud)) return;
      setError(true);
      setErrorDetalle(err instanceof Error ? err.message : null);
      setTmo([]);
    } finally {
      if (!solicitudVigente("tmo", solicitud)) return;
      pedirFresco.current = false;
      setRefrescando(false);
    }
  }, [tmoPage, search, tmoTipo, tmoDemo, tmoEstado, tmoGenero, tmoOrden, recarga, solicitudVigente]);

  useEffect(() => {
    if (fuente !== "tmo") return;
    const solicitud = nuevaSolicitud("tmo");
    if (!pedirFresco.current) setTmo(null);
    const t = setTimeout(() => void cargarTmo(solicitud), search ? 400 : 0);
    return () => {
      clearTimeout(t);
      cancelarSolicitud("tmo", solicitud);
    };
  }, [cargarTmo, search, fuente, nuevaSolicitud, cancelarSolicitud]);

  const prevTmoFiltros = useRef<string | null>(null);
  useEffect(() => {
    if (!restaurado) return;
    const clave = JSON.stringify({ search, tmoTipo, tmoDemo, tmoEstado, tmoGenero, tmoOrden });
    if (prevTmoFiltros.current === null) {
      prevTmoFiltros.current = clave;
      return;
    }
    if (prevTmoFiltros.current !== clave) {
      prevTmoFiltros.current = clave;
      setTmoPage(1);
    }
  }, [restaurado, search, tmoTipo, tmoDemo, tmoEstado, tmoGenero, tmoOrden]);

  const [iki, setIki] = useState<SerieIkigai[] | null>(null);
  const [ikiPage, setIkiPage] = useState(1);
  const [ikiMas, setIkiMas] = useState(false);

  const cargarIki = useCallback(async (solicitud: number) => {
    if (!solicitudVigente("ikigai", solicitud)) return;
    setError(false);
    try {
      const r = await cargarConCacheAndroid(
        `explorar:ikigai:${ikiPage}:${ikiTipo ?? ""}:${ikiGenero ?? ""}:${ikiOrden}:${search.trim()}`,
        () =>
          catalogoIkigai(ikiPage, {
            q: search.trim() || undefined,
            tipo: ikiTipo ?? undefined,
            genero: ikiGenero ?? undefined,
            orden: ikiOrden,
          }),
        {
          force: pedirFresco.current,
          freshForMs: 15 * 60 * 1000,
          onCached: (guardado) => {
            if (!solicitudVigente("ikigai", solicitud)) return;
            setIki(guardado.series);
            setIkiMas(guardado.hayMas);
          },
        }
      );
      if (!solicitudVigente("ikigai", solicitud)) return;
      setIki(r.series);
      setIkiMas(r.hayMas);
    } catch (err) {
      if (!solicitudVigente("ikigai", solicitud)) return;
      setError(true);
      setErrorDetalle(err instanceof Error ? err.message : null);
      setIki([]);
    } finally {
      if (!solicitudVigente("ikigai", solicitud)) return;
      pedirFresco.current = false;
      setRefrescando(false);
    }
  }, [ikiPage, search, ikiTipo, ikiGenero, ikiOrden, recarga, solicitudVigente]);

  useEffect(() => {
    if (fuente !== "ikigai") return;
    const solicitud = nuevaSolicitud("ikigai");
    if (!pedirFresco.current) setIki(null);
    const t = setTimeout(() => void cargarIki(solicitud), search ? 400 : 0);
    return () => {
      clearTimeout(t);
      cancelarSolicitud("ikigai", solicitud);
    };
  }, [cargarIki, search, fuente, nuevaSolicitud, cancelarSolicitud]);

  const prevIkiFiltros = useRef<string | null>(null);
  useEffect(() => {
    if (!restaurado) return;
    const clave = JSON.stringify({ search, ikiTipo, ikiGenero, ikiOrden });
    if (prevIkiFiltros.current === null) {
      prevIkiFiltros.current = clave;
      return;
    }
    if (prevIkiFiltros.current !== clave) {
      prevIkiFiltros.current = clave;
      setIkiPage(1);
    }
  }, [restaurado, search, ikiTipo, ikiGenero, ikiOrden]);

  const [olyOpciones, setOlyOpciones] = useState<{
    generos: { id: number; name: string }[];
    estados: { id: number; name: string }[];
    tipos: { id: string; name: string }[];
    ordenes: { id: string; name: string }[];
  } | null>(null);

  useEffect(() => {
    if (!lecturaActiva || fuente !== "olympus" || olyOpciones) return;
    cargarConCacheAndroid(
      "explorar:olympus:filtros",
      async (signal) => {
        const r = await fetch("/api/externo/olympus/filtros", { signal });
        if (!r.ok) throw new Error("filtros");
        return r.json();
      },
      { publicCache: true, freshForMs: 7 * 24 * 60 * 60 * 1000, onCached: setOlyOpciones }
    )
      .then(setOlyOpciones)
      .catch(() => {});
  }, [lecturaActiva, fuente, olyOpciones]);

  useEffect(() => {
    // No gastar una consulta a MangaDex al entrar directamente en Olympus.
    if (!lecturaActiva || fuente !== "mangadex" || genres.length > 0) return;
    cargarConCacheAndroid<Genre[]>(
      "explorar:mangadex:generos",
      async (signal) => {
        const r = await fetch("/api/externo/generos", { signal });
        if (!r.ok) throw new Error("generos");
        return r.json();
      },
      { freshForMs: 7 * 24 * 60 * 60 * 1000, onCached: setGenres }
    )
      .then((d) => Array.isArray(d) && setGenres(d))
      .catch(() => {});
  }, [lecturaActiva, fuente, genres.length]);

  // ── estado en la URL e historial de navegación ───────────────────────
  // Permite que retroceder (gesto de Android o botón atrás en mouse/navegador)
  // vuelva paso a paso entre páginas (10 -> 9 -> 8...) y preserve filtros.
  const navegandoPorPopState = useRef(false);
  const prevRef = useRef<{
    url: string;
    fuente: string;
    pagina: number;
    tag: string | null;
    orden: string;
  } | null>(null);

  const aplicarEstadoDesdeUrl = useCallback((p: URLSearchParams) => {
    const leer = (k: string) => p.get(k) || null;

    const fuenteAnime = leer("anime_fuente");
    if (fuenteAnime === "tioanime" || fuenteAnime === "hentaitv") setAnimeFuente(fuenteAnime);
    const f = leer("fuente") || (typeof window !== "undefined" ? sessionStorage.getItem("mangatotal:fuente-lectura") : null);
    if (f) setFuente(f);
    const q = leer("q");
    setSearch(q ?? "");
    setSelectedGenres(p.getAll("md_genre"));

    const pagina = Number(leer("p")) || 1;
    if (leer("md_order")) setOrder(leer("md_order")!);
    if (leer("md_lang")) setLang(leer("md_lang")!);
    const st = p.getAll("md_status");
    setStatus(st);
    const or = p.getAll("md_origin");
    setOrigin(or);
    if (f === "mangadex" || !f) {
      setOffset(pagina > 1 ? (pagina - 1) * 24 : 0);
    }

    if (leer("oly_orden")) setOlyOrden(leer("oly_orden")!);
    setOlyGenero(leer("oly_genero") ? Number(leer("oly_genero")) : null);
    setOlyEstado(leer("oly_estado") ? Number(leer("oly_estado")) : null);
    setOlyTipo(leer("oly_tipo"));
    if (f === "olympus") setOlympusPage(pagina);

    setTmoTipo(leer("tmo_tipo"));
    setTmoDemo(leer("tmo_demo"));
    setTmoEstado(leer("tmo_estado"));
    setTmoGenero(leer("tmo_genero"));
    setTmoOrden(leer("tmo_orden"));
    if (f === "tmo") setTmoPage(pagina);

    setIkiTipo(leer("iki_tipo"));
    setIkiGenero(leer("iki_genero"));
    if (leer("iki_orden")) setIkiOrden(leer("iki_orden")!);
    if (f === "ikigai") setIkiPage(pagina);

    setLcGenero(leer("lc_genero"));
    setLcInicial(leer("lc_inicial"));
    setLcLista(leer("lc_lista") ?? "");
    if (f === "leercapitulo") setLcPage(pagina);

    if (leer("cw_orden")) setCwOrden(leer("cw_orden")! as OrdenCw);
    if (f === "catharsis") setCwPage(pagina);

    const ehCatUrl = leer("eh_cat") ?? "todos";
    setEhCat(ehCatUrl);
    const ehLangUrl = leer("eh_lang") ?? "todos";
    setEhLang(ehLangUrl);
    const ehTagUrl = leer("eh_tag");
    setEhTag(ehTagUrl);
    const ehNextUrl = leer("eh_next");
    prevEhFiltros.current = JSON.stringify({
      search: q ?? "",
      ehCat: ehCatUrl,
      ehLang: ehLangUrl,
      ehTag: ehTagUrl,
    });
    if (f === "ehentai") {
      try {
        const claveCursores = `mangatotal:ehcursors:${JSON.stringify([(q ?? "").trim(), ehCatUrl, ehLangUrl, ehTagUrl ?? ""])}`;
        const guardados = JSON.parse(sessionStorage.getItem(claveCursores) || "{}") as Record<number, string | null>;
        ehCursors.current = { 1: null, ...guardados };
      } catch {
        ehCursors.current = { 1: null };
      }
      setEhPage(pagina);
      if (pagina > 1 && ehNextUrl) {
        ehCursors.current[pagina] = ehNextUrl;
        setEhNextCursor(ehNextUrl);
      } else {
        setEhNextCursor(ehCursors.current[pagina] ?? null);
      }
    }

    const hitomiTipoUrl = leer("hitomi_tipo");
    if (hitomiTipoUrl) setHitomiTipo(hitomiTipoUrl);
    const hitomiOrdenUrl = leer("hitomi_orden") || leer("hitomi_order") || leer("hi_orden");
    if (hitomiOrdenUrl) setHitomiOrden(hitomiOrdenUrl as HitomiOrden);
    const hitomiLangUrl = leer("hitomi_lang");
    setHitomiLang(hitomiLangUrl ?? "spanish");
    const hitomiTagUrl = leer("hitomi_tag") || leer("hi_tag");
    setHitomiTag(hitomiTagUrl);
    if (f === "hitomi") {
      setHitomiPage(pagina);
    }
  }, []);

  // Restauración inicial al montar y al llegar por enlace externo (ej. click en tag dentro de una ficha)
  const searchParamsStr = navigation.toString();
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (!restaurado) {
      aplicarEstadoDesdeUrl(p);
      setRestaurado(true);
      return;
    }
    const urlActual = window.location.href;
    if (prevRef.current && prevRef.current.url !== urlActual) {
      navegandoPorPopState.current = true;
      aplicarEstadoDesdeUrl(p);
    }
  }, [aplicarEstadoDesdeUrl, searchParamsStr, restaurado]);

  // Manejo del evento popstate (navegación atrás/adelante en navegador o gesto Android)
  useEffect(() => {
    const onPopState = () => {
      navegandoPorPopState.current = true;
      const p = new URLSearchParams(window.location.search);
      aplicarEstadoDesdeUrl(p);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [aplicarEstadoDesdeUrl]);

  // Reflejar el estado en la URL (pushState para cambios de página, tag, fuente u orden; replaceState para búsqueda continua)
  useEffect(() => {
    if (!restaurado) return;
    const url = new URL(window.location.href);
    const poner = (k: string, v: string | number | null | undefined) => {
      if (v === null || v === undefined || v === "" || v === 0) url.searchParams.delete(k);
      else url.searchParams.set(k, String(v));
    };

    poner("seccion", seccion === "animada" ? "animada" : null);
    poner("anime_fuente", seccion === "animada" && animeFuente !== "jkanime" ? animeFuente : null);
    poner("fuente", fuente === "mangadex" ? null : fuente);
    if (seccion === "lectura") poner("q", search.trim() || null);

    const pagina =
      fuente === "olympus"
        ? olympusPage
        : fuente === "tmo"
          ? tmoPage
          : fuente === "ikigai"
            ? ikiPage
            : fuente === "leercapitulo"
              ? lcPage
              : fuente === "catharsis"
                ? cwPage
                : fuente === "ehentai"
                  ? ehPage
                  : fuente === "hitomi"
                    ? hitomiPage
                    : Math.floor(offset / 24) + 1;
    poner("p", pagina > 1 ? pagina : null);

    poner("cw_orden", cwOrden === "novedades" ? null : cwOrden);
    poner("md_order", order === "latest" ? null : order);
    poner("md_lang", lang === "es" ? null : lang);
    url.searchParams.delete("md_genre");
    for (const genre of selectedGenres) url.searchParams.append("md_genre", genre);
    url.searchParams.delete("md_status");
    for (const s of status) url.searchParams.append("md_status", s);
    url.searchParams.delete("md_origin");
    for (const o of origin) url.searchParams.append("md_origin", o);

    poner("oly_orden", olyOrden === "novedades" ? null : olyOrden);
    poner("oly_genero", olyGenero);
    poner("oly_estado", olyEstado);
    poner("oly_tipo", olyTipo);
    poner("tmo_tipo", tmoTipo);
    poner("tmo_demo", tmoDemo);
    poner("tmo_estado", tmoEstado);
    poner("tmo_genero", tmoGenero);
    poner("tmo_orden", tmoOrden);
    poner("iki_tipo", ikiTipo);
    poner("iki_genero", ikiGenero);
    poner("iki_orden", ikiOrden === "recientes" ? null : ikiOrden);
    poner("lc_genero", lcGenero);
    poner("lc_inicial", lcInicial);
    poner("lc_lista", lcLista || null);

    poner("eh_cat", ehCat === "todos" ? null : ehCat);
    poner("eh_lang", ehLang === "todos" ? null : ehLang);
    poner("eh_tag", ehTag);
    poner("eh_next", ehPage > 1 ? (ehNextCursor || ehCursors.current[ehPage] || null) : null);

    poner("hitomi_tipo", hitomiTipo === "todos" ? null : hitomiTipo);
    poner("hitomi_orden", hitomiOrden === "date_added" ? null : hitomiOrden);
    poner("hitomi_lang", hitomiLang === "spanish" ? null : hitomiLang);
    poner("hitomi_tag", hitomiTag);

    const nuevaUrlStr = url.toString();
    try {
      sessionStorage.setItem("mangatotal:ultimo-explorar", url.pathname + url.search);
    } catch {}

    // Si venimos de un evento 'popstate' (el usuario pulsó atrás/adelante en el navegador o gesto en Android),
    // no creamos una nueva entrada en el historial para respetar la pila de navegación nativa.
    if (navegandoPorPopState.current) {
      navegandoPorPopState.current = false;
      prevRef.current = {
        url: nuevaUrlStr,
        fuente,
        pagina,
        tag: fuente === "hitomi" ? hitomiTag : fuente === "ehentai" ? ehTag : selectedGenres.join(","),
        orden: fuente === "hitomi" ? hitomiOrden : cwOrden,
      };
      return;
    }

    const tagActual = fuente === "hitomi" ? hitomiTag : fuente === "ehentai" ? ehTag : selectedGenres.join(",");
    const ordenActual = fuente === "hitomi" ? hitomiOrden : cwOrden;

    if (!prevRef.current) {
      prevRef.current = {
        url: nuevaUrlStr,
        fuente,
        pagina,
        tag: tagActual,
        orden: ordenActual,
      };
      window.history.replaceState(null, "", nuevaUrlStr);
      return;
    }

    if (prevRef.current.url === nuevaUrlStr) return;

    // Si cambió la página, la fuente, la etiqueta o el orden: pushState crea historial
    // para que retroceder paso a paso (ej: página 10 -> 9 -> 8...) funcione tal como pidió el usuario.
    const esPasoHistorial =
      pagina !== prevRef.current.pagina ||
      fuente !== prevRef.current.fuente ||
      tagActual !== prevRef.current.tag ||
      ordenActual !== prevRef.current.orden;

    if (esPasoHistorial) {
      window.history.pushState(null, "", nuevaUrlStr);
    } else {
      window.history.replaceState(null, "", nuevaUrlStr);
    }

    prevRef.current = {
      url: nuevaUrlStr,
      fuente,
      pagina,
      tag: tagActual,
      orden: ordenActual,
    };
  }, [
    restaurado, seccion, animeFuente, fuente, search, offset, order, lang, selectedGenres, origin, status,
    olympusPage, olyOrden, olyGenero, olyEstado, olyTipo,
    tmoPage, tmoTipo, tmoDemo, tmoEstado, tmoGenero, tmoOrden,
    ikiPage, ikiTipo, ikiGenero, ikiOrden,
    lcPage, lcGenero, lcInicial, lcLista,
    cwPage, cwOrden,
    ehPage, ehCat, ehLang, ehTag, ehNextCursor,
    hitomiPage, hitomiTipo, hitomiOrden, hitomiLang, hitomiTag,
  ]);

  // Guardar posición de scroll antes de salir de explorar o al hacer scroll
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const guardarScroll = () => {
      if (typeof window === "undefined") return;
      if (window.scrollY > 0) {
        sessionStorage.setItem("mangatotal:scroll:" + window.location.search, String(window.scrollY));
      }
    };
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(guardarScroll, 100);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (timer) clearTimeout(timer);
      guardarScroll();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Restaurar posición de scroll guardada cuando los elementos de la página terminan de cargarse
  useEffect(() => {
    const hayItems =
      (fuente === "mangadex" && series !== null && series.length > 0) ||
      (fuente === "olympus" && olympus !== null && olympus.length > 0) ||
      (fuente === "tmo" && ((tmo !== null && tmo.length > 0) || tmoPopulares.length > 0)) ||
      (fuente === "ikigai" && iki !== null && iki.length > 0) ||
      (fuente === "leercapitulo" && lc !== null && lc.length > 0) ||
      (fuente === "catharsis" && cw !== null && cw.length > 0) ||
      (fuente === "ehentai" && ehGalleries !== null && ehGalleries.length > 0) ||
      (fuente === "hitomi" && hitomiSeries !== null && hitomiSeries.length > 0);

    if (!hayItems) return;

    const key = "mangatotal:scroll:" + window.location.search;
    const guardado = typeof window !== "undefined" ? sessionStorage.getItem(key) : null;
    if (guardado) {
      const y = parseInt(guardado, 10);
      if (!isNaN(y) && y > 0) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
          setTimeout(() => {
            if (Math.abs(window.scrollY - y) > 60) {
              window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
            }
          }, 60);
        });
      }
    }
  }, [
    fuente,
    series,
    olympus,
    tmo,
    tmoPopulares,
    iki,
    lc,
    cw,
    ehGalleries,
    hitomiSeries,
  ]);

  const guardarScrollActual = useCallback(() => {
    if (typeof window !== "undefined" && window.scrollY > 0) {
      sessionStorage.setItem("mangatotal:scroll:" + window.location.search, String(window.scrollY));
    }
  }, []);

  const load = useCallback(async (solicitud: number) => {
    if (!solicitudVigente("mangadex", solicitud)) return;
    setError(false);
    const params = new URLSearchParams({ lang, offset: String(offset), order });
    for (const o of origin) params.append("origin", o);
    for (const s of status) params.append("status", s);
    for (const g of selectedGenres) params.append("tag", g);
    if (search.trim()) params.set("q", search.trim());
    const fresco = pedirFresco.current;
    try {
      const url = `/api/externo/series?${params}`;
      const data = await cargarConCacheAndroid<{ series: ExternalSeries[]; total: number }>(
        `explorar:mangadex:${params.toString()}`,
        async (signal) => {
          const res = await fetch(url, {
            cache: fresco ? "no-store" : "default",
            signal,
          });
          if (!res.ok) throw new Error("fallo");
          return res.json();
        },
        {
          force: fresco,
          freshForMs: 15 * 60 * 1000,
          onCached: (guardado) => {
            if (!solicitudVigente("mangadex", solicitud)) return;
            setSeries(guardado.series);
            setTotal(guardado.total);
          },
        }
      );
      if (!solicitudVigente("mangadex", solicitud)) return;
      setSeries(data.series);
      setTotal(data.total);
    } catch {
      if (!solicitudVigente("mangadex", solicitud)) return;
      setError(true);
      setSeries([]);
    } finally {
      if (!solicitudVigente("mangadex", solicitud)) return;
      pedirFresco.current = false;
      setRefrescando(false);
    }
  }, [lang, search, offset, order, status, selectedGenres, origin, recarga, solicitudVigente]);

  useEffect(() => {
    if (!lecturaActiva || fuente !== "mangadex") return;
    const solicitud = nuevaSolicitud("mangadex");
    if (!pedirFresco.current) setSeries(null);
    const t = setTimeout(() => void load(solicitud), search ? 350 : 0);
    return () => {
      clearTimeout(t);
      cancelarSolicitud("mangadex", solicitud);
    };
  }, [load, search, fuente, lecturaActiva, nuevaSolicitud, cancelarSolicitud]);

  const cargarOlympus = useCallback(async (solicitud: number) => {
    if (!solicitudVigente("olympus", solicitud)) return;
    setError(false);
    const params = new URLSearchParams({ page: String(olympusPage), orden: olyOrden });
    if (search.trim()) params.set("q", search.trim());
    if (olyGenero) params.set("genero", String(olyGenero));
    if (olyEstado) params.set("estado", String(olyEstado));
    if (olyTipo) params.set("tipo", olyTipo);
    const fresco = pedirFresco.current;
    try {
      const url = `/api/externo/olympus/series?${params}`;
      const data = await cargarConCacheAndroid<{
        series: SerieOlympus[];
        last_page: number;
      }>(
        `explorar:olympus:${params.toString()}`,
        async (signal) => {
          const res = await fetch(url, {
            cache: fresco ? "no-store" : "default",
            signal,
          });
          if (!res.ok) throw new Error("fallo");
          return res.json();
        },
        {
          publicCache: true,
          timeoutMs: 30_000,
          maxAgeMs: 24 * 60 * 60 * 1000,
          force: fresco,
          freshForMs: 15 * 60 * 1000,
          onCached: (guardado) => {
            if (!solicitudVigente("olympus", solicitud)) return;
            setOlympus(guardado.series);
            setOlympusLastPage(guardado.last_page);
          },
        }
      );
      if (!solicitudVigente("olympus", solicitud)) return;
      setOlympus(data.series);
      setOlympusLastPage(data.last_page);
    } catch {
      if (!solicitudVigente("olympus", solicitud)) return;
      setError(true);
      setOlympus([]);
    } finally {
      if (!solicitudVigente("olympus", solicitud)) return;
      pedirFresco.current = false;
      setRefrescando(false);
    }
  }, [olympusPage, search, olyOrden, olyGenero, olyEstado, olyTipo, recarga, solicitudVigente]);

  useEffect(() => {
    if (!lecturaActiva || fuente !== "olympus") return;
    const solicitud = nuevaSolicitud("olympus");
    if (!pedirFresco.current) setOlympus(null);
    const t = setTimeout(() => void cargarOlympus(solicitud), search ? 350 : 0);
    return () => {
      clearTimeout(t);
      cancelarSolicitud("olympus", solicitud);
    };
  }, [cargarOlympus, search, fuente, lecturaActiva, nuevaSolicitud, cancelarSolicitud]);

  const prevOlyFiltros = useRef<string | null>(null);
  useEffect(() => {
    if (!restaurado) return;
    const clave = JSON.stringify({ search, olyOrden, olyGenero, olyEstado, olyTipo });
    if (prevOlyFiltros.current === null) {
      prevOlyFiltros.current = clave;
      return;
    }
    if (prevOlyFiltros.current !== clave) {
      prevOlyFiltros.current = clave;
      setOlympusPage(1);
    }
  }, [restaurado, search, olyOrden, olyGenero, olyEstado, olyTipo]);

  // cambiar cualquier filtro vuelve a la primera página solo si se modificó interactivamente
  const prevMdFiltros = useRef<string | null>(null);
  useEffect(() => {
    if (!restaurado) return;
    const clave = JSON.stringify({ lang, search, order, status, selectedGenres, origin });
    if (prevMdFiltros.current === null) {
      prevMdFiltros.current = clave;
      return;
    }
    if (prevMdFiltros.current !== clave) {
      prevMdFiltros.current = clave;
      setOffset(0);
    }
  }, [restaurado, lang, search, order, status, selectedGenres, origin]);

  const cargarEh = useCallback(async (solicitud: number) => {
    if (!solicitudVigente("ehentai", solicitud)) return;
    setError(false);
    const fresco = pedirFresco.current;
    // E-Hentai pagina por cursor (gid). Al abrir una serie, leerla y volver, el
    // componente se monta de nuevo y el mapa en memoria se pierde: sin esto la
    // página siguiente (ej. 10 -> 11) o anterior se quedaba sin cursor. Se
    // persiste el mapa de cursores por combinación de filtros en sessionStorage.
    const claveCursores = `mangatotal:ehcursors:${JSON.stringify([search.trim(), ehCat, ehLang, ehTag ?? ""])}`;
    const leerCursores = (): Record<number, string | null> => {
      try {
        return JSON.parse(sessionStorage.getItem(claveCursores) || "{}");
      } catch {
        return {};
      }
    };
    const anotarCursor = (pagina: number, cursor: string) => {
      ehCursors.current[pagina] = cursor;
      try {
        const todos = leerCursores();
        todos[pagina] = cursor;
        sessionStorage.setItem(claveCursores, JSON.stringify(todos));
      } catch {}
    };
    try {
      let cursorActual = ehCursors.current[ehPage] ?? null;
      if (ehPage > 1 && !cursorActual) {
        cursorActual = leerCursores()[ehPage] ?? null;
        if (cursorActual) ehCursors.current[ehPage] = cursorActual;
      }
      if (ehPage > 1 && !cursorActual) {
        setEhNextCursor(null);
        setEhPage(1);
        return;
      }
      if (ehPage > 1 && cursorActual) {
        anotarCursor(ehPage, cursorActual);
      }

      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (ehCat && ehCat !== "todos") params.set("cat", ehCat);
      if (ehLang && ehLang !== "todos") params.set("lang", ehLang);
      if (ehTag && ehTag.trim()) params.set("tag", ehTag.trim());
      if (cursorActual) params.set("next", cursorActual);
      if (fresco) params.set("fresco", "1");

      const cacheKey = `explorar:ehentai:v3:${ehPage}:${cursorActual ?? "inicio"}:${ehCat}:${ehLang}:${ehTag ?? ""}:${search.trim()}`;

      const r = await cargarConCacheAndroid<{
        series: SerieEhentai[];
        hayMas: boolean;
        nextCursor?: string | null;
        prevCursor?: string | null;
      }>(
        cacheKey,
        async (signal) => {
          const res = await fetch(`/api/externo/ehentai?${params.toString()}`, {
            cache: fresco ? "no-store" : "default",
            signal,
          });
          if (!res.ok) {
            const errJson = await res.json().catch(() => null);
            throw new Error(errJson?.error || "Error al cargar E-Hentai");
          }
          return res.json();
        },
        {
          publicCache: true,
          force: fresco,
          freshForMs: 5 * 60 * 1000,
          onCached: (guardado) => {
            if (!solicitudVigente("ehentai", solicitud)) return;
            if (guardado.nextCursor) {
              anotarCursor(ehPage + 1, guardado.nextCursor);
            }
            setEhGalleries(guardado.series);
            setEhHayMas(guardado.hayMas);
          },
        }
      );
      if (!solicitudVigente("ehentai", solicitud)) return;
      if (r.nextCursor) {
        anotarCursor(ehPage + 1, r.nextCursor);
      }
      setEhGalleries(r.series);
      setEhHayMas(r.hayMas);
    } catch (err) {
      if (!solicitudVigente("ehentai", solicitud)) return;
      setError(true);
      setErrorDetalle(err instanceof Error ? err.message : null);
      setEhGalleries([]);
    } finally {
      if (!solicitudVigente("ehentai", solicitud)) return;
      pedirFresco.current = false;
      setRefrescando(false);
    }
  }, [ehPage, search, ehCat, ehLang, ehTag, recarga, solicitudVigente]);

  useEffect(() => {
    if (fuente !== "ehentai" || !animeAdultoHabilitado) return;
    const solicitud = nuevaSolicitud("ehentai");
    if (!pedirFresco.current) setEhGalleries(null);
    const t = setTimeout(() => void cargarEh(solicitud), search ? 400 : 0);
    return () => {
      clearTimeout(t);
      cancelarSolicitud("ehentai", solicitud);
    };
  }, [cargarEh, search, fuente, animeAdultoHabilitado, nuevaSolicitud, cancelarSolicitud]);

  const prevEhFiltros = useRef<string | null>(null);
  useEffect(() => {
    if (!restaurado) return;
    const clave = JSON.stringify({ search, ehCat, ehLang, ehTag });
    if (prevEhFiltros.current === null) {
      prevEhFiltros.current = clave;
      return;
    }
    if (prevEhFiltros.current !== clave) {
      prevEhFiltros.current = clave;
      ehCursors.current = { 1: null };
      setEhNextCursor(null);
      setEhPage(1);
    }
  }, [restaurado, search, ehCat, ehLang, ehTag]);

  const cargarHitomi = useCallback(async (solicitud: number) => {
    if (!solicitudVigente("hitomi", solicitud)) return;
    setError(false);
    const fresco = pedirFresco.current;
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (hitomiTipo && hitomiTipo !== "todos") params.set("tipo", hitomiTipo);
      if (hitomiOrden) params.set("orden", hitomiOrden);
      if (hitomiLang) params.set("lang", hitomiLang);
      if (hitomiTag && hitomiTag.trim()) params.set("tag", hitomiTag.trim());
      params.set("page", String(hitomiPage));

      const cacheKey = `explorar:hitomi:v3:${hitomiPage}:${hitomiTipo}:${hitomiOrden}:${hitomiLang}:${hitomiTag ?? ""}:${search.trim()}`;

      const r = await cargarConCacheAndroid<{
        series: SerieHitomi[];
        pagina: number;
        totalPaginas: number;
        totalResultados: number;
        hayMas: boolean;
      }>(
        cacheKey,
        async (signal) => {
          const res = await fetch(`/api/externo/hitomi?${params.toString()}`, {
            cache: fresco ? "no-store" : "default",
            signal,
          });
          if (!res.ok) {
            const errJson = await res.json().catch(() => null);
            throw new Error(errJson?.error || "Error al cargar Hitomi.la");
          }
          return res.json();
        },
        {
          publicCache: true,
          force: fresco,
          freshForMs: 5 * 60 * 1000,
          onCached: (guardado) => {
            if (!solicitudVigente("hitomi", solicitud)) return;
            setHitomiSeries(guardado.series);
            setHitomiHayMas(guardado.hayMas);
            setHitomiTotalPaginas(guardado.totalPaginas);
          },
        }
      );
      if (!solicitudVigente("hitomi", solicitud)) return;
      setHitomiSeries(r.series);
      setHitomiHayMas(r.hayMas);
      setHitomiTotalPaginas(r.totalPaginas);
    } catch (err) {
      if (!solicitudVigente("hitomi", solicitud)) return;
      setError(true);
      setErrorDetalle(err instanceof Error ? err.message : null);
      setHitomiSeries([]);
    } finally {
      if (!solicitudVigente("hitomi", solicitud)) return;
      pedirFresco.current = false;
      setRefrescando(false);
    }
  }, [hitomiPage, search, hitomiTipo, hitomiOrden, hitomiLang, hitomiTag, recarga, solicitudVigente]);

  useEffect(() => {
    if (fuente !== "hitomi" || !animeAdultoHabilitado) return;
    const solicitud = nuevaSolicitud("hitomi");
    if (!pedirFresco.current) setHitomiSeries(null);
    const t = setTimeout(() => void cargarHitomi(solicitud), search ? 400 : 0);
    return () => {
      clearTimeout(t);
      cancelarSolicitud("hitomi", solicitud);
    };
  }, [cargarHitomi, search, fuente, animeAdultoHabilitado, nuevaSolicitud, cancelarSolicitud]);

  const prevHitomiFiltros = useRef<string | null>(null);
  useEffect(() => {
    if (!restaurado) return;
    const clave = JSON.stringify({ search, hitomiTipo, hitomiOrden, hitomiLang, hitomiTag });
    if (prevHitomiFiltros.current === null) {
      prevHitomiFiltros.current = clave;
      return;
    }
    if (prevHitomiFiltros.current !== clave) {
      prevHitomiFiltros.current = clave;
      setHitomiPage(1);
    }
  }, [restaurado, search, hitomiTipo, hitomiOrden, hitomiLang, hitomiTag]);

  useEffect(() => {
    if (adultoComprobado && (fuente === "ehentai" || fuente === "hitomi") && !animeAdultoHabilitado) {
      setFuente("mangadex");
    }
  }, [adultoComprobado, animeAdultoHabilitado, fuente]);

  function toggleIn(list: string[], value: string, set: (v: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const activeFilters = status.length + selectedGenres.length + origin.length;

  const page = Math.floor(offset / 24) + 1;
  const lastPage = Math.max(1, Math.ceil(Math.min(total, 9500) / 24));

  const cambiarFuente = (siguiente: string) => {
    if (siguiente === fuente) return;
    try { sessionStorage.setItem("mangatotal:fuente-lectura", siguiente); } catch {}
    setSearch("");
    setFuente(siguiente);
  };

  const cambiarFuenteAnime = (siguiente: FuenteAnime) => {
    if (siguiente === animeFuente) return;
    // Los nombres y valores de los filtros pertenecen a cada fuente.
    const url = new URL(location.href);
    for (const key of ["vista", "q", "genre", "sort", "status", "type", "year", "year_from", "year_to", "season", "letter", "anime_page", "demographic", "category", "order"]) url.searchParams.delete(key);
    url.searchParams.set("anime_fuente", siguiente);
    history.replaceState(history.state, "", url);
    setSearch("");
    setAnimeFuente(siguiente);
  };

  if (seccion === "animada" && animeHabilitado) {
    return (
      <div className="od-explore space-y-6">
        <h1 className="sr-only">Explorar anime</h1>
        <div className="od-explore-switcher">
        <span className="od-eyebrow">Anime · Descubrí tu próxima historia</span>

        <div className="od-source-switcher">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[11px] font-medium text-faint">
              Fuente
            </span>
            {(["jkanime", "tioanime"] as const).map((source) => (
              <Chip
                type="button"
                key={source}
                onClick={() => cambiarFuenteAnime(source)}
                selected={animeFuente === source}
              >
                {source === "jkanime" ? "JKAnime" : "TioAnime"}
              </Chip>
            ))}
          </div>
          {animeAdultoHabilitado && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 font-mono text-[11px] font-medium text-faint">
                Fuente +18
              </span>
              <Chip
                type="button"
                onClick={() => cambiarFuenteAnime("hentaitv")}
                selected={animeFuente === "hentaitv"}
              >
                HentaiTV
              </Chip>
            </div>
          )}
        </div>
        </div>

        {animeFuente === "hentaitv" && animeAdultoHabilitado ? (
          <HentaitvCatalog />
        ) : (
          <AnimeDiscover key={animeFuente} source={animeFuente === "tioanime" ? "tioanime" : "jkanime"} />
        )}
      </div>
    );
  }

  return (
    <div className="od-explore space-y-6">
      <h1 className="sr-only">Todos los títulos</h1>
      <div className="od-explore-switcher">
        <span className="od-eyebrow">Lectura · Todos los títulos</span>

        <div className="od-source-switcher">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[11px] font-medium text-faint">
              Fuente
            </span>
        {[
          ...FUENTES,
          { key: "tmo", label: "ZonaTMO" },
          // LeerCapítulo se oculta mientras su servidor devuelva las páginas
          // desordenadas (ver el interruptor en src/lib/leercapitulo.ts)
          ...(LC_HABILITADA ? [{ key: "leercapitulo", label: "LeerCapítulo" }] : []),
          { key: "catharsis", label: "Catharsis" },
          // Ikigai sí necesita el puente nativo: bloquea a los centros de datos
          ...(ikigaiHay ? [{ key: "ikigai", label: "Ikigai" }] : []),
        ].map((f) => (
          <Chip
            type="button"
            key={f.key}
            onClick={() => cambiarFuente(f.key)}
            selected={fuente === f.key}
          >
            {f.label}
          </Chip>
        ))}
          </div>
          {animeAdultoHabilitado && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 font-mono text-[11px] font-medium text-faint">
                Fuente +18
              </span>
              <Chip
                type="button"
                onClick={() => cambiarFuente("ehentai")}
                selected={fuente === "ehentai"}
              >
                E-Hentai (+18)
              </Chip>
              <Chip
                type="button"
                onClick={() => cambiarFuente("hitomi")}
                selected={fuente === "hitomi"}
              >
                Hitomi.la (+18)
              </Chip>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {fuente === "mangadex" && (
        <div className="flex gap-1 rounded-md border border-line bg-panel p-1">
          {LANGS.map((l) => (
            <button
              key={l.key}
              onClick={() => setLang(l.key)}
              className={`min-h-9 rounded-sm px-4 text-sm font-medium transition-colors ${
                lang === l.key ? "bg-accent text-[var(--on-accent)]" : "text-subtle hover:text-ink"
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
          className="min-h-11 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink outline-none transition-colors focus:border-accent-ink disabled:opacity-40"
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
          className={`min-h-11 rounded-md border px-4 text-sm font-medium transition-colors ${
            activeFilters > 0
              ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
              : "border-line-strong text-subtle hover:border-ink hover:text-ink"
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
              className="min-h-11 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink outline-none transition-colors focus:border-accent-ink"
            >
              {olyOpciones.ordenes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`min-h-11 rounded-md border px-4 text-sm font-medium transition-colors ${
                olyGenero || olyEstado || olyTipo
                  ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                  : "border-line-strong text-subtle hover:border-ink hover:text-ink"
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
            className="min-h-11 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink outline-none transition-colors focus:border-accent-ink"
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
            className="min-h-11 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink outline-none transition-colors focus:border-accent-ink"
          >
            {LC_LISTAS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}

        {fuente === "catharsis" && (
          <select
            value={cwOrden}
            onChange={(e) => setCwOrden(e.target.value as OrdenCw)}
            className="min-h-11 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink outline-none transition-colors focus:border-accent-ink"
          >
            <option value="novedades">Novedades</option>
            <option value="nombre">A–Z</option>
            <option value="capitulos">Más capítulos</option>
          </select>
        )}

        {fuente === "tmo" && (
          <select
            value={tmoOrden ?? ""}
            onChange={(e) => setTmoOrden(e.target.value || null)}
            className="min-h-11 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink outline-none transition-colors focus:border-accent-ink"
          >
            {TMO_ORDENES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}

        {fuente === "ehentai" && (
          <>
            <select
              value={ehCat}
              onChange={(e) => setEhCat(e.target.value)}
              className="min-h-11 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink outline-none transition-colors focus:border-accent-ink"
            >
              <option value="todos">Todas las categorías</option>
              {EHENTAI_CATEGORIAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

            <select
              value={ehLang}
              onChange={(e) => setEhLang(e.target.value)}
              className="min-h-11 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink outline-none transition-colors focus:border-accent-ink"
            >
              {EHENTAI_IDIOMAS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setEhModalTags(true)}
              className={`min-h-11 rounded-md border px-4 text-sm font-medium transition-colors ${
                ehTag
                  ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                  : "border-line-strong text-subtle hover:border-ink hover:text-ink"
              }`}
            >
              {ehTag ? `🏷️ Tag: ${ehTag}` : "🏷️ Etiquetas (+270)"}
            </button>
            {ehTag && (
              <button
                onClick={() => setEhTag(null)}
                className="text-xs font-semibold text-danger hover:underline"
                title="Quitar filtro de etiqueta"
              >
                ✕ Quitar tag
              </button>
            )}
          </>
        )}

        {fuente === "hitomi" && (
          <>
            <select
              value={hitomiLang}
              onChange={(e) => {
                setHitomiLang(e.target.value);
                setHitomiPage(1);
              }}
              aria-label="Idioma de Hitomi.la"
              className="min-h-11 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink outline-none transition-colors focus:border-accent-ink"
            >
              {HITOMI_IDIOMAS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>

            <select
              value={hitomiOrden}
              onChange={(e) => {
                setHitomiOrden(e.target.value as HitomiOrden);
                setHitomiPage(1);
              }}
              aria-label="Ordenar por"
              className="min-h-11 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink outline-none transition-colors focus:border-accent-ink"
            >
              {HITOMI_ORDENES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setHitomiModalTags(true)}
              className={`min-h-11 rounded-md border px-4 text-sm font-medium transition-colors ${
                hitomiTag
                  ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                  : "border-line-strong text-subtle hover:border-ink hover:text-ink"
              }`}
            >
              {hitomiTag ? `🏷️ Tag: ${hitomiTag}` : "🏷️ Etiquetas (+100)"}
            </button>
            {hitomiTag && (
              <button
                type="button"
                onClick={() => {
                  setHitomiTag(null);
                  setHitomiPage(1);
                }}
                className="text-xs font-semibold text-danger hover:underline"
                title="Quitar filtro de etiqueta"
              >
                ✕ Quitar tag
              </button>
            )}
          </>
        )}

        {(fuente === "tmo" || fuente === "ikigai" || fuente === "leercapitulo") && (
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`min-h-11 rounded-md border px-4 text-sm font-medium transition-colors ${
              (fuente === "tmo"
                ? tmoTipo || tmoDemo || tmoEstado || tmoGenero
                : fuente === "leercapitulo"
                  ? lcGenero || lcInicial
                  : ikiTipo || ikiGenero)
                ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                : "border-line-strong text-subtle hover:border-ink hover:text-ink"
            }`}
          >
            Filtros
          </button>
        )}

        <button
          onClick={refrescar}
          disabled={refrescando}
          title="Volver a pedir esta lista, sin usar lo guardado"
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line-strong px-4 text-sm font-medium text-subtle transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
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
          className={`ml-auto max-w-sm ${fieldControlClass}`}
        />
      </div>

      {showFilters && fuente === "mangadex" && (
        <Surface className="space-y-5 p-5">
          <div>
            <p className="mb-2 font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
              Tipo
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ORIGINS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => toggleIn(origin, o.key, setOrigin)}
                  className={`relative inline-flex h-9 items-center rounded-md border px-3 text-[13px] transition-colors after:absolute after:-inset-1 after:content-[''] ${
                    origin.includes(o.key)
                      ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                      : "border-line-strong text-subtle hover:border-ink hover:text-ink"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
              Estado
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => toggleIn(status, s.key, setStatus)}
                  className={`relative inline-flex h-9 items-center rounded-md border px-3 text-[13px] transition-colors after:absolute after:-inset-1 after:content-[''] ${
                    status.includes(s.key)
                      ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                      : "border-line-strong text-subtle hover:border-ink hover:text-ink"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {genres.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
                Géneros
              </p>
              <div className="flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => toggleIn(selectedGenres, g.id, setSelectedGenres)}
                    className={`relative inline-flex h-9 items-center rounded-md border px-3 text-[13px] transition-colors after:absolute after:-inset-1 after:content-[''] ${
                      selectedGenres.includes(g.id)
                        ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                        : "border-line-strong text-subtle hover:border-ink hover:text-ink"
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
              className="text-sm font-medium text-subtle transition-colors hover:text-accent-ink"
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
        <p className="py-16 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
          Cargando catálogo...
        </p>
      ) : series.length === 0 && !error ? (
        <Surface className="p-12 text-center">
          <p className="text-lg font-bold text-ink">Sin resultados</p>
          <p className="mt-1 text-sm text-subtle">Probá con otro término o cambiá el idioma.</p>
        </Surface>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {series.map((s, idx) => (
            <Link
              key={s.id}
              href={`/externo/${s.id}`}
              onClick={guardarScrollActual}
              className={`group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${guardada("mangadex", s.id) ? "opacity-60" : ""}`}
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[var(--surface-raised)] border border-line transition-colors group-hover:border-line-strong">
                <MarcaGuardada visible={guardada("mangadex", s.id)} />
                {s.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.cover_url}
                    alt={s.title}
                    className="h-full w-full object-cover transition duration-500"
                    loading={idx < 4 ? "eager" : "lazy"}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(e) => retryThroughProxy(e.currentTarget)}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
                    Sin portada
                  </div>
                )}
                {s.is_adult && (
                  <span className="absolute left-3 top-3 rounded-md border border-danger bg-[color-mix(in_oklch,var(--bg)_82%,transparent)] px-2.5 py-1 font-mono text-[11px] font-bold tracking-[0.1em] text-danger ">
                    +18
                  </span>
                )}
              </div>
              <div className="px-1 pt-3">
                <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
                  {s.title}
                </h3>
                <p className="mt-1 font-mono text-[13px] text-faint">
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
            onClick={() => {
              setOffset(Math.max(0, offset - 24));
              window.scrollTo({ top: 0, behavior: "instant" });
            }}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">
            Página {page} de {lastPage}
          </span>
          <button
            disabled={page >= lastPage}
            onClick={() => {
              setOffset(offset + 24);
              window.scrollTo({ top: 0, behavior: "instant" });
            }}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      {showFilters && fuente === "olympus" && olyOpciones && (
        <Surface className="space-y-5 p-5">
          <div>
            <p className="mb-2 font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
              Tipo
            </p>
            <div className="flex flex-wrap gap-1.5">
              {olyOpciones.tipos.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOlyTipo(olyTipo === t.id ? null : t.id)}
                  className={`relative inline-flex h-9 items-center rounded-md border px-3 text-[13px] transition-colors after:absolute after:-inset-1 after:content-[''] ${
                    olyTipo === t.id
                      ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                      : "border-line-strong text-subtle hover:border-ink hover:text-ink"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
              Estado
            </p>
            <div className="flex flex-wrap gap-1.5">
              {olyOpciones.estados.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setOlyEstado(olyEstado === e.id ? null : e.id)}
                  className={`relative inline-flex h-9 items-center rounded-md border px-3 text-[13px] transition-colors after:absolute after:-inset-1 after:content-[''] ${
                    olyEstado === e.id
                      ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                      : "border-line-strong text-subtle hover:border-ink hover:text-ink"
                  }`}
                >
                  {e.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
              Género <span className="normal-case opacity-70">(uno por vez)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {olyOpciones.generos.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setOlyGenero(olyGenero === g.id ? null : g.id)}
                  className={`relative inline-flex h-9 items-center rounded-md border px-3 text-[13px] transition-colors after:absolute after:-inset-1 after:content-[''] ${
                    olyGenero === g.id
                      ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                      : "border-line-strong text-subtle hover:border-ink hover:text-ink"
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
              className="text-sm font-medium text-subtle transition-colors hover:text-accent-ink"
            >
              ✕ Limpiar filtros
            </button>
          )}
        </Surface>
      )}

      {fuente === "olympus" && (
        olympus === null ? (
          <p className="py-16 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
            Cargando catálogo de Olympus...
          </p>
        ) : olympus.length === 0 && !error ? (
          <Surface className="p-12 text-center">
            <p className="text-lg font-bold text-ink">Sin resultados</p>
            <p className="mt-1 text-sm text-subtle">Probá con otro término.</p>
          </Surface>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {olympus.map((s, idx) => (
                <Link
                  key={s.id}
                  href={`/externo/olympus/${s.slug}`}
                  prefetch={false}
                  onClick={guardarScrollActual}
                  className={`group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${guardada("olympus", s.slug, s.type) ? "opacity-60" : ""}`}
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[var(--surface-raised)] border border-line transition-colors group-hover:border-line-strong">
                    <MarcaGuardada visible={guardada("olympus", s.slug, s.type)} />
                    {s.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.cover_url}
                        alt={s.title}
                        className="h-full w-full object-cover transition duration-500"
                        loading={idx < 4 ? "eager" : "lazy"}
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => retryThroughProxy(e.currentTarget)}
                      />
                    )}
                  </div>
                  <div className="px-1 pt-3">
                    <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
                      {s.title}
                    </h3>
                    <p className="mt-1 font-mono text-[13px] text-faint">
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
                  onClick={() => {
                    setOlympusPage(olympusPage - 1);
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">
                  Página {olympusPage} de {olympusLastPage}
                </span>
                <button
                  disabled={olympusPage >= olympusLastPage}
                  onClick={() => {
                    setOlympusPage(olympusPage + 1);
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
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
              <p className="mb-2 font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
                {grupo.titulo}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {grupo.opciones.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => grupo.set(grupo.valor === o.id ? null : o.id)}
                    className={`relative inline-flex h-9 items-center rounded-md border px-3 text-[13px] transition-colors after:absolute after:-inset-1 after:content-[''] ${
                      grupo.valor === o.id
                        ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
                        : "border-line-strong text-subtle hover:border-ink hover:text-ink"
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
            className="text-sm font-medium text-subtle transition-colors hover:text-accent-ink"
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
            <h2 className="mb-4 font-display text-xl font-bold tracking-[-0.03em] text-ink">
              Lo más leído esta semana
            </h2>
            <div className="-mx-1 flex min-w-0 gap-4 overflow-x-auto px-1 pb-2">
              {tmoPopulares.map((t) => (
                <Link
                  key={t.id}
                  href={`/externo/tmo/${t.tipo}/${t.id}/${t.slug}`}
                  onClick={guardarScrollActual}
                  className={`group w-32 shrink-0 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-36 ${guardada("tmo", `${t.tipo}/${t.id}/${t.slug}`) ? "opacity-60" : ""}`}
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[var(--surface-raised)] border border-line transition-colors group-hover:border-line-strong">
                    <MarcaGuardada visible={guardada("tmo", `${t.tipo}/${t.id}/${t.slug}`)} />
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
                  <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-tight text-ink transition-colors group-hover:text-accent-ink">
                    {t.title}
                  </h3>
                </Link>
              ))}
            </div>
          </section>
        )}

      {fuente === "catharsis" && (
        cw === null ? (
          <p className="py-16 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
            Cargando catálogo de Catharsis World...
          </p>
        ) : cw.length === 0 ? (
          <Surface className="p-12 text-center">
            <p className="text-lg font-bold text-ink">Sin resultados</p>
            <p className="mt-1 text-sm text-subtle">Probá con otro término.</p>
          </Surface>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {cw.map((s, idx) => (
                <Link
                  key={s.id}
                  href={`/externo/catharsis/${s.id}`}
                  onClick={guardarScrollActual}
                  className={`group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${guardada("catharsis", s.id) ? "opacity-60" : ""}`}
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[var(--surface-raised)] border border-line transition-colors group-hover:border-line-strong">
                    <MarcaGuardada visible={guardada("catharsis", s.id)} />
                    {s.portada && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imagenCw(s.portada, 256)}
                        alt={s.nombre}
                        className="h-full w-full object-cover transition duration-500"
                        loading={idx < 4 ? "eager" : "lazy"}
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => retryThroughProxy(e.currentTarget)}
                      />
                    )}
                    <span className="absolute right-2 top-2 rounded-full bg-[color-mix(in_oklch,var(--bg)_86%,transparent)] px-2 py-1 font-mono text-[11px] font-bold tracking-[0.1em] text-accent-ink ">
                      {s.capitulos} cap.
                    </span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 px-1 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
                    {s.nombre}
                  </h3>
                </Link>
              ))}
            </div>

            {cwPaginas > 1 && (
              <div className="flex items-center justify-center gap-3 pt-8">
                <button
                  disabled={cwPage <= 1}
                  onClick={() => {
                    setCwPage(cwPage - 1);
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">
                  Página {cwPage} de {cwPaginas}
                </span>
                <button
                  disabled={cwPage >= cwPaginas}
                  onClick={() => {
                    setCwPage(cwPage + 1);
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )
      )}

      {fuente === "leercapitulo" && (
        lc === null ? (
          <p className="py-16 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
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
              <p className="mb-4 font-mono text-[11px] tracking-[0.06em] text-subtle">
                Últimas actualizaciones · elegí un género o una inicial para recorrer todo
              </p>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {lc.map((t, idx) => (
                <Link
                  key={t.id}
                  href={`/externo/leercapitulo/${t.id}/${t.slug}`}
                  onClick={guardarScrollActual}
                  className={`group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${guardada("leercapitulo", `${t.id}/${t.slug}`) ? "opacity-60" : ""}`}
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[var(--surface-raised)] border border-line transition-colors group-hover:border-line-strong">
                    <MarcaGuardada visible={guardada("leercapitulo", `${t.id}/${t.slug}`)} />
                    {t.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.cover_url}
                        alt={t.title}
                        className="h-full w-full object-cover transition duration-500"
                        loading={idx < 4 ? "eager" : "lazy"}
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => retryThroughProxy(e.currentTarget)}
                      />
                    )}
                  </div>
                  <h3 className="mt-3 line-clamp-2 px-1 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
                    {t.title}
                  </h3>
                </Link>
              ))}
            </div>

            {lcPaginable && (
              <div className="flex items-center justify-center gap-3 pt-8">
                <button
                  disabled={lcPage <= 1}
                  onClick={() => {
                    setLcPage(lcPage - 1);
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">
                  Página {lcPage}
                </span>
                <button
                  disabled={!lcMas}
                  onClick={() => {
                    setLcPage(lcPage + 1);
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
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
          <p className="py-16 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
            Cargando catálogo de ZonaTMO...
          </p>
        ) : tmo.length === 0 ? (
          <Surface className="p-12 text-center">
            <p className="text-lg font-bold text-ink">Sin resultados</p>
            <p className="mt-1 text-sm text-subtle">Probá con otro término.</p>
          </Surface>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {tmo.map((t, idx) => (
                <Link
                  key={t.id}
                  href={`/externo/tmo/${t.tipo}/${t.id}/${t.slug}`}
                  onClick={guardarScrollActual}
                  className={`group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${guardada("tmo", `${t.tipo}/${t.id}/${t.slug}`) ? "opacity-60" : ""}`}
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[var(--surface-raised)] border border-line transition-colors group-hover:border-line-strong">
                    <MarcaGuardada visible={guardada("tmo", `${t.tipo}/${t.id}/${t.slug}`)} />
                    {t.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.cover_url}
                        alt={t.title}
                        className="h-full w-full object-cover transition duration-500"
                        loading={idx < 4 ? "eager" : "lazy"}
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => retryThroughProxy(e.currentTarget)}
                      />
                    )}
                  </div>
                  <div className="px-1 pt-3">
                    <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
                      {t.title}
                    </h3>
                    <p className="mt-1 font-mono text-[13px] text-faint">
                      {t.tipo}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3 pt-8">
              <button
                disabled={tmoPage <= 1}
                onClick={() => {
                  setTmoPage(tmoPage - 1);
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
                className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">
                Página {tmoPage} de {tmoPaginas}
              </span>
              <button
                disabled={!tmoMas}
                onClick={() => {
                  setTmoPage(tmoPage + 1);
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
                className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </>
        )
      )}

      {fuente === "ikigai" && (
        iki === null ? (
          <p className="py-16 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
            Cargando catálogo de Ikigai...
          </p>
        ) : iki.length === 0 ? (
          <Surface className="p-12 text-center">
            <p className="text-lg font-bold text-ink">Sin resultados</p>
            <p className="mt-1 text-sm text-subtle">Probá con otro término.</p>
          </Surface>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {iki.map((s) => (
                <Link
                  key={s.slug}
                  href={`/externo/ikigai/${s.slug}`}
                  onClick={guardarScrollActual}
                  className={`group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${guardada("ikigai", s.slug) ? "opacity-60" : ""}`}
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[var(--surface-raised)] border border-line transition-colors group-hover:border-line-strong">
                    <MarcaGuardada visible={guardada("ikigai", s.slug)} />
                    {s.cover_url && (
                      <ImagenFuente
                        src={s.cover_url}
                        alt={s.title}
                        className="h-full w-full object-cover transition duration-500"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className="px-1 pt-3">
                    <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
                      {s.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3 pt-8">
              <button
                disabled={ikiPage <= 1}
                onClick={() => {
                  setIkiPage(ikiPage - 1);
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
                className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">
                Página {ikiPage}
              </span>
              <button
                disabled={!ikiMas}
                onClick={() => {
                  setIkiPage(ikiPage + 1);
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
                className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </>
        )
      )}

      {fuente === "ehentai" && (
        ehGalleries === null ? (
          <p className="py-16 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
            Cargando catálogo de E-Hentai...
          </p>
        ) : ehGalleries.length === 0 && !error ? (
          <Surface className="p-12 text-center">
            <p className="text-lg font-bold text-ink">Sin resultados</p>
            <p className="mt-1 text-sm text-subtle">Probá con otro término, categoría o etiqueta.</p>
          </Surface>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {ehGalleries.map((s, idx) => (
                <div key={`${s.gid}-${s.token}`} className="group block">
                  <Link
                    href={`/externo/ehentai/${s.gid}/${s.token}`}
                    prefetch={false}
                    onClick={guardarScrollActual}
                    className={`block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${guardada("ehentai", s.gid, "adult") ? "opacity-60" : ""}`}
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[var(--surface-raised)] border border-line transition-colors group-hover:border-line-strong">
                      <MarcaGuardada visible={guardada("ehentai", s.gid, "adult")} />
                      {s.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.thumb}
                          alt={s.title}
                          className="h-full w-full object-cover transition duration-500"
                          loading={idx < 4 ? "eager" : "lazy"}
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={(e) => retryThroughProxy(e.currentTarget)}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-4 text-center font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
                          Sin portada
                        </div>
                      )}
                      <span className="absolute left-2.5 top-2.5 rounded-md border border-danger bg-[color-mix(in_oklch,var(--bg)_82%,transparent)] px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.1em] text-danger">
                        +18
                      </span>
                      {s.filecount > 0 && (
                        <span className="absolute right-2 top-2 rounded-full bg-[color-mix(in_oklch,var(--bg)_86%,transparent)] px-2 py-0.5 font-mono text-[11px] font-bold tracking-[0.1em] text-accent-ink">
                          {s.filecount} págs.
                        </span>
                      )}
                    </div>
                    <div className="px-1 pt-3">
                      <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
                        {decodificarHtml(s.title)}
                      </h3>
                      <p className="mt-1 font-mono text-[12px] text-faint">
                        {[s.category, s.uploader].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </Link>

                  {s.tags && s.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1 px-1">
                      {s.tags.slice(0, 3).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setEhTag(t);
                            setEhPage(1);
                            window.scrollTo({ top: 0, behavior: "instant" });
                          }}
                          className="rounded-full border border-line bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] text-subtle transition hover:border-accent hover:text-accent-ink"
                          title={`Filtrar por ${t}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3 pt-8">
              <button
                disabled={ehPage <= 1}
                onClick={() => {
                  const ant = Math.max(1, ehPage - 1);
                  setEhNextCursor(ehCursors.current[ant] ?? null);
                  setEhPage(ant);
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
                className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">
                Página {ehPage}
              </span>
              <button
                disabled={!ehHayMas}
                onClick={() => {
                  const sig = ehPage + 1;
                  setEhNextCursor(ehCursors.current[sig] ?? null);
                  setEhPage(sig);
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
                className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </>
        )
      )}

      {ehModalTags && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setEhModalTags(false)}
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-panel shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del modal */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-ink">Etiquetas de E-Hentai</h3>
                <p className="text-xs text-subtle">Filtrá por tag o escribí cualquier etiqueta específica</p>
              </div>
              <button
                onClick={() => setEhModalTags(false)}
                className="rounded-md p-1.5 text-subtle hover:bg-[var(--surface-raised)] hover:text-ink"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            {/* Barra de búsqueda de tags */}
            <div className="border-b border-line p-4 space-y-2">
              <input
                type="text"
                value={ehTagBusqueda}
                onChange={(e) => setEhTagBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  const limpio = ehTagBusqueda.trim().replace(/[,;]+\s*$/, "").trim();
                  if (e.key === "Enter" && limpio) {
                    e.preventDefault();
                    setEhTag(limpio);
                    setEhPage(1);
                    setEhModalTags(false);
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }
                }}
                placeholder="Etiqueta o varias separadas por coma (ej: female:maid, other:full color, mixed:group)..."
                className={`w-full ${fieldControlClass}`}
                autoFocus
              />
              {ehTagBusqueda.trim().replace(/[,;]+\s*$/, "").trim() && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-subtle">
                    Separalas con coma (tag, tag, tag) o pulsá Enter para buscar todas juntas:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const limpio = ehTagBusqueda.trim().replace(/[,;]+\s*$/, "").trim();
                      if (!limpio) return;
                      setEhTag(limpio);
                      setEhPage(1);
                      setEhModalTags(false);
                      window.scrollTo({ top: 0, behavior: "instant" });
                    }}
                    className="shrink-0 rounded-md bg-accent px-3 py-1 text-xs font-semibold text-[var(--on-accent)] transition-opacity hover:opacity-90"
                  >
                    Filtrar por &quot;{ehTagBusqueda.trim().replace(/[,;]+\s*$/, "").trim()}&quot;
                  </button>
                </div>
              )}
            </div>

            {/* Lista de tags con scroll */}
            <div className="overflow-y-auto p-5 space-y-4">
              {ehTag && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-[var(--surface-raised)] p-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink">
                    <span>Etiquetas activas:</span>
                    {ehTag.split(",").map((item) => {
                      const limpio = item.trim();
                      if (!limpio) return null;
                      return (
                        <span
                          key={limpio}
                          className="inline-flex items-center gap-1 rounded-md border border-accent bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-ink"
                        >
                          {limpio}
                          <button
                            type="button"
                            onClick={() => {
                              const restantes = ehTag
                                .split(",")
                                .map((x) => x.trim())
                                .filter((x) => x && x.toLowerCase() !== limpio.toLowerCase());
                              setEhTag(restantes.length > 0 ? restantes.join(", ") : null);
                              setEhPage(1);
                            }}
                            className="ml-0.5 text-danger hover:opacity-80"
                            title={`Quitar ${limpio}`}
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEhTag(null);
                      setEhTagBusqueda("");
                      setEhPage(1);
                      setEhModalTags(false);
                      window.scrollTo({ top: 0, behavior: "instant" });
                    }}
                    className="text-xs font-semibold text-danger hover:underline"
                  >
                    ✕ Quitar todas
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {buscarEtiquetasEhentai(ehTagBusqueda).map((t) => {
                  const activas = (ehTag ?? "")
                    .split(",")
                    .map((x) => x.trim().toLowerCase())
                    .filter(Boolean);
                  const estaActiva = activas.includes(t.tag.toLowerCase());
                  return (
                    <div
                      key={t.tag}
                      className={`inline-flex items-stretch overflow-hidden rounded-lg border text-xs transition-colors ${
                        estaActiva
                          ? "border-accent bg-[var(--accent-soft)] text-accent-ink font-semibold"
                          : "border-line bg-panel text-ink hover:border-line-strong hover:bg-[var(--surface-raised)]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (ehTagBusqueda.includes(",")) {
                            const previas = ehTagBusqueda
                              .split(",")
                              .slice(0, -1)
                              .map((x) => x.trim())
                              .filter(Boolean);
                            const nuevaLista = Array.from(new Set([...previas, t.tag])).join(", ");
                            setEhTag(nuevaLista);
                            setEhTagBusqueda(`${nuevaLista}, `);
                          } else {
                            setEhTag(t.tag);
                            setEhModalTags(false);
                          }
                          setEhPage(1);
                          window.scrollTo({ top: 0, behavior: "instant" });
                        }}
                        className="px-3 py-1.5 text-left"
                      >
                        <span className="block font-medium">{t.label}</span>
                        <span className="block font-mono text-[10px] text-faint">{t.tag}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const base = ehTagBusqueda.includes(",")
                            ? ehTagBusqueda
                                .split(",")
                                .slice(0, -1)
                                .map((x) => x.trim())
                                .filter(Boolean)
                            : (ehTag ?? "")
                                .split(",")
                                .map((x) => x.trim())
                                .filter(Boolean);
                          const existe = base.some((x) => x.toLowerCase() === t.tag.toLowerCase());
                          const nueva = existe
                            ? base.filter((x) => x.toLowerCase() !== t.tag.toLowerCase())
                            : [...base, t.tag];
                          const textoFinal = nueva.join(", ");
                          setEhTag(textoFinal || null);
                          setEhTagBusqueda(textoFinal ? `${textoFinal}, ` : "");
                          setEhPage(1);
                        }}
                        title={estaActiva ? `Quitar ${t.tag} de la combinación` : `Agregar ${t.tag} a la búsqueda múltiple`}
                        className="border-l border-line px-2 font-mono text-xs font-bold text-subtle hover:bg-[var(--accent-soft)] hover:text-accent-ink"
                      >
                        {estaActiva ? "✓" : "+"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pie del modal */}
            <div className="flex justify-end border-t border-line px-5 py-3">
              <button
                onClick={() => setEhModalTags(false)}
                className="rounded-md border border-line px-4 py-1.5 text-xs font-medium text-subtle hover:border-line-strong hover:text-ink"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {hitomiModalTags && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setHitomiModalTags(false)}
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-panel shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del modal */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-ink">Etiquetas de Hitomi.la</h3>
                <p className="text-xs text-subtle">
                  Elegí una etiqueta popular o escribí cualquier tag, serie, personaje o artista de Hitomi.la
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHitomiModalTags(false)}
                className="rounded-md p-1.5 text-subtle hover:bg-[var(--surface-raised)] hover:text-ink"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            {/* Barra de búsqueda de tags */}
            <div className="border-b border-line p-4 space-y-2">
              <input
                type="text"
                value={hitomiTagBusqueda}
                onChange={(e) => setHitomiTagBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  const limpio = hitomiTagBusqueda.trim().replace(/[,;]+\s*$/, "").trim();
                  if (e.key === "Enter" && limpio) {
                    e.preventDefault();
                    setHitomiTag(limpio);
                    setHitomiPage(1);
                    setHitomiModalTags(false);
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }
                }}
                placeholder="Etiqueta o varias separadas por coma (ej: female:maid, full color, series:blue archive)..."
                className={`w-full ${fieldControlClass}`}
                autoFocus
              />
              {hitomiTagBusqueda.trim().replace(/[,;]+\s*$/, "").trim() && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-subtle">
                    Separalas con coma (tag, tag, tag) o pulsá Enter para buscar todas juntas:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const limpio = hitomiTagBusqueda.trim().replace(/[,;]+\s*$/, "").trim();
                      if (!limpio) return;
                      setHitomiTag(limpio);
                      setHitomiPage(1);
                      setHitomiModalTags(false);
                      window.scrollTo({ top: 0, behavior: "instant" });
                    }}
                    className="shrink-0 rounded-md bg-accent px-3 py-1 text-xs font-semibold text-[var(--on-accent)] transition-opacity hover:opacity-90"
                  >
                    Filtrar por &quot;{hitomiTagBusqueda.trim().replace(/[,;]+\s*$/, "").trim()}&quot;
                  </button>
                </div>
              )}
            </div>

            {/* Lista de tags con scroll */}
            <div className="overflow-y-auto p-5 space-y-4">
              {hitomiTag && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-[var(--surface-raised)] p-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink">
                    <span>Etiquetas activas:</span>
                    {hitomiTag.split(",").map((item) => {
                      const limpio = item.trim();
                      if (!limpio) return null;
                      return (
                        <span
                          key={limpio}
                          className="inline-flex items-center gap-1 rounded-md border border-accent bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-ink"
                        >
                          {limpio}
                          <button
                            type="button"
                            onClick={() => {
                              const restantes = hitomiTag
                                .split(",")
                                .map((x) => x.trim())
                                .filter((x) => x && x.toLowerCase() !== limpio.toLowerCase());
                              setHitomiTag(restantes.length > 0 ? restantes.join(", ") : null);
                              setHitomiPage(1);
                            }}
                            className="ml-0.5 text-danger hover:opacity-80"
                            title={`Quitar ${limpio}`}
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHitomiTag(null);
                      setHitomiTagBusqueda("");
                      setHitomiPage(1);
                      setHitomiModalTags(false);
                      window.scrollTo({ top: 0, behavior: "instant" });
                    }}
                    className="text-xs font-semibold text-danger hover:underline"
                  >
                    ✕ Quitar todas
                  </button>
                </div>
              )}

              {hitomiTagsSugeridos.length > 0 && (
                <div className="space-y-2">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-ink">
                    Sugerencias en tiempo real de Hitomi.la
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {hitomiTagsSugeridos.map((t) => {
                      const activas = (hitomiTag ?? "")
                        .split(",")
                        .map((x) => x.trim().toLowerCase())
                        .filter(Boolean);
                      const estaActiva = activas.includes(t.tag.toLowerCase());
                      return (
                        <div
                          key={`sug-${t.tag}`}
                          className={`inline-flex items-stretch overflow-hidden rounded-lg border text-xs transition-colors ${
                            estaActiva
                              ? "border-accent bg-[var(--accent-soft)] text-accent-ink font-semibold"
                              : "border-line bg-panel text-ink hover:border-line-strong hover:bg-[var(--surface-raised)]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (hitomiTagBusqueda.includes(",")) {
                                const previas = hitomiTagBusqueda
                                  .split(",")
                                  .slice(0, -1)
                                  .map((x) => x.trim())
                                  .filter(Boolean);
                                const nuevaLista = Array.from(new Set([...previas, t.tag])).join(", ");
                                setHitomiTag(nuevaLista);
                                setHitomiTagBusqueda(`${nuevaLista}, `);
                              } else {
                                setHitomiTag(t.tag);
                                setHitomiModalTags(false);
                              }
                              setHitomiPage(1);
                              window.scrollTo({ top: 0, behavior: "instant" });
                            }}
                            className="px-3 py-1.5 text-left"
                          >
                            <span className="block font-medium">{t.label}</span>
                            <span className="block font-mono text-[10px] text-faint">{t.tag}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const base = hitomiTagBusqueda.includes(",")
                                ? hitomiTagBusqueda
                                    .split(",")
                                    .slice(0, -1)
                                    .map((x) => x.trim())
                                    .filter(Boolean)
                                : (hitomiTag ?? "")
                                    .split(",")
                                    .map((x) => x.trim())
                                    .filter(Boolean);
                              const existe = base.some((x) => x.toLowerCase() === t.tag.toLowerCase());
                              const nueva = existe
                                ? base.filter((x) => x.toLowerCase() !== t.tag.toLowerCase())
                                : [...base, t.tag];
                              const textoFinal = nueva.join(", ");
                              setHitomiTag(textoFinal || null);
                              setHitomiTagBusqueda(textoFinal ? `${textoFinal}, ` : "");
                              setHitomiPage(1);
                            }}
                            title={estaActiva ? `Quitar ${t.tag}` : `Agregar ${t.tag} a la búsqueda múltiple`}
                            className="border-l border-line px-2 font-mono text-xs font-bold text-subtle hover:bg-[var(--accent-soft)] hover:text-accent-ink"
                          >
                            {estaActiva ? "✓" : "+"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {hitomiTagsSugeridos.length > 0 && (
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                    Etiquetas populares
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {buscarEtiquetasHitomi(hitomiTagBusqueda).map((t) => {
                    const activas = (hitomiTag ?? "")
                      .split(",")
                      .map((x) => x.trim().toLowerCase())
                      .filter(Boolean);
                    const estaActiva = activas.includes(t.tag.toLowerCase());
                    return (
                      <div
                        key={t.tag}
                        className={`inline-flex items-stretch overflow-hidden rounded-lg border text-xs transition-colors ${
                          estaActiva
                            ? "border-accent bg-[var(--accent-soft)] text-accent-ink font-semibold"
                            : "border-line bg-panel text-ink hover:border-line-strong hover:bg-[var(--surface-raised)]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (hitomiTagBusqueda.includes(",")) {
                              const previas = hitomiTagBusqueda
                                .split(",")
                                .slice(0, -1)
                                .map((x) => x.trim())
                                .filter(Boolean);
                              const nuevaLista = Array.from(new Set([...previas, t.tag])).join(", ");
                              setHitomiTag(nuevaLista);
                              setHitomiTagBusqueda(`${nuevaLista}, `);
                            } else {
                              setHitomiTag(t.tag);
                              setHitomiModalTags(false);
                            }
                            setHitomiPage(1);
                            window.scrollTo({ top: 0, behavior: "instant" });
                          }}
                          className="px-3 py-1.5 text-left"
                        >
                          <span className="block font-medium">{t.label}</span>
                          <span className="block font-mono text-[10px] text-faint">{t.tag}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const base = hitomiTagBusqueda.includes(",")
                              ? hitomiTagBusqueda
                                  .split(",")
                                  .slice(0, -1)
                                  .map((x) => x.trim())
                                  .filter(Boolean)
                              : (hitomiTag ?? "")
                                  .split(",")
                                  .map((x) => x.trim())
                                  .filter(Boolean);
                            const existe = base.some((x) => x.toLowerCase() === t.tag.toLowerCase());
                            const nueva = existe
                              ? base.filter((x) => x.toLowerCase() !== t.tag.toLowerCase())
                              : [...base, t.tag];
                            const textoFinal = nueva.join(", ");
                            setHitomiTag(textoFinal || null);
                            setHitomiTagBusqueda(textoFinal ? `${textoFinal}, ` : "");
                            setHitomiPage(1);
                          }}
                          title={estaActiva ? `Quitar ${t.tag}` : `Agregar ${t.tag} a la búsqueda múltiple`}
                          className="border-l border-line px-2 font-mono text-xs font-bold text-subtle hover:bg-[var(--accent-soft)] hover:text-accent-ink"
                        >
                          {estaActiva ? "✓" : "+"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Pie del modal */}
            <div className="flex justify-end border-t border-line px-5 py-3">
              <button
                type="button"
                onClick={() => setHitomiModalTags(false)}
                className="rounded-md border border-line px-4 py-1.5 text-xs font-medium text-subtle hover:border-line-strong hover:text-ink"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {fuente === "hitomi" && (
        hitomiSeries === null ? (
          <p className="py-16 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
            Cargando catálogo de Hitomi.la...
          </p>
        ) : hitomiSeries.length === 0 && !error ? (
          <Surface className="p-12 text-center">
            <p className="text-lg font-bold text-ink">Sin resultados</p>
            <p className="mt-1 text-sm text-subtle">Probá con otro término, tipo o etiqueta.</p>
          </Surface>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {hitomiSeries.map((s, idx) => {
                const thumbUrl =
                  s.thumb && !s.thumb.startsWith("/api/externo/imagen") && s.thumb.startsWith("http")
                    ? `/api/externo/imagen?u=${encodeURIComponent(s.thumb)}`
                    : s.thumb;
                return (
                <div key={s.id} className="group block">
                  <Link
                    href={`/externo/hitomi/${s.id}`}
                    prefetch={false}
                    onClick={guardarScrollActual}
                    className={`block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${guardada("hitomi", s.id, "adult") ? "opacity-60" : ""}`}
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[var(--surface-raised)] border border-line transition-colors group-hover:border-line-strong">
                      <MarcaGuardada visible={guardada("hitomi", s.id, "adult")} />
                      {thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbUrl}
                          alt={s.title}
                          className="h-full w-full object-cover transition duration-500"
                          loading={idx < 4 ? "eager" : "lazy"}
                          decoding="async"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-4 text-center font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
                          Sin portada
                        </div>
                      )}
                      <span className="absolute left-2.5 top-2.5 rounded-md border border-danger bg-[color-mix(in_oklch,var(--bg)_82%,transparent)] px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.1em] text-danger">
                        +18
                      </span>
                      {s.filecount > 0 && (
                        <span className="absolute right-2 top-2 rounded-full bg-[color-mix(in_oklch,var(--bg)_86%,transparent)] px-2 py-0.5 font-mono text-[11px] font-bold tracking-[0.1em] text-accent-ink">
                          {s.filecount} págs.
                        </span>
                      )}
                    </div>
                    <div className="px-1 pt-3">
                      <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
                        {decodificarHtml(s.title)}
                      </h3>
                      <p className="mt-1 font-mono text-[12px] text-faint">
                        {[s.type, s.language, s.artists?.[0]].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </Link>

                  {s.tags && s.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1 px-1">
                      {s.tags.slice(0, 3).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setHitomiTag(t);
                            setHitomiPage(1);
                            window.scrollTo({ top: 0, behavior: "instant" });
                          }}
                          className="rounded-full border border-line bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] text-subtle transition hover:border-accent hover:text-accent-ink"
                          title={`Filtrar por ${t}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-3 pt-8">
              <button
                disabled={hitomiPage <= 1}
                onClick={() => {
                  setHitomiPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
                className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">
                Página {hitomiPage} {hitomiTotalPaginas > 1 ? `de ${hitomiTotalPaginas}` : ""}
              </span>
              <button
                disabled={!hitomiHayMas || (hitomiTotalPaginas > 0 && hitomiPage >= hitomiTotalPaginas)}
                onClick={() => {
                  setHitomiPage((p) => p + 1);
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
                className="rounded-md border border-line px-4 py-2 text-sm font-medium text-subtle transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </>
        )
      )}

      <p className="border-t border-line pt-6 text-center font-mono text-[11px] tracking-[0.06em] text-subtle">
        {fuente === "ehentai"
          ? "Catálogo y galerías provistos por E-Hentai"
          : fuente === "hitomi"
            ? "Catálogo y galerías provistos por Hitomi.la"
            : "Catálogo y capítulos provistos por MangaDex y sus grupos de scanlation"}
      </p>
    </div>
  );
}
