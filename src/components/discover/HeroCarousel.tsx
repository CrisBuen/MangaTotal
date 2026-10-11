"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { AnimeArtwork } from "@/lib/animeArtwork";

const artworkCache = new Map<string, AnimeArtwork>();

export interface HeroItem {
  id: string;
  title: string;
  image: string | null;
  poster?: boolean;
  backdrop?: string | null;
  artworkTitle?: string;
  description?: string | null;
  meta?: string;
  badges?: string[];
  href: string;
  action?: string;
  extra?: ReactNode;
}

function HeroArtwork({ item, active }: { item: HeroItem; active: boolean }) {
  const [wideUrl, setWideUrl] = useState<string | null>(() => {
    if (!item.poster && item.image) return item.image;
    if (item.backdrop && (item.backdrop.includes("/banner/") || item.backdrop.includes("/fondos/"))) {
      return item.backdrop;
    }
    return null;
  });
  const [unavailableUrl, setUnavailableUrl] = useState<string | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const [art, setArt] = useState<AnimeArtwork | null>(() => artworkCache.get(item.artworkTitle ?? "") ?? null);

  useEffect(() => {
    const title = item.artworkTitle;
    if (!title || !active || artworkCache.has(title)) return;
    const controller = new AbortController();
    fetch(`/api/anime/arte?q=${encodeURIComponent(title)}`, { signal: controller.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(value => {
        if (!value || controller.signal.aborted) return;
        if (artworkCache.size >= 40) artworkCache.delete(artworkCache.keys().next().value!);
        artworkCache.set(title, value);
        setArt(value);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [item.artworkTitle, active]);

  // Si no es un póster vertical (ej. noticias en Inicio), item.image ya es la imagen panorámica completa
  const banner = item.backdrop || art?.banner || (!item.poster ? item.image : null);
  const wide = Boolean(banner && unavailableUrl !== banner);
  const posterCover = (!coverFailed && (art?.cover || item.image)) || null;

  return (
    <>
      {/* Fondo ambiental teatral solo para cuando es un póster vertical y no hay banner panorámico */}
      {item.poster && posterCover && (!wide || !wideUrl) && (
        <div className="od-ambient-backdrop" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={posterCover}
            alt=""
            className="od-ambient-img"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Banner panorámico completo (Noticias de inicio, fondos verificados o arte panorámico oficial Full HD) */}
      {banner && unavailableUrl !== banner && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={banner}
          className="od-slide-art"
          src={banner}
          alt=""
          style={{ opacity: wideUrl === banner || (!item.poster && banner) ? 1 : 0 }}
          referrerPolicy="no-referrer"
          fetchPriority={active ? "high" : "low"}
          decoding="async"
          onError={() => {
            setUnavailableUrl(banner);
            setWideUrl(null);
          }}
          onLoad={event => {
            const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
            if (width >= 400 && height >= 160 && width / height >= 1.1) {
              setWideUrl(banner);
            } else if (item.poster) {
              setUnavailableUrl(banner);
              setWideUrl(null);
            }
          }}
        />
      )}

      {/* Si es un ítem de tipo póster vertical (anime sin arte horizontal), mostramos el póster nítido a la derecha */}
      {item.poster && !wide && posterCover && (
        <div className="od-hero-poster-container" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="od-hero-poster-card"
            src={posterCover}
            alt=""
            referrerPolicy="no-referrer"
            fetchPriority={active ? "high" : "low"}
            decoding="async"
            onError={() => setCoverFailed(true)}
          />
        </div>
      )}

      {art?.credit && (
        <a className="od-art-credit" href={art.credit} target="_blank" rel="noopener noreferrer">
          Arte · AniList ↗
        </a>
      )}
    </>
  );
}

/** La animación proviene del HTML; solamente los datos y enlaces son reales. */
export function HeroCarousel({ items, heading = "h1" }: { items: HeroItem[]; heading?: "h1" | "h2" }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [reduced, setReduced] = useState(true);
  const Heading = heading;
  const current = Math.min(index, Math.max(0, items.length - 1));
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    change(); media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (paused || interacting || reduced || items.length < 2) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setIndex(value => (value + 1) % items.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [paused, interacting, reduced, items.length, current]);
  if (!items.length) return null;
  const go = (value: number) => setIndex((value + items.length) % items.length);
  return (
    <section className="od-hero" aria-roledescription="carrusel" aria-label="Destacados" data-od-id="hero-carousel"
      onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }}>
      {items.map((item, i) => (
        <div key={item.id} className="od-slide" data-active={i === current} data-image={Boolean(item.image || item.backdrop)} data-poster={Boolean(item.poster && !item.backdrop)} aria-hidden={i !== current} inert={i !== current}>
          {/* No descargar las portadas enormes antes del primer cuadro visible. */}
          {(item.image || item.backdrop) && (i === current || i === (current + 1) % items.length || i === (current + items.length - 1) % items.length) && (
            <HeroArtwork item={item} active={i === current} />
          )}
          <div className="od-slide-scrim" aria-hidden="true" />
          <div className="od-slide-content">
            {item.badges && item.badges.length > 0 && (
              <div className="od-hero-badges">
                {item.badges.map((b, idx) => (
                  <span key={idx} className="od-hero-badge">
                    {b}
                  </span>
                ))}
              </div>
            )}
            <Heading>{item.title}</Heading>
            {item.meta && <p className="od-hero-meta">{item.meta}</p>}
            {item.description && <p className="od-hero-description">{item.description}</p>}
            <div className="od-hero-actions">
              {item.href.startsWith("https://") ? (
                <a className="od-primary od-hero-primary" href={item.href} target="_blank" rel="noopener noreferrer">
                  <span className="od-btn-play" aria-hidden="true">▶</span> {item.action ?? "Ver ahora"} ↗
                </a>
              ) : (
                <Link className="od-primary od-hero-primary" href={item.href} prefetch={false}>
                  <span className="od-btn-play" aria-hidden="true">▶</span> {item.action ?? "Ver ahora"}
                </Link>
              )}
              {item.extra}
            </div>
          </div>
        </div>
      ))}
      {items.length > 1 && <>
        <button className="od-hero-arrow prev" onClick={() => go(current - 1)} aria-label="Anterior destacado">‹</button>
        <button className="od-hero-arrow next" onClick={() => go(current + 1)} aria-label="Siguiente destacado">›</button>
        <div className="od-dots" role="group" aria-label="Elegir destacado" onKeyDown={event => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); go(current + (event.key === "ArrowRight" ? 1 : -1)); }
        }}>
          {items.map((item, i) => <button key={item.id} className="od-dot" aria-label={`Destacado ${i + 1}: ${item.title}`} aria-pressed={i === current} onClick={() => go(i)} />)}
          {!reduced && <button className="od-pause" aria-label={paused ? "Activar rotación" : "Pausar rotación"} onClick={() => setPaused(!paused)}>{paused ? "▶" : "Ⅱ"}</button>}
        </div>
      </>}
    </section>
  );
}
