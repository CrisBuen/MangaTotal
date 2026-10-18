"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaRail } from "@/components/discover/MediaRail";
import { Chip } from "@/components/ui/Chip";
import { ImagenFuente } from "@/components/fuentes/ImagenFuente";
import { buscarReferenciaBiblioteca, type ReferenciaBiblioteca } from "@/lib/identidadBiblioteca";
import { LC_HABILITADA, LC_LISTAS, catalogoLc } from "@/lib/leercapitulo";
import { TMO_TIPOS, catalogoTmo, popularesTmo } from "@/lib/zonatmo";
import { catalogoCw, imagenCw } from "@/lib/catharsis";
import {
  IKIGAI_GENEROS,
  IKIGAI_TIPOS,
  catalogoIkigai,
  ikigaiDisponible,
} from "@/lib/ikigai";
import { isPlayStoreApp } from "@/lib/appVersion";
import { EHENTAI_CATEGORIAS, EHENTAI_IDIOMAS, type SerieEhentai } from "@/lib/ehentai";
import { HITOMI_POPULAR_TAGS, HITOMI_TIPOS } from "@/lib/hitomiTipos";

function decodificarHtml(texto: string): string {
  return texto
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

type Genre = { id: string; name: string };
type CardItem = {
  id: string;
  title: string;
  cover_url: string | null;
  href: string;
  meta?: string;
  tipo?: string | null;
};

const LABELS: Record<string, string> = {
  Action: "Acción", Adventure: "Aventura", Romance: "Romance", Fantasy: "Fantasía",
  Comedy: "Comedia", Drama: "Drama", Mystery: "Misterio", "Slice of Life": "Vida cotidiana",
  Horror: "Terror", "Sci-Fi": "Ciencia ficción", Sports: "Deportes", Thriller: "Suspenso",
};

const SOURCE_DETAILS: Record<string, { name: string; desc: string; searchPlaceholder: string }> = {
  mangadex: { name: "MangaDex", desc: "Manga en español y otros idiomas", searchPlaceholder: "Buscá tu próxima lectura en MangaDex…" },
  olympus: { name: "Olympus", desc: "Manga, manhwa y manhua", searchPlaceholder: "Buscá series en Olympus…" },
  tmo: { name: "ZonaTMO", desc: "Catálogo y grupos de traducción", searchPlaceholder: "Buscá series en ZonaTMO…" },
  leercapitulo: { name: "LeerCapítulo", desc: "Novedades de lectura", searchPlaceholder: "Buscá en LeerCapítulo…" },
  catharsis: { name: "Catharsis", desc: "Historias de su catálogo", searchPlaceholder: "Buscá en Catharsis…" },
  ikigai: { name: "Ikigai Mangas", desc: "Lectura desde Windows y Android", searchPlaceholder: "Buscá en Ikigai…" },
  ehentai: { name: "E-Hentai", desc: "Galerías y doujinshis +18", searchPlaceholder: "Buscá en E-Hentai (título, artista, cosplay…)" },
  hitomi: { name: "Hitomi.la", desc: "Galerías y doujinshis +18", searchPlaceholder: "Buscá en Hitomi.la (título, artista, tag…)" },
};

const OLYMPUS_TOP_GENEROS = [
  { id: 1, name: "Acción" },
  { id: 42, name: "Isekai" },
  { id: 21, name: "Murim" },
  { id: 30, name: "Sistema" },
  { id: 14, name: "Fantasía" },
  { id: 5, name: "Aventura" },
  { id: 25, name: "Reencarnación" },
  { id: 4, name: "Artes marciales" },
  { id: 9, name: "Cultivación" },
  { id: 33, name: "Superpoderes" },
  { id: 48, name: "Venganza" },
  { id: 68, name: "Antihéroe" },
  { id: 26, name: "Romance" },
  { id: 7, name: "Comedia" },
];

const OLYMPUS_ORDENES = [
  { id: "novedades", name: "Nuevos lanzamientos" },
  { id: "populares", name: "Populares" },
  { id: "vistas", name: "Más vistas" },
  { id: "capitulos", name: "Más capítulos" },
  { id: "az", name: "A–Z" },
];

const TMO_TOP_GENEROS = [
  { id: "1", name: "Acción" },
  { id: "2", name: "Aventura" },
  { id: "3", name: "Comedia" },
  { id: "4", name: "Drama" },
  { id: "6", name: "Fantasía" },
  { id: "8", name: "Romance" },
  { id: "9", name: "Sobrenatural" },
  { id: "18", name: "Isekai" },
  { id: "37", name: "Reencarnación" },
  { id: "20", name: "Magia" },
  { id: "23", name: "Misterio" },
  { id: "10", name: "Suspenso" },
];

const LC_TOP_GENEROS = [
  { id: "accion", name: "Acción" },
  { id: "aventura", name: "Aventura" },
  { id: "comedia", name: "Comedia" },
  { id: "drama", name: "Drama" },
  { id: "fantasia", name: "Fantasía" },
  { id: "isekai", name: "Isekai" },
  { id: "romance", name: "Romance" },
  { id: "shonen", name: "Shonen" },
  { id: "seinen", name: "Seinen" },
  { id: "sobrenatural", name: "Sobrenatural" },
];

const CW_ORDENES = [
  { id: "novedades", name: "Novedades" },
  { id: "capitulos", name: "Más capítulos" },
  { id: "nombre", name: "Catálogo A–Z" },
];


function UniversalRail({
  title,
  href,
  loader,
  fetchUrl,
  mapResponse,
  isSaved,
}: {
  title: string;
  href: string;
  loader?: (signal: AbortSignal) => Promise<CardItem[]>;
  fetchUrl?: string;
  mapResponse?: (data: any) => CardItem[];
  isSaved?: (item: CardItem) => boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<CardItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const mapRef = useRef(mapResponse);
  mapRef.current = mapResponse;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px" }
    );
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let active = true;
    setFailed(false);

    const ejecutar = async () => {
      try {
        let result: CardItem[] = [];
        if (loaderRef.current) {
          result = await loaderRef.current(controller.signal);
        } else if (fetchUrl) {
          const res = await fetch(fetchUrl, { signal: controller.signal });
          if (!res.ok) throw new Error("fetch falló");
          const data = await res.json();
          result = mapRef.current ? mapRef.current(data) : [];
        }
        if (active) {
          setItems(Array.isArray(result) ? result : []);
        }
      } catch {
        if (active) setFailed(true);
      } finally {
        clearTimeout(timer);
      }
    };

    void ejecutar();

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [visible, fetchUrl, attempt]);

  return (
    <div ref={root} className="od-lazy-rail">
      <MediaRail title={title} href={href}>
        {items?.map((item) => {
          const estaGuardada = Boolean(isSaved?.(item));
          return (
            <Link
              className={`od-media-card group relative ${estaGuardada ? "opacity-60" : ""}`}
              key={item.id}
              href={item.href}
              prefetch={false}
            >
              <span className="od-media-thumb relative">
                {estaGuardada && (
                  <span
                    className="absolute left-2 top-2 z-10 rounded-md border border-line bg-panel px-2 py-1 text-[11px] font-semibold text-ink shadow-sm"
                    aria-label="En biblioteca"
                  >
                    ▣ En biblioteca
                  </span>
                )}
                {item.cover_url ? (
                  <ImagenFuente
                    src={item.cover_url}
                    alt={item.title}
                    className="h-full w-full object-cover transition duration-300"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="od-no-cover">Sin portada</span>
                )}
                <span className="od-media-play" aria-hidden="true">
                  ↗
                </span>
              </span>
              <span className="od-media-title">{item.title}</span>
              {item.meta && <span className="od-media-meta">{item.meta}</span>}
            </Link>
          );
        })}
        {!items &&
          !failed &&
          Array.from({ length: 7 }, (_, i) => (
            <div className="od-card-skeleton" key={i} aria-hidden="true" />
          ))}
      </MediaRail>
      {failed && (
        <p className="od-message" role="status">
          No se pudo conectar con esta fuente temporalmente.{" "}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Reintentar {title}
          </button>
        </p>
      )}
    </div>
  );
}

export function ReadingDiscover() {
  const params = useSearchParams();
  const urlFuente = params.get("fuente");

  const [fuente, setFuente] = useState<string>("mangadex");
  const [genres, setGenres] = useState<Genre[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [guardadas, setGuardadas] = useState<ReferenciaBiblioteca[]>([]);
  const [ikigaiActivo, setIkigaiActivo] = useState(false);
  const [adultoHabilitado, setAdultoHabilitado] = useState(false);


  useEffect(() => {
    if (isPlayStoreApp()) return;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (me && Boolean(me.show_adult_content) && !me.play_store_app && !isPlayStoreApp()) {
          setAdultoHabilitado(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setIkigaiActivo(ikigaiDisponible());
  }, []);

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
    return () => {
      vigente = false;
      window.removeEventListener("focus", cargar);
      window.removeEventListener("pageshow", cargar);
    };
  }, []);

  const guardada = useCallback(
    (source: string, id: string, tipo?: string | null) =>
      Boolean(buscarReferenciaBiblioteca(guardadas, source, id, tipo)),
    [guardadas]
  );

  useEffect(() => {
    if (urlFuente && urlFuente !== fuente) {
      setFuente(urlFuente);
    } else {
      try {
        const stored = sessionStorage.getItem("mangatotal:fuente-lectura");
        if (stored && stored !== fuente) setFuente(stored);
      } catch {}
    }
  }, [urlFuente, fuente]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/externo/generos", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setGenres(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);



  const cambiarFuente = (nueva: string) => {
    if (nueva === fuente) return;
    if ((nueva === "ehentai" || nueva === "hitomi") && !adultoHabilitado) return;
    setFuente(nueva);
    try {
      sessionStorage.setItem("mangatotal:fuente-lectura", nueva);
    } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set("fuente", nueva);
    window.history.replaceState(window.history.state, "", url.toString());
  };

  const fuentesLista = [
    ["mangadex", "MangaDex", "Manga en español y otros idiomas"],
    ["olympus", "Olympus", "Manga, manhwa y manhua"],
    ["tmo", "ZonaTMO", "Catálogo y grupos de traducción"],
    ...(LC_HABILITADA ? [["leercapitulo", "LeerCapítulo", "Novedades de lectura"]] : []),
    ["catharsis", "Catharsis", "Historias de su catálogo"],
    ["ikigai", "Ikigai Mangas", "Lectura desde Windows y Android"],
  ];

  const fuenteInfo = SOURCE_DETAILS[fuente] || SOURCE_DETAILS.mangadex;

  return (
    <div className="od-reading-discover space-y-8">
      {/* Selector superior idéntico a la experiencia animada */}
      <div className="od-explore-switcher">
        <span className="od-eyebrow">Lectura · Descubrí tu próxima historia</span>
        <div className="od-source-switcher space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[11px] font-medium text-faint">
              Fuente
            </span>
            {fuentesLista.map(([id, name]) => (
              <Chip
                type="button"
                key={id}
                onClick={() => cambiarFuente(id)}
                selected={fuente === id}
              >
                {name}
              </Chip>
            ))}
          </div>

          {adultoHabilitado && (
            <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-line/40">
              <span className="mr-1 font-mono text-[11px] font-medium text-faint">
                Fuentes +18
              </span>
              <Chip
                type="button"
                onClick={() => cambiarFuente("ehentai")}
                selected={fuente === "ehentai"}
              >
                E-Hentai
              </Chip>
              <Chip
                type="button"
                onClick={() => cambiarFuente("hitomi")}
                selected={fuente === "hitomi"}
              >
                Hitomi.la
              </Chip>
            </div>
          )}
        </div>
      </div>

      {/* Buscador dinámico adaptado a la fuente seleccionada */}
      <form
        action="/explorar"
        className="od-discover-tools"
        role="search"
        aria-label={`Buscar en ${fuenteInfo.name}`}
      >
        <input type="hidden" name="fuente" value={fuente} />
        <input
          name="q"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          type="search"
          placeholder={fuenteInfo.searchPlaceholder}
          aria-label={`Buscar manga en ${fuenteInfo.name}`}
        />
        <button className="od-outline" type="submit">
          Buscar →
        </button>
      </form>


      {/* ============================================================== */}
      {/* 1. MANGADEX */}
      {/* ============================================================== */}
      {fuente === "mangadex" && (
        <>
          {genres.length > 0 && (
            <section className="od-genres" aria-labelledby="mangadex-genres">
              <h2 id="mangadex-genres">¿Qué te gustaría leer?</h2>
              <p>Géneros de MangaDex. Cada fuente conserva sus propios filtros en el catálogo.</p>
              <div className="od-genre-grid">
                {genres.map((g) => (
                  <Link
                    key={g.id}
                    href={`/explorar?fuente=mangadex&md_genre=${encodeURIComponent(g.id)}`}
                    prefetch={false}
                  >
                    {LABELS[g.name] || g.name}
                    <span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <UniversalRail
            title="Novedades en español · MangaDex"
            href="/explorar?fuente=mangadex&md_order=latest"
            fetchUrl="/api/externo/series?lang=es&order=latest"
            isSaved={(item) => guardada("mangadex", item.id)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: item.id,
                title: item.title,
                cover_url: item.cover_url,
                href: `/externo/${item.id}`,
                meta: item.chapter_count ? `${item.chapter_count} capítulos` : "Novedad",
              }))
            }
          />

          <UniversalRail
            title="Más populares · MangaDex"
            href="/explorar?fuente=mangadex&md_order=popular"
            fetchUrl="/api/externo/series?lang=es&order=popular"
            isSaved={(item) => guardada("mangadex", item.id)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: item.id,
                title: item.title,
                cover_url: item.cover_url,
                href: `/externo/${item.id}`,
                meta: item.chapter_count ? `${item.chapter_count} capítulos` : "Popular",
              }))
            }
          />

          <UniversalRail
            title="Mejor valoradas · MangaDex"
            href="/explorar?fuente=mangadex&md_order=rating"
            fetchUrl="/api/externo/series?lang=es&order=rating"
            isSaved={(item) => guardada("mangadex", item.id)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: item.id,
                title: item.title,
                cover_url: item.cover_url,
                href: `/externo/${item.id}`,
                meta: item.status || "Destacada",
              }))
            }
          />

          {genres
            .filter((g) => ["Action", "Fantasy", "Romance", "Comedy"].includes(g.name))
            .map((g) => {
              const name = LABELS[g.name] || g.name;
              return (
                <UniversalRail
                  key={g.id}
                  title={`${name} · MangaDex`}
                  href={`/explorar?fuente=mangadex&md_genre=${encodeURIComponent(g.id)}`}
                  fetchUrl={`/api/externo/series?lang=es&order=popular&tag=${encodeURIComponent(g.id)}`}
                  isSaved={(item) => guardada("mangadex", item.id)}
                  mapResponse={(data) =>
                    (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                      id: item.id,
                      title: item.title,
                      cover_url: item.cover_url,
                      href: `/externo/${item.id}`,
                      meta: item.chapter_count ? `${item.chapter_count} capítulos` : "Ver capítulos",
                    }))
                  }
                />
              );
            })}
        </>
      )}

      {/* ============================================================== */}
      {/* 2. OLYMPUS */}
      {/* ============================================================== */}
      {fuente === "olympus" && (
        <>
          <section className="od-genres" aria-labelledby="olympus-genres">
            <h2 id="olympus-genres">Categorías y tipos de Olympus</h2>
            <p>Elegí un orden o género de Olympus para filtrar en el catálogo.</p>
            <div className="od-genre-grid">
              {OLYMPUS_ORDENES.map((o) => (
                <Link
                  key={o.id}
                  href={`/explorar?fuente=olympus&oly_orden=${o.id}`}
                  prefetch={false}
                >
                  {o.name}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
              {OLYMPUS_TOP_GENEROS.map((g) => (
                <Link
                  key={g.id}
                  href={`/explorar?fuente=olympus&oly_genero=${g.id}`}
                  prefetch={false}
                >
                  {g.name}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </section>

          <UniversalRail
            title="Nuevos lanzamientos · Olympus"
            href="/explorar?fuente=olympus&oly_orden=novedades"
            fetchUrl="/api/externo/olympus/series?orden=novedades"
            isSaved={(item) => guardada("olympus", item.id, item.tipo)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: String(item.slug || item.id),
                title: item.title,
                cover_url: item.cover_url,
                href: `/externo/olympus/${item.slug}`,
                tipo: item.type,
                meta: item.ultimos?.length ? `Cap. ${item.ultimos[0].name}` : item.chapter_count !== null ? `${item.chapter_count} caps.` : "Lanzamiento",
              }))
            }
          />

          <UniversalRail
            title="Populares · Olympus"
            href="/explorar?fuente=olympus&oly_orden=populares"
            fetchUrl="/api/externo/olympus/series?orden=populares"
            isSaved={(item) => guardada("olympus", item.id, item.tipo)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: String(item.slug || item.id),
                title: item.title,
                cover_url: item.cover_url,
                href: `/externo/olympus/${item.slug}`,
                tipo: item.type,
                meta: item.status || item.type || "Popular",
              }))
            }
          />

          <UniversalRail
            title="Más vistas · Olympus"
            href="/explorar?fuente=olympus&oly_orden=vistas"
            fetchUrl="/api/externo/olympus/series?orden=vistas"
            isSaved={(item) => guardada("olympus", item.id, item.tipo)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: String(item.slug || item.id),
                title: item.title,
                cover_url: item.cover_url,
                href: `/externo/olympus/${item.slug}`,
                tipo: item.type,
                meta: item.chapter_count !== null ? `${item.chapter_count} caps.` : "Más leída",
              }))
            }
          />

          <UniversalRail
            title="Más capítulos · Olympus"
            href="/explorar?fuente=olympus&oly_orden=capitulos"
            fetchUrl="/api/externo/olympus/series?orden=capitulos"
            isSaved={(item) => guardada("olympus", item.id, item.tipo)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: String(item.slug || item.id),
                title: item.title,
                cover_url: item.cover_url,
                href: `/externo/olympus/${item.slug}`,
                tipo: item.type,
                meta: item.chapter_count !== null ? `${item.chapter_count} caps.` : item.type || "Manhwa",
              }))
            }
          />

          <UniversalRail
            title="Isekai y Sistema · Olympus"
            href="/explorar?fuente=olympus&oly_genero=42"
            fetchUrl="/api/externo/olympus/series?genero=42"
            isSaved={(item) => guardada("olympus", item.id, item.tipo)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: String(item.slug || item.id),
                title: item.title,
                cover_url: item.cover_url,
                href: `/externo/olympus/${item.slug}`,
                tipo: item.type,
                meta: item.chapter_count !== null ? `${item.chapter_count} caps.` : "Isekai",
              }))
            }
          />

          <UniversalRail
            title="Murim y Acción · Olympus"
            href="/explorar?fuente=olympus&oly_genero=21"
            fetchUrl="/api/externo/olympus/series?genero=21"
            isSaved={(item) => guardada("olympus", item.id, item.tipo)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: String(item.slug || item.id),
                title: item.title,
                cover_url: item.cover_url,
                href: `/externo/olympus/${item.slug}`,
                tipo: item.type,
                meta: item.chapter_count !== null ? `${item.chapter_count} caps.` : "Murim",
              }))
            }
          />
        </>
      )}

      {/* ============================================================== */}
      {/* 3. ZONATMO */}
      {/* ============================================================== */}
      {fuente === "tmo" && (
        <>
          <section className="od-genres" aria-labelledby="tmo-genres">
            <h2 id="tmo-genres">Colecciones y géneros de ZonaTMO</h2>
            <p>Filtrá por tipo de obra o categorías principales del catálogo de ZonaTMO.</p>
            <div className="od-genre-grid">
              {TMO_TIPOS.map((t) => (
                <Link
                  key={t.id}
                  href={`/explorar?fuente=tmo&tmo_tipo=${t.id}`}
                  prefetch={false}
                >
                  {t.name}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
              {TMO_TOP_GENEROS.map((g) => (
                <Link
                  key={g.id}
                  href={`/explorar?fuente=tmo&tmo_genero=${g.id}`}
                  prefetch={false}
                >
                  {g.name}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </section>

          <UniversalRail
            title="Populares de la semana · ZonaTMO"
            href="/explorar?fuente=tmo"
            isSaved={(item) => guardada("tmo", item.id, item.tipo)}
            loader={async () => {
              const res = await popularesTmo("week");
              return res.map((s) => ({
                id: s.id,
                title: s.title,
                cover_url: s.cover_url,
                href: `/externo/tmo/${s.tipo}/${s.id}/${s.slug}`,
                tipo: s.tipo,
                meta: "Popular de la semana",
              }));
            }}
          />

          <UniversalRail
            title="Novedades y recién agregados · ZonaTMO"
            href="/explorar?fuente=tmo"
            isSaved={(item) => guardada("tmo", item.id, item.tipo)}
            loader={async () => {
              const res = await catalogoTmo(1, { orden: "latest" });
              return res.series.map((s) => ({
                id: s.id,
                title: s.title,
                cover_url: s.cover_url,
                href: `/externo/tmo/${s.tipo}/${s.id}/${s.slug}`,
                tipo: s.tipo,
                meta: "Recién agregado",
              }));
            }}
          />

          <UniversalRail
            title="Top del mes · ZonaTMO"
            href="/explorar?fuente=tmo"
            isSaved={(item) => guardada("tmo", item.id, item.tipo)}
            loader={async () => {
              const res = await popularesTmo("month");
              return res.map((s) => ({
                id: s.id,
                title: s.title,
                cover_url: s.cover_url,
                href: `/externo/tmo/${s.tipo}/${s.id}/${s.slug}`,
                tipo: s.tipo,
                meta: "Top del mes",
              }));
            }}
          />

          <UniversalRail
            title="Manhwas y Webtoons · ZonaTMO"
            href="/explorar?fuente=tmo&tmo_tipo=87"
            isSaved={(item) => guardada("tmo", item.id, item.tipo)}
            loader={async () => {
              const res = await catalogoTmo(1, { tipo: "87" });
              return res.series.map((s) => ({
                id: s.id,
                title: s.title,
                cover_url: s.cover_url,
                href: `/externo/tmo/${s.tipo}/${s.id}/${s.slug}`,
                tipo: s.tipo,
                meta: "Manhwa",
              }));
            }}
          />

          <UniversalRail
            title="Mangas destacados · ZonaTMO"
            href="/explorar?fuente=tmo&tmo_tipo=14"
            isSaved={(item) => guardada("tmo", item.id, item.tipo)}
            loader={async () => {
              const res = await catalogoTmo(1, { tipo: "14" });
              return res.series.map((s) => ({
                id: s.id,
                title: s.title,
                cover_url: s.cover_url,
                href: `/externo/tmo/${s.tipo}/${s.id}/${s.slug}`,
                tipo: s.tipo,
                meta: "Manga",
              }));
            }}
          />
        </>
      )}

      {/* ============================================================== */}
      {/* 4. LEERCAPÍTULO */}
      {/* ============================================================== */}
      {fuente === "leercapitulo" && LC_HABILITADA && (
        <>
          <section className="od-genres" aria-labelledby="lc-genres">
            <h2 id="lc-genres">Colecciones y géneros de LeerCapítulo</h2>
            <p>Explorá por lista de lectura o géneros del catálogo de LeerCapítulo.</p>
            <div className="od-genre-grid">
              {LC_LISTAS.filter((l) => l.id).map((l) => (
                <Link
                  key={l.id}
                  href={`/explorar?fuente=leercapitulo&lc_lista=${encodeURIComponent(l.id)}`}
                  prefetch={false}
                >
                  {l.name}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
              {LC_TOP_GENEROS.map((g) => (
                <Link
                  key={g.id}
                  href={`/explorar?fuente=leercapitulo&lc_genero=${encodeURIComponent(g.id)}`}
                  prefetch={false}
                >
                  {g.name}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </section>

          <UniversalRail
            title="Últimas actualizaciones · LeerCapítulo"
            href="/explorar?fuente=leercapitulo"
            isSaved={(item) => guardada("leercapitulo", item.id)}
            loader={async () => {
              const res = await catalogoLc(1, {});
              return res.series.map((s) => ({
                id: s.id,
                title: s.title,
                cover_url: s.cover_url,
                href: `/externo/leercapitulo/${s.id}/${s.slug}`,
                meta: "Actualizado",
              }));
            }}
          />

          <UniversalRail
            title="Tendencias de lectura · LeerCapítulo"
            href="/explorar?fuente=leercapitulo&lc_lista=tendencias"
            isSaved={(item) => guardada("leercapitulo", item.id)}
            loader={async () => {
              const res = await catalogoLc(1, { lista: "tendencias" });
              return res.series.map((s) => ({
                id: s.id,
                title: s.title,
                cover_url: s.cover_url,
                href: `/externo/leercapitulo/${s.id}/${s.slug}`,
                meta: "Tendencia",
              }));
            }}
          />

          <UniversalRail
            title="Acción y Aventura · LeerCapítulo"
            href="/explorar?fuente=leercapitulo&lc_genero=accion"
            isSaved={(item) => guardada("leercapitulo", item.id)}
            loader={async () => {
              const res = await catalogoLc(1, { genero: "accion" });
              return res.series.map((s) => ({
                id: s.id,
                title: s.title,
                cover_url: s.cover_url,
                href: `/externo/leercapitulo/${s.id}/${s.slug}`,
                meta: "Acción",
              }));
            }}
          />

          <UniversalRail
            title="Romance y Drama · LeerCapítulo"
            href="/explorar?fuente=leercapitulo&lc_genero=romance"
            isSaved={(item) => guardada("leercapitulo", item.id)}
            loader={async () => {
              const res = await catalogoLc(1, { genero: "romance" });
              return res.series.map((s) => ({
                id: s.id,
                title: s.title,
                cover_url: s.cover_url,
                href: `/externo/leercapitulo/${s.id}/${s.slug}`,
                meta: "Romance",
              }));
            }}
          />

          <UniversalRail
            title="Fantasía e Isekai · LeerCapítulo"
            href="/explorar?fuente=leercapitulo&lc_genero=fantasia"
            isSaved={(item) => guardada("leercapitulo", item.id)}
            loader={async () => {
              const res = await catalogoLc(1, { genero: "fantasia" });
              return res.series.map((s) => ({
                id: s.id,
                title: s.title,
                cover_url: s.cover_url,
                href: `/externo/leercapitulo/${s.id}/${s.slug}`,
                meta: "Fantasía",
              }));
            }}
          />
        </>
      )}

      {/* ============================================================== */}
      {/* 5. CATHARSIS WORLD */}
      {/* ============================================================== */}
      {fuente === "catharsis" && (
        <>
          <section className="od-genres" aria-labelledby="cw-genres">
            <h2 id="cw-genres">Catálogo de Catharsis World</h2>
            <p>Historias completas, novelas y manhwas publicados por Catharsis World.</p>
            <div className="od-genre-grid">
              {CW_ORDENES.map((o) => (
                <Link
                  key={o.id}
                  href={`/explorar?fuente=catharsis&cw_orden=${o.id}`}
                  prefetch={false}
                >
                  {o.name}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </section>

          <UniversalRail
            title="Novedades de Catharsis World"
            href="/explorar?fuente=catharsis&cw_orden=novedades"
            isSaved={(item) => guardada("catharsis", item.id)}
            loader={async () => {
              const res = await catalogoCw({ orden: "novedades", pagina: 1 });
              return res.series.map((s) => ({
                id: s.id,
                title: s.nombre,
                cover_url: s.portada ? imagenCw(s.portada, 320) : null,
                href: `/externo/catharsis/${s.id}`,
                meta: s.capitulos ? `${s.capitulos} cap.` : "Novedad",
              }));
            }}
          />

          <UniversalRail
            title="Historias con más capítulos · Catharsis"
            href="/explorar?fuente=catharsis&cw_orden=capitulos"
            isSaved={(item) => guardada("catharsis", item.id)}
            loader={async () => {
              const res = await catalogoCw({ orden: "capitulos", pagina: 1 });
              return res.series.map((s) => ({
                id: s.id,
                title: s.nombre,
                cover_url: s.portada ? imagenCw(s.portada, 320) : null,
                href: `/externo/catharsis/${s.id}`,
                meta: s.capitulos ? `${s.capitulos} cap.` : "Historia",
              }));
            }}
          />

          <UniversalRail
            title="Catálogo completo A–Z · Catharsis"
            href="/explorar?fuente=catharsis&cw_orden=nombre"
            isSaved={(item) => guardada("catharsis", item.id)}
            loader={async () => {
              const res = await catalogoCw({ orden: "nombre", pagina: 1 });
              return res.series.map((s) => ({
                id: s.id,
                title: s.nombre,
                cover_url: s.portada ? imagenCw(s.portada, 320) : null,
                href: `/externo/catharsis/${s.id}`,
                meta: s.capitulos ? `${s.capitulos} cap.` : "Historia",
              }));
            }}
          />
        </>
      )}

      {/* ============================================================== */}
      {/* ============================================================== */}
      {/* 6. IKIGAI MANGAS */}
      {/* ============================================================== */}
      {fuente === "ikigai" && (
        <>
          <section className="od-genres" aria-labelledby="iki-genres">
            <h2 id="iki-genres">Formatos y categorías de Ikigai Mangas</h2>
            <p>Explorá por formato, orden o temáticas principales del catálogo de Ikigai.</p>
            <div className="od-genre-grid">
              <Link href="/explorar?fuente=ikigai&iki_orden=recientes" prefetch={false}>
                Recién agregadas <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/explorar?fuente=ikigai&iki_orden=populares" prefetch={false}>
                Populares <span aria-hidden="true">↗</span>
              </Link>
              {IKIGAI_TIPOS.map((t) => (
                <Link
                  key={t.id}
                  href={`/explorar?fuente=ikigai&iki_tipo=${t.id}`}
                  prefetch={false}
                >
                  {t.name}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
              {IKIGAI_GENEROS.filter((g) => !["906409527934582787", "906409351272792067"].includes(g.id)).map((g) => (
                <Link
                  key={g.id}
                  href={`/explorar?fuente=ikigai&iki_genero=${g.id}`}
                  prefetch={false}
                >
                  {g.name}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </section>

          {ikigaiActivo ? (
            <>
              <UniversalRail
                title="Recién agregadas · Ikigai"
                href="/explorar?fuente=ikigai&iki_orden=recientes"
                isSaved={(item) => guardada("ikigai", item.id, item.tipo)}
                loader={async () => {
                  const res = await catalogoIkigai(1, { orden: "recientes" });
                  return res.series.map((s) => ({
                    id: s.slug,
                    title: s.title,
                    cover_url: s.cover_url,
                    href: `/externo/ikigai/${s.slug}`,
                    tipo: s.tipo,
                    meta: s.tipo || "Recién agregada",
                  }));
                }}
              />

              <UniversalRail
                title="Más populares · Ikigai"
                href="/explorar?fuente=ikigai&iki_orden=populares"
                isSaved={(item) => guardada("ikigai", item.id, item.tipo)}
                loader={async () => {
                  const res = await catalogoIkigai(1, { orden: "populares" });
                  return res.series.map((s) => ({
                    id: s.slug,
                    title: s.title,
                    cover_url: s.cover_url,
                    href: `/externo/ikigai/${s.slug}`,
                    tipo: s.tipo,
                    meta: s.tipo || "Popular",
                  }));
                }}
              />

              <UniversalRail
                title="Cómics y Manhwas · Ikigai"
                href="/explorar?fuente=ikigai&iki_tipo=comic"
                isSaved={(item) => guardada("ikigai", item.id, item.tipo)}
                loader={async () => {
                  const res = await catalogoIkigai(1, { tipo: "comic" });
                  return res.series.map((s) => ({
                    id: s.slug,
                    title: s.title,
                    cover_url: s.cover_url,
                    href: `/externo/ikigai/${s.slug}`,
                    tipo: s.tipo,
                    meta: "Cómic",
                  }));
                }}
              />

              <UniversalRail
                title="Mangas · Ikigai"
                href="/explorar?fuente=ikigai&iki_tipo=manga"
                isSaved={(item) => guardada("ikigai", item.id, item.tipo)}
                loader={async () => {
                  const res = await catalogoIkigai(1, { tipo: "manga" });
                  return res.series.map((s) => ({
                    id: s.slug,
                    title: s.title,
                    cover_url: s.cover_url,
                    href: `/externo/ikigai/${s.slug}`,
                    tipo: s.tipo,
                    meta: "Manga",
                  }));
                }}
              />

              <UniversalRail
                title="Acción y Aventura · Ikigai"
                href="/explorar?fuente=ikigai&iki_genero=906397904327999491"
                isSaved={(item) => guardada("ikigai", item.id, item.tipo)}
                loader={async () => {
                  const res = await catalogoIkigai(1, { genero: "906397904327999491" });
                  return res.series.map((s) => ({
                    id: s.slug,
                    title: s.title,
                    cover_url: s.cover_url,
                    href: `/externo/ikigai/${s.slug}`,
                    tipo: s.tipo,
                    meta: "Acción",
                  }));
                }}
              />

              <UniversalRail
                title="Fantasía · Ikigai"
                href="/explorar?fuente=ikigai&iki_genero=906397894348570627"
                isSaved={(item) => guardada("ikigai", item.id, item.tipo)}
                loader={async () => {
                  const res = await catalogoIkigai(1, { genero: "906397894348570627" });
                  return res.series.map((s) => ({
                    id: s.slug,
                    title: s.title,
                    cover_url: s.cover_url,
                    href: `/externo/ikigai/${s.slug}`,
                    tipo: s.tipo,
                    meta: "Fantasía",
                  }));
                }}
              />

              <UniversalRail
                title="Romance y Drama · Ikigai"
                href="/explorar?fuente=ikigai&iki_genero=906397894527549443"
                isSaved={(item) => guardada("ikigai", item.id, item.tipo)}
                loader={async () => {
                  const res = await catalogoIkigai(1, { genero: "906397894527549443" });
                  return res.series.map((s) => ({
                    id: s.slug,
                    title: s.title,
                    cover_url: s.cover_url,
                    href: `/externo/ikigai/${s.slug}`,
                    tipo: s.tipo,
                    meta: "Romance",
                  }));
                }}
              />
            </>
          ) : (
            <div className="od-message">
              <h3 className="font-bold text-ink">Ikigai Mangas</h3>
              <p className="mt-1 text-sm text-subtle">
                Para proteger su servidor de centros de datos, Ikigai funciona mediante el puente nativo en las aplicaciones de Windows y Android.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/explorar?fuente=ikigai" className="od-primary">
                  Abrir catálogo completo de Ikigai →
                </Link>
                <Link href="/explorar?fuente=ikigai&iki_tipo=comic" className="od-outline">
                  Ver Cómics y Manhwas de Ikigai →
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================== */}
      {/* 7. E-HENTAI (+18) */}
      {/* ============================================================== */}
      {fuente === "ehentai" && adultoHabilitado && (
        <>
          <section className="od-genres" aria-labelledby="eh-genres">
            <h2 id="eh-genres">Categorías y colecciones de E-Hentai</h2>
            <p>Elegí una categoría para explorar galerías +18 en el catálogo.</p>
            <div className="od-genre-grid">
              {EHENTAI_CATEGORIAS.map((c) => (
                <Link
                  key={c.id}
                  href={`/explorar?fuente=ehentai&eh_cat=${c.id}`}
                  prefetch={false}
                >
                  {c.label}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </section>

          <UniversalRail
            title="Populares en español · E-Hentai"
            href="/explorar?fuente=ehentai&eh_lang=spanish"
            fetchUrl="/api/externo/ehentai?cat=todos&lang=spanish"
            isSaved={(item) => guardada("ehentai", item.id)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: `${item.gid}/${item.token}`,
                title: decodificarHtml(item.title),
                cover_url: item.thumb,
                href: `/externo/ehentai/${item.gid}/${item.token}`,
                meta: `${item.category} · ${item.filecount} págs.`,
              }))
            }
          />

          <UniversalRail
            title="Doujinshis destacados · E-Hentai"
            href="/explorar?fuente=ehentai&eh_cat=doujinshi&eh_lang=spanish"
            fetchUrl="/api/externo/ehentai?cat=doujinshi&lang=spanish"
            isSaved={(item) => guardada("ehentai", item.id)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: `${item.gid}/${item.token}`,
                title: decodificarHtml(item.title),
                cover_url: item.thumb,
                href: `/externo/ehentai/${item.gid}/${item.token}`,
                meta: `${item.filecount} págs.`,
              }))
            }
          />

          <UniversalRail
            title="Manga en español · E-Hentai"
            href="/explorar?fuente=ehentai&eh_cat=manga&eh_lang=spanish"
            fetchUrl="/api/externo/ehentai?cat=manga&lang=spanish"
            isSaved={(item) => guardada("ehentai", item.id)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: `${item.gid}/${item.token}`,
                title: decodificarHtml(item.title),
                cover_url: item.thumb,
                href: `/externo/ehentai/${item.gid}/${item.token}`,
                meta: `${item.filecount} págs.`,
              }))
            }
          />

          <UniversalRail
            title="Artist CG e Ilustraciones · E-Hentai"
            href="/explorar?fuente=ehentai&eh_cat=artistcg"
            fetchUrl="/api/externo/ehentai?cat=artistcg&lang=todos"
            isSaved={(item) => guardada("ehentai", item.id)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: `${item.gid}/${item.token}`,
                title: decodificarHtml(item.title),
                cover_url: item.thumb,
                href: `/externo/ehentai/${item.gid}/${item.token}`,
                meta: `${item.filecount} págs.`,
              }))
            }
          />

          <UniversalRail
            title="Cosplay · E-Hentai"
            href="/explorar?fuente=ehentai&eh_cat=cosplay"
            fetchUrl="/api/externo/ehentai?cat=cosplay&lang=todos"
            isSaved={(item) => guardada("ehentai", item.id)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: `${item.gid}/${item.token}`,
                title: decodificarHtml(item.title),
                cover_url: item.thumb,
                href: `/externo/ehentai/${item.gid}/${item.token}`,
                meta: `${item.filecount} págs.`,
              }))
            }
          />
        </>
      )}

      {/* ============================================================== */}
      {/* SECCIÓN HITOMI.LA (SOLO SI CONTENIDO ADULTO ESTÁ HABILITADO)   */}
      {/* ============================================================== */}
      {fuente === "hitomi" && adultoHabilitado && (
        <>
          <section className="od-genres" aria-labelledby="hitomi-genres">
            <h2 id="hitomi-genres">Categorías y etiquetas de Hitomi.la</h2>
            <p>Elegí un tipo de publicación o una etiqueta popular para explorar en el catálogo +18.</p>
            <div className="od-genre-grid">
              {HITOMI_TIPOS.filter((t) => t.id !== "todos").map((t) => (
                <Link
                  key={t.id}
                  href={`/explorar?fuente=hitomi&hitomi_tipo=${t.id}`}
                  prefetch={false}
                >
                  {t.label}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
              {HITOMI_POPULAR_TAGS.slice(0, 18).map((tagItem) => (
                <Link
                  key={tagItem.tag}
                  href={`/explorar?fuente=hitomi&hitomi_tag=${encodeURIComponent(tagItem.tag)}`}
                  prefetch={false}
                >
                  🏷️ {tagItem.label}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </section>

          <UniversalRail
            title="Populares en español · Hitomi.la"
            href="/explorar?fuente=hitomi&hitomi_lang=spanish"
            fetchUrl="/api/externo/hitomi?tipo=todos&lang=spanish&v=2"
            isSaved={(item) => guardada("hitomi", item.id)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: item.id,
                title: decodificarHtml(item.title),
                cover_url:
                  item.thumb && !item.thumb.startsWith("/api/externo/imagen") && item.thumb.startsWith("http")
                    ? `/api/externo/imagen?u=${encodeURIComponent(item.thumb)}`
                    : item.thumb,
                href: `/externo/hitomi/${item.id}`,
                meta: `${item.type || "doujinshi"} · ${item.filecount} págs.`,
              }))
            }
          />

          <UniversalRail
            title="Doujinshis en español · Hitomi.la"
            href="/explorar?fuente=hitomi&hitomi_tipo=doujinshi&hitomi_lang=spanish"
            fetchUrl="/api/externo/hitomi?tipo=doujinshi&lang=spanish&v=2"
            isSaved={(item) => guardada("hitomi", item.id)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: item.id,
                title: decodificarHtml(item.title),
                cover_url:
                  item.thumb && !item.thumb.startsWith("/api/externo/imagen") && item.thumb.startsWith("http")
                    ? `/api/externo/imagen?u=${encodeURIComponent(item.thumb)}`
                    : item.thumb,
                href: `/externo/hitomi/${item.id}`,
                meta: `${item.filecount} págs.`,
              }))
            }
          />

          <UniversalRail
            title="Manga en español · Hitomi.la"
            href="/explorar?fuente=hitomi&hitomi_tipo=manga&hitomi_lang=spanish"
            fetchUrl="/api/externo/hitomi?tipo=manga&lang=spanish&v=2"
            isSaved={(item) => guardada("hitomi", item.id)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: item.id,
                title: decodificarHtml(item.title),
                cover_url:
                  item.thumb && !item.thumb.startsWith("/api/externo/imagen") && item.thumb.startsWith("http")
                    ? `/api/externo/imagen?u=${encodeURIComponent(item.thumb)}`
                    : item.thumb,
                href: `/externo/hitomi/${item.id}`,
                meta: `${item.filecount} págs.`,
              }))
            }
          />

          <UniversalRail
            title="Artist CG e Ilustraciones · Hitomi.la"
            href="/explorar?fuente=hitomi&hitomi_tipo=artistcg"
            fetchUrl="/api/externo/hitomi?tipo=artistcg&lang=todos&v=2"
            isSaved={(item) => guardada("hitomi", item.id)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: item.id,
                title: decodificarHtml(item.title),
                cover_url:
                  item.thumb && !item.thumb.startsWith("/api/externo/imagen") && item.thumb.startsWith("http")
                    ? `/api/externo/imagen?u=${encodeURIComponent(item.thumb)}`
                    : item.thumb,
                href: `/externo/hitomi/${item.id}`,
                meta: `${item.filecount} págs.`,
              }))
            }
          />

          <UniversalRail
            title="Últimos lanzamientos globales · Hitomi.la"
            href="/explorar?fuente=hitomi&hitomi_lang=todos"
            fetchUrl="/api/externo/hitomi?tipo=todos&lang=todos&v=2"
            isSaved={(item) => guardada("hitomi", item.id)}
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: item.id,
                title: decodificarHtml(item.title),
                cover_url:
                  item.thumb && !item.thumb.startsWith("/api/externo/imagen") && item.thumb.startsWith("http")
                    ? `/api/externo/imagen?u=${encodeURIComponent(item.thumb)}`
                    : item.thumb,
                href: `/externo/hitomi/${item.id}`,
                meta: `${item.language || "all"} · ${item.filecount} págs.`,
              }))
            }
          />
        </>
      )}

      {/* Botón de llamada a la acción para la fuente actual */}
      <div className="od-catalog-cta">
        <h2>Hay mucho más por descubrir en {fuenteInfo.name}</h2>
        <p>Todos los títulos, filtros por categorías y capítulos disponibles en {fuenteInfo.name}.</p>
        <Link href={`/explorar?fuente=${fuente}`} className="od-primary">
          Ver todos los títulos de {fuenteInfo.name} →
        </Link>
      </div>

      <p className="od-source-credit">
        Catálogos de las fuentes integradas, con su permiso. Cada ficha conserva el enlace a la fuente original.
      </p>
    </div>
  );
}
