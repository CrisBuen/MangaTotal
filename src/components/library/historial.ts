"use client";

/**
 * Anota en el historial que se abrió un capítulo de una serie externa.
 *
 * Se llama desde la ficha, al tocar el capítulo, y no desde el lector: así
 * queda registrado justo lo que se quiere —haber ido a leer— y no el simple
 * hecho de mirar la serie y volverse.
 *
 * Es a propósito silencioso y sin espera: si falla, la persona igual entra
 * a leer. El historial es una comodidad, no puede trabar la lectura.
 */
export function anotarHistorial(serie: {
  source: string;
  external_id: string;
  title: string;
  slug?: string | null;
  cover_url?: string | null;
  type?: string | null;
  last_chapter_id?: string | null;
  last_chapter_name?: string | null;
}): void {
  if (!serie.title || !serie.external_id) return;

  fetch("/api/externo/historial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(serie),
    // el clic navega enseguida: sin esto el pedido se cancelaría a medias
    keepalive: true,
  }).catch(() => {});
}
