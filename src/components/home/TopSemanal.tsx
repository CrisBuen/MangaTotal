"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/Feedback";
import { cargarConCacheAndroid } from "@/lib/androidCache";
import { isAndroidApp } from "@/lib/appVersion";

interface SerieDelTop {
  fuente: string;
  fuenteNombre: string;
  titulo: string;
  portada: string | null;
  href: string;
  nota: string | null;
}

interface RespuestaTop {
  series: SerieDelTop[];
  semana: number;
}

/** La misma numeración UTC que usa la API para cambiar el ranking los lunes. */
function semanaDelAno(fecha = new Date()): number {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const enero = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return d.getUTCFullYear() * 100 + Math.ceil(((d.getTime() - enero.getTime()) / 86400000 + 1) / 7);
}

/** Sobrevive a la navegación interna para que volver a Inicio no dibuje esqueletos. */
let topAndroidEnMemoria: RespuestaTop | null = null;

function topInicialAndroid(): SerieDelTop[] | null {
  if (typeof navigator === "undefined" || !isAndroidApp()) return null;
  const semana = semanaDelAno();
  return topAndroidEnMemoria?.semana === semana && topAndroidEnMemoria.series.length > 0
    ? topAndroidEnMemoria.series
    : null;
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
  const [series, setSeries] = useState<SerieDelTop[] | null>(topInicialAndroid);
  const carril = useRef<HTMLDivElement>(null);
  const [puedeIzquierda, setPuedeIzquierda] = useState(false);
  const [puedeDerecha, setPuedeDerecha] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activa = true;
    const semana = semanaDelAno();

    const aplicar = (respuesta: RespuestaTop) => {
      if (!activa) return;
      if (!Array.isArray(respuesta.series) || respuesta.series.length === 0) return;
      const normalizada = {
        series: respuesta.series,
        semana: Number(respuesta.semana) || semana,
      };
      if (typeof navigator !== "undefined" && isAndroidApp()) {
        topAndroidEnMemoria = normalizada;
      }
      setFallo(false);
      setSeries(normalizada.series);
    };

    void cargarConCacheAndroid<RespuestaTop>(
      // v2 evita reutilizar el resultado vacío que guardó la versión anterior.
      `inicio:top-semanal:v2:${semana}`,
      async (signal) => {
        const respuesta = await fetch("/api/top-semanal", { signal, cache: "no-store" });
        if (!respuesta.ok) throw new Error("No se pudo cargar el Top semanal");
        const datos = (await respuesta.json()) as RespuestaTop;
        // Un vacío transitorio no es un Top válido y nunca debe entrar al caché.
        if (!Array.isArray(datos.series) || datos.series.length === 0) {
          throw new Error("El Top semanal llegó vacío");
        }
        return datos;
      },
      {
        // El contenido depende de la cuenta porque respeta la preferencia +18.
        privateData: true,
        // Dentro de la misma semana prima mostrarlo al instante al volver a Inicio.
        freshForMs: 6 * 60 * 60 * 1000,
        maxAgeMs: 9 * 24 * 60 * 60 * 1000,
        timeoutMs: 8_000,
        onCached: aplicar,
      }
    )
      .then(aplicar)
      .catch(() => {
        if (activa) setFallo(true);
      });

    return () => {
      activa = false;
    };
  }, [intento]);

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

  return (
    <section data-od-id="home-top-semanal">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
            De todas las fuentes
          </p>
          <h2 className="mt-2 min-w-0 font-display text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-tight tracking-[-0.035em] text-ink">
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
        className="-mx-1 flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {series === null
          ? fallo
            ? (
              <div className="flex min-h-64 w-full flex-col items-center justify-center gap-4 rounded-[10px] border border-line bg-panel px-6 text-center">
                <p className="text-sm text-subtle">No se pudo cargar el Top semanal.</p>
                <button
                  type="button"
                  onClick={() => {
                    setFallo(false);
                    setIntento((actual) => actual + 1);
                  }}
                  className="min-h-11 rounded-md border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-ink"
                >
                  Reintentar
                </button>
              </div>
            )
            : Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-40 shrink-0 sm:w-44">
                <Skeleton className="aspect-[2/3] w-full rounded-[10px]" />
              </div>
            ))
          : series.map((s, i) => (
              <Link
                key={s.fuente + s.href}
                href={s.href}
                className="group w-40 shrink-0 snap-start rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink sm:w-44"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] transition-colors group-hover:border-line-strong">
                  {s.portada && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.portada}
                      alt={s.titulo}
                      className="h-full w-full object-cover"
                      loading={i < 4 ? "eager" : "lazy"}
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span className="absolute left-2 top-2 rounded-md border border-line-strong bg-[color-mix(in_oklch,var(--bg)_90%,transparent)] px-2 py-1 font-mono text-[11px] font-medium text-ink">
                    {i + 1}
                  </span>
                </div>

                <h3 className="mt-3 line-clamp-2 px-1 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
                  {s.titulo}
                </h3>
                <p className="mt-1 px-1 font-mono text-[13px] text-faint">
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
      className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-subtle transition-colors hover:border-ink hover:text-ink disabled:opacity-30 disabled:hover:border-line-strong disabled:hover:text-subtle"
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
