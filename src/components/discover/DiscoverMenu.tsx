"use client";

import { useEffect, useRef, useState } from "react";
import { isAndroidApp } from "@/lib/appVersion";

export const DISCOVER_GENRES = [
  ["accion", "Acción"], ["aventura", "Aventura"], ["comedia", "Comedia"], ["drama", "Drama"],
  ["fantasia", "Fantasía"], ["musica", "Musical"], ["romance", "Romance"], ["sci-fi", "Ciencia ficción"],
  ["seinen", "Seinen"], ["shoujo", "Shoujo"], ["shounen", "Shounen"], ["cosas-de-la-vida", "Vida cotidiana"],
  ["deportes", "Deportes"], ["sobrenatural", "Sobrenatural"], ["thriller", "Thriller"], ["misterio", "Misterio"],
] as const;

export function DiscoverMenu({ animeEnabled = false }: { animeEnabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [anime, setAnime] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => setAnime(!isAndroidApp() || animeEnabled), [animeEnabled]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); };
  }, [open]);
  return <div ref={container}>
    <button ref={toggle} className="od-menu-button" aria-label="Categorías y navegación" aria-expanded={open} aria-controls="od-categories" onClick={() => setOpen(!open)}>
      <span className="od-menu-label">Categorías</span><span aria-hidden="true">{open ? "×" : "☰"}</span>
    </button>
    {open && <div id="od-categories" className="od-mega" onClick={event => { if ((event.target as Element).closest("a")) setOpen(false); }}>
      <nav className="od-mega-aside" aria-label="Descubrir">
        <a href="/explorar?fuente=mangadex">Manga, manhwa y manhua</a>
        {anime && <><a href="/explorar?seccion=animada">Descubrir anime</a>
          <a href="/explorar?seccion=animada&vista=catalogo&sort=popularidad">Anime popular</a>
          <a href="/explorar?seccion=animada&vista=catalogo&status=emision">En emisión</a>
          <a href="/explorar?seccion=animada&vista=catalogo&sort=nombre">Directorio A–Z</a></>}
        <a href="/fuentes">Fuentes de mi biblioteca</a><a href="/noticias">Noticias</a><a href="/mas">Más opciones</a>
      </nav>
      <div className="od-mega-genres"><h3>{anime ? "Géneros de anime" : "Tu colección"}</h3>
        <div className="od-mega-grid">
          {anime ? DISCOVER_GENRES.map(([id, name]) => <a key={id} href={`/explorar?seccion=animada&vista=catalogo&genre=${id}`}>{name}</a>)
            : <><a href="/biblioteca">Biblioteca</a><a href="/biblioteca?f=favoritos">Favoritos</a><a href="/perfil">Perfil</a><a href="/ajustes">Ajustes</a></>}
        </div>
      </div>
    </div>}
  </div>;
}
