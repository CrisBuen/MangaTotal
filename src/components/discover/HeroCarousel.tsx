"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export interface HeroItem {
  id: string;
  title: string;
  image: string | null;
  poster?: boolean;
  backdrop?: string | null;
  description?: string | null;
  meta?: string;
  href: string;
  action?: string;
  extra?: ReactNode;
}

function HeroArtwork({ item, active }: { item: HeroItem; active: boolean }) {
  const [wide, setWide] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  return <>
    {/* Una portada vertical no tiene resolución para cubrir una pantalla entera.
        Se conserva a escala natural; un fondo solo la sustituye si es HD real.
        TioAnime entrega también fondos de 1×1 para series sin banner. */}
    {item.poster && <div className="od-artwash" aria-hidden="true" />}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {item.image && <img className={item.poster ? "od-slide-poster" : "od-slide-art"} src={item.image} alt="" hidden={wide} referrerPolicy="no-referrer" fetchPriority={active ? "high" : "low"} decoding="async" />}
    {item.backdrop && !unavailable && (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="od-slide-art" src={item.backdrop} alt="" style={{ visibility: wide ? "visible" : "hidden" }}
        referrerPolicy="no-referrer" fetchPriority="low" decoding="async"
        onError={() => setUnavailable(true)} onLoad={event => {
          const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
          if (width >= 1280 && height >= 720 && width / height >= 1.5) setWide(true);
          else setUnavailable(true);
        }} />
    )}
  </>;
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
        <div key={item.id} className="od-slide" data-active={i === current} data-image={Boolean(item.image)} data-poster={Boolean(item.poster)} aria-hidden={i !== current} inert={i !== current}>
          {/* No descargar las seis portadas enormes antes del primer cuadro. */}
          {item.image && (i === current || i === (current + 1) % items.length || i === (current + items.length - 1) % items.length) && (
            <HeroArtwork item={item} active={i === current} />
          )}
          <div className="od-slide-scrim" aria-hidden="true" />
          <div className="od-slide-content">
            <Heading>{item.title}</Heading>
            {item.meta && <p className="od-hero-meta">{item.meta}</p>}
            {item.description && <p className="od-hero-description">{item.description}</p>}
            <div className="od-hero-actions">
              {item.href.startsWith("https://") ? <a className="od-primary" href={item.href} target="_blank" rel="noopener noreferrer">{item.action ?? "Ver detalles"} ↗</a>
                : <Link className="od-primary" href={item.href} prefetch={false}>{item.action ?? "Ver detalles"} →</Link>}
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
