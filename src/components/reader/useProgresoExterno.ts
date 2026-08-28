"use client";

import { useEffect, useRef } from "react";

const GUARDAR_MS = 1500;

/**
 * Al abrir un capítulo externo, actualiza el progreso de esa serie en la
 * biblioteca del usuario. Si la serie no está guardada, no hace nada.
 *
 * También va anotando por qué página va, con una pausa entre avisos para no
 * mandar un pedido por cada imagen que pasa.
 */
export function useProgresoExterno(entrada: {
  source: "mangadex" | "olympus" | "tmo" | "ikigai" | "leercapitulo" | "catharsis";
  externalId: string;
  chapterId: string;
  chapterName: string;
  /** Página actual dentro del capítulo, si el lector la informa. */
  pageNumber?: number;
}) {
  const { source, externalId, chapterId, chapterName, pageNumber } = entrada;

  // la serie está anotada (en la biblioteca o en el historial): hasta
  // saberlo no se manda nada
  const anotada = useRef(false);
  // la página con la que se entró: al abrir el capítulo se reafirma esa, no
  // la 1, o abrir y salir borraría por dónde ibas
  const paginaDeEntrada = useRef(pageNumber ?? 1);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimaPagina = useRef<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    anotada.current = false;

    (async () => {
      // ?todo=1 incluye las del historial: si abriste un capítulo, el avance
      // se guarda aunque todavía no la hayas puesto en la biblioteca
      const res = await fetch("/api/externo/biblioteca?todo=1").catch(() => null);
      if (!res?.ok || cancelado) return;

      const anotadas: { source: string; external_id: string }[] = await res
        .json()
        .catch(() => []);

      const existe = anotadas.some((e) => e.source === source && e.external_id === externalId);
      if (!existe || cancelado) return;
      anotada.current = true;

      // sin título a propósito: así la ruta lo toma como aviso de avance y no
      // como un guardado a mano. Si se mandara el título, una serie del
      // historial pasaría sola a la biblioteca con solo abrir un capítulo.
      fetch("/api/externo/biblioteca", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          external_id: externalId,
          last_chapter_id: chapterId,
          last_chapter_name: chapterName,
          last_page_number: paginaDeEntrada.current,
        }),
        keepalive: true,
      }).catch(() => {});
    })();

    return () => {
      cancelado = true;
    };
  }, [source, externalId, chapterId, chapterName]);

  // avance dentro del capítulo
  useEffect(() => {
    if (!pageNumber || pageNumber === ultimaPagina.current) return;
    if (temporizador.current) clearTimeout(temporizador.current);

    temporizador.current = setTimeout(() => {
      if (!anotada.current) return;
      ultimaPagina.current = pageNumber;
      fetch("/api/externo/biblioteca", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          external_id: externalId,
          // sin título: el servidor lo toma como aviso de avance a secas
          last_page_number: pageNumber,
        }),
        keepalive: true,
      }).catch(() => {});
    }, GUARDAR_MS);

    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [pageNumber, source, externalId]);
}
