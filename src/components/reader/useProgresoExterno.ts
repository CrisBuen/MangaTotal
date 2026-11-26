"use client";

import { useEffect, useRef } from "react";
import { actualizarProgresoHistorialLocal } from "@/components/library/historial";
import {
  claveHistorialPendiente,
  esperarHistorialPendiente,
  guardarPosicionLector,
  registrarFlusherProgreso,
} from "@/lib/navegacionEstado";

const GUARDAR_MS = 1500;

/**
 * Al abrir un capítulo externo, actualiza el progreso de esa serie en la
 * biblioteca del usuario y en el historial local (invitado o con sesión).
 *
 * También va anotando por qué página va, con una pausa entre avisos para no
 * mandar un pedido por cada imagen que pasa, y realiza flush inmediato al
 * ocultar la pestaña/app o salir del capítulo.
 */
export function useProgresoExterno(entrada: {
  source: "mangadex" | "olympus" | "tmo" | "ikigai" | "leercapitulo" | "catharsis" | "ehentai" | "hitomi";
  externalId: string;
  chapterId: string;
  chapterName: string;
  /** Página actual dentro del capítulo, si el lector la informa. */
  pageNumber?: number;
}) {
  const { source, externalId, chapterId, chapterName, pageNumber } = entrada;

  // la serie está anotada (en la biblioteca o en el historial): hasta
  // saberlo no se manda solo_pagina antes de tiempo.
  const anotada = useRef(false);
  const paginaActualRef = useRef(pageNumber ?? 1);
  if (pageNumber && pageNumber > 0) {
    paginaActualRef.current = pageNumber;
  }
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimaPagina = useRef<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    anotada.current = false;
    ultimaPagina.current = null;
    const pagInicial = pageNumber && pageNumber > 0 ? Math.trunc(pageNumber) : 1;
    paginaActualRef.current = pagInicial;

    actualizarProgresoHistorialLocal({
      source,
      externalId,
      chapterId,
      chapterName,
      pageNumber: pagInicial,
    });
    guardarPosicionLector(`prog:${source}:${externalId}`, {
      page: pagInicial,
      chapterId,
    });

    const flush = () => {
      const pag = Math.max(1, Math.trunc(paginaActualRef.current || 1));
      actualizarProgresoHistorialLocal({
        source,
        externalId,
        chapterId,
        chapterName,
        pageNumber: pag,
      });
      guardarPosicionLector(`prog:${source}:${externalId}`, {
        page: pag,
        chapterId,
      });
      if (!anotada.current || ultimaPagina.current === pag) return;
      ultimaPagina.current = pag;
      fetch("/api/externo/biblioteca", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          external_id: externalId,
          last_chapter_id: chapterId,
          last_page_number: pag,
          solo_pagina: true,
          silencioso: true,
        }),
        keepalive: true,
      }).catch(() => {});
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const quitarFlusher = registrarFlusherProgreso(flush);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);

    (async () => {
      // Esperamos brevemente a que POST /api/externo/historial cree la fila si venimos
      // de tocar un capítulo nuevo, evitando el GET ?todo=1 redundante en cada apertura.
      await esperarHistorialPendiente(claveHistorialPendiente(source, externalId));
      if (cancelado) return;

      const paginaEnvio = Math.max(1, Math.trunc(paginaActualRef.current || 1));
      const res = await fetch("/api/externo/biblioteca", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          external_id: externalId,
          last_chapter_id: chapterId,
          last_chapter_name: chapterName,
          last_page_number: paginaEnvio,
          silencioso: true,
        }),
        keepalive: true,
      }).catch(() => null);

      if (!res?.ok || cancelado) return;
      const json = (await res.json().catch(() => null)) as { tracked?: boolean } | null;
      if (json && json.tracked === false) return;
      anotada.current = true;
      ultimaPagina.current = paginaEnvio;
    })();

    return () => {
      cancelado = true;
      flush();
      quitarFlusher();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, externalId, chapterId, chapterName]);

  // Avance dentro del capítulo y sincronización silenciosa de ?page=N en la URL.
  useEffect(() => {
    if (!pageNumber || pageNumber < 1) return;
    const pag = Math.trunc(pageNumber);
    paginaActualRef.current = pag;

    try {
      const url = new URL(window.location.href);
      const actualUrl = url.searchParams.get("page");
      // Conservamos window.history.state intacto para que Next.js no re-renderice
      // useSearchParams() ni la página del lector en cada salto de página al scrollear.
      if (pag > 1 && actualUrl !== String(pag)) {
        url.searchParams.set("page", String(pag));
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      } else if (pag === 1 && actualUrl && actualUrl !== "1") {
        url.searchParams.set("page", "1");
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      }
    } catch {}

    if (pag === ultimaPagina.current) return;
    if (temporizador.current) clearTimeout(temporizador.current);

    actualizarProgresoHistorialLocal({
      source,
      externalId,
      chapterId,
      chapterName,
      pageNumber: pag,
    });
    guardarPosicionLector(`prog:${source}:${externalId}`, {
      page: pag,
      chapterId,
    });

    temporizador.current = setTimeout(() => {
      if (!anotada.current) return;
      ultimaPagina.current = pag;
      fetch("/api/externo/biblioteca", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          external_id: externalId,
          // sin título: el servidor lo toma como aviso de avance a secas
          last_chapter_id: chapterId,
          last_page_number: pag,
          solo_pagina: true,
          silencioso: true,
        }),
        keepalive: true,
      }).catch(() => {});
    }, GUARDAR_MS);

    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [pageNumber, source, externalId, chapterId, chapterName]);
}
