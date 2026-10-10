"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MediaRail } from "@/components/discover/MediaRail";
import { LC_HABILITADA } from "@/lib/leercapitulo";

type Genre = { id: string; name: string };
type Card = { id: string; title: string; cover_url: string | null; chapter_count?: number };
const href = (id?: string) => `/explorar?fuente=mangadex${id ? `&md_genre=${encodeURIComponent(id)}` : ""}`;
const LABELS: Record<string, string> = { Action: "Acción", Adventure: "Aventura", Romance: "Romance", Fantasy: "Fantasía", Comedy: "Comedia", Drama: "Drama", Mystery: "Misterio", "Slice of Life": "Vida cotidiana", Horror: "Terror", "Sci-Fi": "Ciencia ficción", Sports: "Deportes", Thriller: "Suspenso" };

function GenreRail({ genre }: { genre: Genre }) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [series, setSeries] = useState<Card[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "160px" });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let active = true; setFailed(false);
    fetch(`/api/externo/series?lang=es&order=popular&tag=${encodeURIComponent(genre.id)}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (active) setSeries(Array.isArray(data.series) ? data.series : []); })
      .catch(() => { if (active) setFailed(true); }).finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [visible, genre.id, attempt]);
  const name = LABELS[genre.name] || genre.name;
  return <div ref={root}>
    <MediaRail title={`${name} · MangaDex`} href={href(genre.id)}>
      {series?.map(item => <Link className="od-media-card" key={item.id} href={`/externo/${item.id}`} prefetch={false}>
        <span className="od-media-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {item.cover_url ? <img src={item.cover_url} alt="" loading="lazy" decoding="async" /> : <span className="od-no-cover">Sin portada</span>}
          <span className="od-media-play" aria-hidden="true">↗</span>
        </span><span className="od-media-title">{item.title}</span><span className="od-media-meta">{item.chapter_count ? `${item.chapter_count} capítulos` : "Ver capítulos"}</span>
      </Link>)}
      {!series && !failed && Array.from({ length: 7 }, (_, i) => <div className="od-card-skeleton" key={i} aria-hidden="true" />)}
    </MediaRail>
    {failed && <p className="od-message" role="status">No se pudo cargar esta selección. <button onClick={() => setAttempt(n => n + 1)}>Reintentar {name}</button></p>}
    {series?.length === 0 && <p className="od-message">No hay capítulos disponibles en español para esta selección.</p>}
  </div>;
}

/** Misma gramática visual que Anime, sin mezclar adaptadores ni datos privados. */
export function ReadingDiscover() {
  const [genres, setGenres] = useState<Genre[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/externo/generos", { signal: controller.signal }).then(r => r.json())
      .then(data => { if (Array.isArray(data)) setGenres(data); }).catch(() => {});
    return () => controller.abort();
  }, []);
  const sources = [["mangadex", "MangaDex", "Manga en español y otros idiomas"], ["olympus", "Olympus", "Manga, manhwa y manhua"], ["tmo", "ZonaTMO", "Catálogo y grupos de traducción"], ...(LC_HABILITADA ? [["leercapitulo", "LeerCapítulo", "Novedades de lectura"]] : []), ["catharsis", "Catharsis", "Historias de su catálogo"], ["ikigai", "Ikigai Mangas", "Lectura desde Windows y Android"]];
  return <div className="od-reading-discover">
    <section aria-labelledby="reading-sources"><p className="od-eyebrow">Tus fuentes de siempre</p><h2 id="reading-sources">Elegí dónde descubrir</h2>
      <div className="od-reading-sources">{sources.map(([id, name, description]) => <Link key={id} href={`/explorar?fuente=${id}`} prefetch={false}><span>{name}</span><small>{description}</small><span aria-hidden="true">↗</span></Link>)}</div>
    </section>
    {genres.length > 0 && <section className="od-genres" aria-labelledby="reading-genres"><h2 id="reading-genres">¿Qué te gustaría leer?</h2><p>Géneros de MangaDex. Cada fuente conserva sus propios filtros en el catálogo.</p><div className="od-genre-grid">{genres.map(g => <Link key={g.id} href={href(g.id)} prefetch={false}>{LABELS[g.name] || g.name}<span aria-hidden="true">↗</span></Link>)}</div></section>}
    {genres.filter(g => ["Action", "Fantasy", "Romance", "Acción", "Fantasía"].includes(g.name)).slice(0, 3).map(g => <GenreRail key={g.id} genre={g} />)}
    <p className="od-source-credit">Catálogos de las fuentes integradas, con su permiso. Cada ficha conserva el enlace a la fuente original.</p>
  </div>;
}
