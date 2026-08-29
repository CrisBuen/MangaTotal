"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/Feedback";

interface SerieDelTop {
  fuente: string;
  fuenteNombre: string;
  titulo: string;
  portada: string | null;
  href: string;
  nota: string | null;
}

/**
 * El top de la semana, en carrusel.
 *
 * Se arrastra con el dedo o con la rueda, y en pantallas grandes aparecen las
 * flechas. Cada tarjeta lleva a la serie, sea del catálogo propio o de una
 * fuente externa: para quien lee es lo mismo, y por eso van mezcladas y no
 * agrupadas por fuente.
 *
 * Qué series salen y por qué se mantienen toda la semana está explicado en
 * src/app/api/top-semanal/route.ts.
 */
export function TopSemanal() {
  const [series, setSeries] = useState<SerieDelTop[] | null>(null);
  const carril = useRef<HTMLDivElement>(null);
  const [puedeIzquierda, setPuedeIzquierda] = useState(false);
  const [puedeDerecha, setPuedeDerecha] = useState(false);

  useEffect(() => {
    fetch("/api/top-semanal")
      .then((r) => (r.ok ? r.json() : { series: [] }))
      .then((d) => setSeries(Array.isArray(d.series) ? d.series : []))
      .catch(() => setSeries([]));
  }, []);

  const revisarFlechas = useCallback(() => {
    const el = carril.current;
    if (!el) return;
    setPuedeIzquierda(el.scrollLeft > 8);
    setPuedeDerecha(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    revisarFlechas();
    const el = carril.current;
    if (!el) return;
    el.addEventListener("scroll", revisarFlechas, { passive: true });
    window.addEventListener("resize", revisarFlechas);
    return () => {
      el.removeEventListener("scroll", revisarFlechas);
      window.removeEventListener("resize", revisarFlechas);
    };
  }, [revisarFlechas, series]);

  function correr(hacia: 1 | -1) {
    const el = carril.current;
    if (!el) return;
    // casi una pantalla, dejando algo a la vista para no perder el hilo
    el.scrollBy({ left: hacia * (el.clientWidth * 0.85), behavior: "smooth" });
  }

  if (series !== null && series.length === 0) return null;

  return (
    <section data-od-id="home-top-semanal">
      <div className="mb-8 flex items-end justify-between gap-5">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
            De todas las fuentes
          </p>
          <h2 className="mt-2 font-display text-3xl font-black uppercase tracking-[-0.04em] text-ink sm:text-4xl">
            Top semanal
          </h2>
        </div>

        <div className="hidden gap-2 sm:flex">
          <Flecha hacia="izquierda" activa={puedeIzquierda} onClick={() => correr(-1)} />
          <Flecha hacia="derecha" activa={puedeDerecha} onClick={() => correr(1)} />
        </div>
      </div>

      <div
        ref={carril}
        className="-mx-1 flex min-w-0 snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {series === null
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-40 shrink-0 sm:w-44">
                <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
              </div>
            ))
          : series.map((s, i) => (
              <Link
                key={s.fuente + s.href}
                href={s.href}
                className="group w-40 shrink-0 snap-start rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-44"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
                  {s.portada && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.portada}
                      alt={s.titulo}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      loading={i < 4 ? "eager" : "lazy"}
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-[color-mix(in_oklch,var(--bg)_82%,transparent)] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-accent backdrop-blur-md">
                    {i + 1}
                  </span>
                </div>

                <h3 className="mt-3 line-clamp-2 px-1 text-sm font-bold leading-[1.2] text-ink transition group-hover:text-accent">
                  {s.titulo}
                </h3>
                <p className="mt-1 px-1 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                  {s.fuenteNombre}
                  {s.nota && ` · ${s.nota}`}
                </p>
              </Link>
            ))}
      </div>
    </section>
  );
}

function Flecha({
  hacia,
  activa,
  onClick,
}: {
  hacia: "izquierda" | "derecha";
  activa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!activa}
      aria-label={hacia === "izquierda" ? "Ver anteriores" : "Ver siguientes"}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-subtle transition hover:border-accent hover:text-accent disabled:opacity-30 disabled:hover:border-line disabled:hover:text-subtle"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        {hacia === "izquierda" ? (
          <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z" />
        ) : (
          <path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z" />
        )}
      </svg>
    </button>
  );
}
