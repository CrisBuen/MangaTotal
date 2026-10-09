"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MediaRail } from "@/components/discover/MediaRail";
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

  return <section className="od-fullbleed" data-od-id="home-top-semanal">
    <MediaRail title="Top semanal · de todas las fuentes" href="/explorar">
      {series === null
        ? Array.from({ length: 8 }, (_, i) => <div key={i} className="od-card-skeleton" aria-hidden="true" />)
        : series.map((serie, i) => <Link key={serie.fuente + serie.href} href={serie.href} prefetch={false} className="od-media-card">
          <div className="od-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {serie.portada && <img src={serie.portada} alt={serie.titulo} loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
            <span className="od-card-source">{i + 1}</span>
          </div>
          <h3>{serie.titulo}</h3><p>{serie.fuenteNombre}{serie.nota && ` · ${serie.nota}`}</p>
        </Link>)}
    </MediaRail>
    {fallo && series === null && <div className="od-message"><p>No se pudo cargar el Top semanal.</p><button onClick={() => { setFallo(false); setIntento(value => value + 1); }}>Reintentar</button></div>}
  </section>;
}
