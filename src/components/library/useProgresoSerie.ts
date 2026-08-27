"use client";

import { useEffect, useState } from "react";

export interface ProgresoSerie {
  /** Identificador del último capítulo abierto, tal como lo guarda la fuente. */
  ultimoId: string | null;
  /** Su número, para poder marcar como leídos los anteriores. */
  ultimoNumero: number | null;
  /** Página por la que iba dentro de ese capítulo. */
  ultimaPagina: number | null;
  guardada: boolean;
}

const VACIO: ProgresoSerie = {
  ultimoId: null,
  ultimoNumero: null,
  ultimaPagina: null,
  guardada: false,
};

/** El sufijo para retomar en la página exacta, si hay que retomar. */
export function sufijoPagina(progreso: ProgresoSerie, esActual: boolean): string {
  if (!esActual || !progreso.ultimaPagina || progreso.ultimaPagina <= 1) return "";
  return `page=${progreso.ultimaPagina}`;
}

/**
 * Por dónde va el usuario en una serie externa que tiene guardada.
 *
 * Solo se guarda el último capítulo abierto, así que los anteriores se dan
 * por leídos: es como se lee un manga y evita llevar una lista por capítulo.
 */
export function useProgresoSerie(source: string, externalId: string): ProgresoSerie {
  const [progreso, setProgreso] = useState<ProgresoSerie>(VACIO);

  useEffect(() => {
    if (!externalId) return;
    let cancelado = false;

    (async () => {
      const res = await fetch("/api/externo/biblioteca").catch(() => null);
      if (!res?.ok || cancelado) return;

      const guardadas: {
        source: string;
        external_id: string;
        last_chapter_id: string | null;
        last_chapter_name: string | null;
        last_page_number: number | null;
      }[] = await res.json().catch(() => []);

      const serie = guardadas.find((e) => e.source === source && e.external_id === externalId);
      if (cancelado) return;
      if (!serie) return setProgreso(VACIO);

      const numero = Number(serie.last_chapter_name ?? serie.last_chapter_id);
      setProgreso({
        ultimoId: serie.last_chapter_id,
        ultimoNumero: Number.isFinite(numero) ? numero : null,
        ultimaPagina: serie.last_page_number,
        guardada: true,
      });
    })();

    return () => {
      cancelado = true;
    };
  }, [source, externalId]);

  return progreso;
}

/** Clases para pintar un capítulo según si ya se leyó o es el actual. */
export function estiloCapitulo(esActual: boolean, esLeido: boolean): string {
  if (esActual) return "bg-[var(--accent-soft)]";
  if (esLeido) return "opacity-55";
  return "";
}
