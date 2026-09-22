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
  paginas: Record<string, number>;
  readThroughNumber: number | null;
}

const VACIO: ProgresoSerie = {
  ultimoId: null,
  ultimoNumero: null,
  ultimaPagina: null,
  guardada: false,
  paginas: {},
  readThroughNumber: null,
};

/** El sufijo para retomar en la página exacta, si hay que retomar. */
export function sufijoPagina(progreso: ProgresoSerie, esActual: boolean): string {
  if (!esActual || !progreso.ultimaPagina || progreso.ultimaPagina <= 1) return "";
  return `page=${progreso.ultimaPagina}`;
}

export function paginaCapitulo(progreso: ProgresoSerie, chapterId: string): string {
  const pagina = progreso.paginas[chapterId] ?? (chapterId === progreso.ultimoId ? progreso.ultimaPagina : null);
  return pagina && pagina > 1 ? `page=${pagina}` : "";
}

export function capituloLeido(progreso: ProgresoSerie, chapterId: string, numero: string | number | null): boolean {
  if (progreso.paginas[chapterId] !== undefined) return true;
  const valor = Number(numero);
  return progreso.readThroughNumber !== null && Number.isFinite(valor) && valor <= progreso.readThroughNumber;
}

/**
 * Por dónde va el usuario en una serie externa que tiene guardada.
 *
 * El capítulo actual y el historial de capítulos abiertos se consultan por
 * separado. La cota anterior conserva el aspecto de lecturas ya existentes.
 */
export function useProgresoSerie(source: string, externalId: string): ProgresoSerie {
  const [progreso, setProgreso] = useState<ProgresoSerie>(VACIO);

  useEffect(() => {
    if (!externalId) return;
    let cancelado = false;

    const cargar = async () => {
      const res = await fetch(`/api/externo/progreso?source=${encodeURIComponent(source)}&id=${encodeURIComponent(externalId)}`, {
        cache: "no-store",
      }).catch(() => null);
      if (!res?.ok || cancelado) return;

      const serie: {
        last_chapter_id: string | null;
        last_chapter_name: string | null;
        last_page_number: number | null;
        read_through_number: number | null;
        chapters: { id: string; page: number }[];
      } | null = await res.json().catch(() => null);
      if (cancelado) return;
      if (!serie) return setProgreso(VACIO);

      const numero = Number(serie.last_chapter_name ?? serie.last_chapter_id);
      setProgreso({
        ultimoId: serie.last_chapter_id,
        ultimoNumero: Number.isFinite(numero) ? numero : null,
        ultimaPagina: serie.last_page_number,
        guardada: true,
        paginas: Object.fromEntries((serie.chapters ?? []).map(c => [c.id, c.page])),
        readThroughNumber: serie.read_through_number,
      });
    };

    void cargar();
    // App Router puede conservar la ficha al abrir el lector y volver. En ese
    // caso el efecto no se monta de nuevo, así que se refresca al recuperar la
    // ventana para mostrar «vas por acá» sin obligar a recargar toda la app.
    window.addEventListener("focus", cargar);
    window.addEventListener("pageshow", cargar);
    window.addEventListener("popstate", cargar);

    return () => {
      cancelado = true;
      window.removeEventListener("focus", cargar);
      window.removeEventListener("pageshow", cargar);
      window.removeEventListener("popstate", cargar);
    };
  }, [source, externalId]);

  return progreso;
}

/** Clases para pintar un capítulo según si ya se leyó o es el actual. */
export function estiloCapitulo(esActual: boolean, esLeido: boolean): string {
  return `${esActual ? "bg-[var(--accent-soft)]" : ""} ${esLeido ? "opacity-55" : ""}`;
}
