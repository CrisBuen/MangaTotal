"use client";

import { useEffect } from "react";

/**
 * Al abrir un capítulo externo, actualiza el progreso de esa serie en la
 * biblioteca del usuario. Si la serie no está guardada, no hace nada.
 */
export function useProgresoExterno(entrada: {
  source: "mangadex" | "olympus" | "tmo";
  externalId: string;
  chapterId: string;
  chapterName: string;
}) {
  const { source, externalId, chapterId, chapterName } = entrada;

  useEffect(() => {
    let cancelado = false;

    (async () => {
      const res = await fetch("/api/externo/biblioteca").catch(() => null);
      if (!res?.ok || cancelado) return;

      const guardadas: { source: string; external_id: string; title: string; cover_url: string | null; slug: string | null; type: string | null }[] =
        await res.json();
      const serie = guardadas.find((e) => e.source === source && e.external_id === externalId);
      if (!serie || cancelado) return;

      fetch("/api/externo/biblioteca", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          external_id: externalId,
          slug: serie.slug,
          title: serie.title,
          cover_url: serie.cover_url,
          type: serie.type,
          last_chapter_id: chapterId,
          last_chapter_name: chapterName,
        }),
        keepalive: true,
      }).catch(() => {});
    })();

    return () => {
      cancelado = true;
    };
  }, [source, externalId, chapterId, chapterName]);
}
