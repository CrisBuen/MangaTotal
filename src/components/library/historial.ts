"use client";

import { capituloHref, fichaHref } from "@/lib/externas";

const CLAVE_HISTORIAL_LOCAL = "mangatotal:historial:local";
const MAX_HISTORIAL_LOCAL = 80;

export interface EntradaHistorialLocal {
  source: string;
  external_id: string;
  slug: string | null;
  title: string;
  cover_url: string | null;
  type: string | null;
  last_chapter_id: string | null;
  last_chapter_name: string | null;
  last_page_number: number | null;
  href: string;
  href_continuar: string;
  created_at: string;
  updated_at: string;
  paginas?: Record<string, number>;
}

export function leerHistorialLocal(): EntradaHistorialLocal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLAVE_HISTORIAL_LOCAL);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function guardarHistorialLocal(lista: EntradaHistorialLocal[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CLAVE_HISTORIAL_LOCAL,
      JSON.stringify(lista.slice(0, MAX_HISTORIAL_LOCAL))
    );
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
}

export function buscarHistorialLocal(
  source: string,
  externalId: string
): EntradaHistorialLocal | null {
  const lista = leerHistorialLocal();
  return (
    lista.find((x) => x.source === source && x.external_id === externalId) ??
    null
  );
}

export function quitarHistorialLocal(source: string, externalId: string): void {
  const lista = leerHistorialLocal();
  const filtrada = lista.filter(
    (x) => !(x.source === source && x.external_id === externalId)
  );
  guardarHistorialLocal(filtrada);
}

export function actualizarProgresoHistorialLocal(entrada: {
  source: string;
  externalId: string;
  chapterId: string;
  chapterName?: string;
  pageNumber?: number;
}): void {
  if (!entrada.source || !entrada.externalId || !entrada.chapterId) return;
  const lista = leerHistorialLocal();
  const idx = lista.findIndex(
    (x) => x.source === entrada.source && x.external_id === entrada.externalId
  );
  if (idx === -1) return;

  const actual = lista[idx];
  const pagina =
    entrada.pageNumber && entrada.pageNumber > 0
      ? Math.trunc(entrada.pageNumber)
      : actual.last_chapter_id === entrada.chapterId
        ? (actual.last_page_number ?? 1)
        : 1;
  const nombreCapitulo =
    entrada.chapterName !== undefined
      ? entrada.chapterName
      : actual.last_chapter_name;
  const ahora = new Date().toISOString();
  const paginas = { ...(actual.paginas ?? {}), [entrada.chapterId]: pagina };

  const actualizado: EntradaHistorialLocal = {
    ...actual,
    last_chapter_id: entrada.chapterId,
    last_chapter_name: nombreCapitulo ?? actual.last_chapter_name,
    last_page_number: pagina,
    href_continuar: capituloHref(
      actual.source,
      actual.external_id,
      actual.slug,
      actual.type,
      entrada.chapterId,
      pagina,
      nombreCapitulo ?? actual.last_chapter_name
    ),
    updated_at: ahora,
    paginas,
  };

  const resto = lista.filter((_, i) => i !== idx);
  guardarHistorialLocal([actualizado, ...resto]);
}

export function migrarHistorialLocal(
  origen: { source: string; externalId: string },
  destino: {
    source: string;
    externalId: string;
    slug?: string | null;
    title: string;
    coverUrl?: string | null;
    type?: string | null;
  }
): void {
  const lista = leerHistorialLocal();
  const existente = lista.find(
    (x) => x.source === origen.source && x.external_id === origen.externalId
  );
  const ahora = new Date().toISOString();
  const slug = destino.slug ?? null;
  const type =
    destino.source === "ehentai" || destino.source === "hitomi"
      ? "adult"
      : (destino.type ?? existente?.type ?? null);
  const href = fichaHref(destino.source, destino.externalId, slug);
  const migrada: EntradaHistorialLocal = {
    source: destino.source,
    external_id: destino.externalId,
    slug,
    title: destino.title,
    cover_url: destino.coverUrl ?? existente?.cover_url ?? null,
    type,
    last_chapter_id: existente?.last_chapter_name ?? existente?.last_chapter_id ?? null,
    last_chapter_name: existente?.last_chapter_name ?? null,
    last_page_number: existente?.last_page_number ?? 1,
    href,
    href_continuar: href,
    created_at: existente?.created_at ?? ahora,
    updated_at: ahora,
    paginas: existente?.paginas ?? {},
  };
  const filtrada = lista.filter(
    (x) =>
      !(x.source === origen.source && x.external_id === origen.externalId) &&
      !(x.source === destino.source && x.external_id === destino.externalId)
  );
  guardarHistorialLocal([migrada, ...filtrada]);
}

/**
 * Anota en el historial que se abrió un capítulo de una serie externa.
 *
 * Se llama desde la ficha, al tocar el capítulo, y no desde el lector: así
 * queda registrado justo lo que se quiere —haber ido a leer— y no el simple
 * hecho de mirar la serie y volverse.
 *
 * Guarda tanto en almacenamiento local (para invitados y respaldo inmediato)
 * como en la cuenta si hay sesión iniciada.
 */
export async function anotarHistorial(serie: {
  source: string;
  external_id: string;
  title: string;
  slug?: string | null;
  cover_url?: string | null;
  type?: string | null;
  last_chapter_id?: string | null;
  last_chapter_name?: string | null;
  last_page_number?: number | null;
}): Promise<void> {
  if (!serie.title || !serie.external_id) return;

  try {
    const lista = leerHistorialLocal();
    const existente = lista.find(
      (x) => x.source === serie.source && x.external_id === serie.external_id
    );
    const ahora = new Date().toISOString();
    const slug = serie.slug ?? existente?.slug ?? null;
    const type =
      serie.source === "ehentai" || serie.source === "hitomi"
        ? "adult"
        : (serie.type ?? existente?.type ?? null);
    const chapterId =
      serie.last_chapter_id !== undefined
        ? serie.last_chapter_id
        : (existente?.last_chapter_id ?? null);
    const chapterName =
      serie.last_chapter_name !== undefined
        ? serie.last_chapter_name
        : (existente?.last_chapter_name ?? null);
    const pageNumber =
      serie.last_page_number !== undefined
        ? serie.last_page_number
        : chapterId && existente?.paginas?.[chapterId]
          ? existente.paginas[chapterId]
          : chapterId === existente?.last_chapter_id
            ? (existente?.last_page_number ?? 1)
            : 1;
    const href = fichaHref(serie.source, serie.external_id, slug);
    const hrefContinuar = chapterId
      ? capituloHref(
          serie.source,
          serie.external_id,
          slug,
          type,
          chapterId,
          pageNumber,
          serie.last_chapter_name ?? null
        )
      : href;
    const paginas = { ...(existente?.paginas ?? {}) };
    if (chapterId && pageNumber) {
      paginas[chapterId] = pageNumber;
    }

    const nueva: EntradaHistorialLocal = {
      source: serie.source,
      external_id: serie.external_id,
      slug,
      title: serie.title,
      cover_url: serie.cover_url ?? existente?.cover_url ?? null,
      type,
      last_chapter_id: chapterId,
      last_chapter_name: chapterName,
      last_page_number: pageNumber,
      href,
      href_continuar: hrefContinuar,
      created_at: existente?.created_at ?? ahora,
      updated_at: ahora,
      paginas,
    };

    const sinActual = lista.filter(
      (x) => !(x.source === serie.source && x.external_id === serie.external_id)
    );
    guardarHistorialLocal([nueva, ...sinActual]);
  } catch {
    /* continuar con el envío al servidor */
  }

  await fetch("/api/externo/historial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(serie),
    // el clic navega enseguida: sin esto el pedido se cancelaría a medias
    keepalive: true,
  }).catch(() => undefined);
}
