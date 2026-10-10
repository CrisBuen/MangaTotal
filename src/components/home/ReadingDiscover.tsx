"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MediaRail } from "@/components/discover/MediaRail";
import { Chip } from "@/components/ui/Chip";
import { LC_HABILITADA } from "@/lib/leercapitulo";

type Genre = { id: string; name: string };
type CardItem = {
  id: string;
  title: string;
  cover_url: string | null;
  href: string;
  meta?: string;
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
};

function UniversalRail({
  title,
  href,
  fetchUrl,
  mapResponse,
}: {
  title: string;
  href: string;
  fetchUrl: string;
  mapResponse: (data: any) => CardItem[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<CardItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" }
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

    fetch(fetchUrl, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (active) {
          const mapped = mapResponse(data);
          setItems(Array.isArray(mapped) ? mapped : []);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => clearTimeout(timer));

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [visible, fetchUrl, attempt, mapResponse]);

  return (
    <div ref={root} className="od-lazy-rail">
      <MediaRail title={title} href={href}>
        {items?.map((item) => (
          <Link className="od-media-card" key={item.id} href={item.href} prefetch={false}>
            <span className="od-media-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {item.cover_url ? (
                <img src={item.cover_url} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="od-no-cover">Sin portada</span>
              )}
              <span className="od-media-play" aria-hidden="true">↗</span>
            </span>
            <span className="od-media-title">{item.title}</span>
            {item.meta && <span className="od-media-meta">{item.meta}</span>}
          </Link>
        ))}
        {!items && !failed && Array.from({ length: 7 }, (_, i) => (
          <div className="od-card-skeleton" key={i} aria-hidden="true" />
        ))}
      </MediaRail>
      {failed && (
        <p className="od-message" role="status">
          No se pudo conectar con esta fuente temporalmente.{" "}
          <button onClick={() => setAttempt((n) => n + 1)}>Reintentar {title}</button>
        </p>
      )}
      {items?.length === 0 && (
        <p className="od-message">No se encontraron títulos disponibles en este momento.</p>
      )}
    </div>
  );
}

/** Descubrimiento dinámico de lectura con conmutación sincronizada de fuentes */
export function ReadingDiscover() {
  const searchParams = useSearchParams();
  const urlFuente = searchParams.get("fuente");
  const [fuente, setFuente] = useState(() => {
    if (urlFuente && SOURCE_DETAILS[urlFuente]) return urlFuente;
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("mangatotal:fuente-lectura");
        if (stored && SOURCE_DETAILS[stored]) return stored;
      } catch {}
    }
    return "mangadex";
  });
  const [genres, setGenres] = useState<Genre[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (urlFuente && SOURCE_DETAILS[urlFuente] && urlFuente !== fuente) {
      setFuente(urlFuente);
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
        <div className="od-source-switcher">
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

      {/* Tarjetas interactivas de fuentes: cambiar fuente sin salir de Descubrir */}
      <section aria-labelledby="reading-sources-title">
        <p className="od-eyebrow">Tus fuentes de siempre</p>
        <h2 id="reading-sources-title">Elegí dónde descubrir</h2>
        <div className="od-reading-sources">
          {fuentesLista.map(([id, name, description]) => {
            const isActive = fuente === id;
            return (
              <button
                type="button"
                key={id}
                onClick={() => cambiarFuente(id)}
                className={`od-reading-source-card ${isActive ? "active" : ""}`}
                aria-pressed={isActive}
              >
                <span className="text-lg font-bold text-ink">{name}</span>
                <small className="text-xs text-subtle">{description}</small>
                <span className="od-source-badge">
                  {isActive ? "✓ Fuente activa" : "Seleccionar"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* CONTENIDO DE DESCUBRIMIENTO ESPECÍFICO SEGÚN LA FUENTE SELECCIONADA */}
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

          {genres
            .filter((g) => ["Action", "Fantasy", "Romance", "Acción", "Fantasía"].includes(g.name))
            .slice(0, 3)
            .map((g) => {
              const name = LABELS[g.name] || g.name;
              return (
                <UniversalRail
                  key={g.id}
                  title={`${name} · MangaDex`}
                  href={`/explorar?fuente=mangadex&md_genre=${encodeURIComponent(g.id)}`}
                  fetchUrl={`/api/externo/series?lang=es&order=popular&tag=${encodeURIComponent(g.id)}`}
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

      {fuente === "olympus" && (
        <>
          <UniversalRail
            title="Novedades de Olympus"
            href="/explorar?fuente=olympus&orden=novedades"
            fetchUrl="/api/externo/olympus/series?orden=novedades"
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: String(item.id || item.slug),
                title: item.title,
                cover_url: item.cover_url,
                href: `/externo/olympus/${item.slug}`,
                meta: item.chapter_count ? `${item.chapter_count} capítulos` : item.type || "Manhwa",
              }))
            }
          />
          <UniversalRail
            title="Populares de Olympus"
            href="/explorar?fuente=olympus&orden=populares"
            fetchUrl="/api/externo/olympus/series?orden=populares"
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: String(item.id || item.slug),
                title: item.title,
                cover_url: item.cover_url,
                href: `/externo/olympus/${item.slug}`,
                meta: item.status || item.type || "Manhwa",
              }))
            }
          />
        </>
      )}

      {fuente === "tmo" && (
        <>
          <UniversalRail
            title="Populares de ZonaTMO"
            href="/explorar?fuente=tmo"
            fetchUrl="/api/externo/tmo?ruta=/listing/popular"
            mapResponse={(data) => {
              const list = data?.data?.items || data?.items || [];
              return (Array.isArray(list) ? list : []).map((item: any) => ({
                id: String(item.id),
                title: item.title,
                cover_url: item.cover_url,
                href: `/externo/tmo/${item.type || "manga"}/${item.id}/${item.slug}`,
                meta: item.type ? `Tipo: ${item.type}` : "Ver capítulos",
              }));
            }}
          />
          <UniversalRail
            title="Novedades de ZonaTMO"
            href="/explorar?fuente=tmo"
            fetchUrl="/api/externo/tmo?ruta=/listing/latest"
            mapResponse={(data) => {
              const list = data?.data?.items || data?.items || [];
              return (Array.isArray(list) ? list : []).map((item: any) => ({
                id: String(item.id),
                title: item.title,
                cover_url: item.cover_url,
                href: `/externo/tmo/${item.type || "manga"}/${item.id}/${item.slug}`,
                meta: item.status || "Actualizado",
              }));
            }}
          />
        </>
      )}

      {fuente === "leercapitulo" && (
        <>
          <UniversalRail
            title="Novedades de LeerCapítulo"
            href="/explorar?fuente=leercapitulo&orden=novedades"
            fetchUrl="/api/externo/leercapitulo?orden=novedades"
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: String(item.id),
                title: item.titulo || item.title,
                cover_url: item.portada || item.cover_url,
                href: `/externo/leercapitulo/${item.id}/${item.slug}`,
                meta: item.estado || "Capítulo nuevo",
              }))
            }
          />
          <UniversalRail
            title="Populares de LeerCapítulo"
            href="/explorar?fuente=leercapitulo&orden=populares"
            fetchUrl="/api/externo/leercapitulo?orden=populares"
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: String(item.id),
                title: item.titulo || item.title,
                cover_url: item.portada || item.cover_url,
                href: `/externo/leercapitulo/${item.id}/${item.slug}`,
                meta: item.tipo || "Manga",
              }))
            }
          />
        </>
      )}

      {fuente === "catharsis" && (
        <>
          <UniversalRail
            title="Novedades de Catharsis World"
            href="/explorar?fuente=catharsis&orden=novedades"
            fetchUrl="/api/externo/catharsis?orden=novedades"
            mapResponse={(data) =>
              (Array.isArray(data?.series) ? data.series : []).map((item: any) => ({
                id: String(item.id),
                title: item.titulo || item.title,
                cover_url: item.portada || item.cover_url,
                href: `/externo/catharsis/${item.id}`,
                meta: item.estado || "Historia activa",
              }))
            }
          />
        </>
      )}

      {fuente === "ikigai" && (
        <div className="od-message">
          <h3 className="font-bold text-ink">Ikigai Mangas</h3>
          <p className="mt-1 text-sm text-subtle">
            Para proteger su servidor de centros de datos, Ikigai funciona mediante el puente nativo en las aplicaciones de Windows y Android.
          </p>
          <div className="mt-4">
            <Link href="/explorar?fuente=ikigai" className="od-outline">
              Abrir catálogo completo de Ikigai →
            </Link>
          </div>
        </div>
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
