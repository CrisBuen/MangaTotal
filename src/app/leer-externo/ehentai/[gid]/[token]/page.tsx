"use client";

import { use, useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OlympusReader } from "@/components/reader/OlympusReader";
import { AvisoFuente } from "@/components/fuentes/AvisoFuente";
import { cargarConCacheAndroid } from "@/lib/androidCache";
import type { FichaEhentai } from "@/lib/ehentai";

function LectorEhentaiContenido(props: {
  params: Promise<{ gid: string; token: string }>;
}) {
  const { gid, token } = use(props.params);
  const searchParams = useSearchParams();
  const initialPage = Math.max(1, parseInt(searchParams.get("page") ?? searchParams.get("p") ?? "1", 10) || 1);
  const [ficha, setFicha] = useState<FichaEhentai | null>(null);
  const [paginas, setPaginas] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [dataFicha, listaPaginas] = await Promise.all([
        cargarConCacheAndroid<FichaEhentai>(
          `ficha:ehentai:${gid}:${token}`,
          async (signal) => {
            const resFicha = await fetch(`/api/externo/ehentai/${gid}/${token}`, { signal });
            if (!resFicha.ok) {
              if (resFicha.status === 403) {
                throw new Error("Contenido +18 no disponible en esta edición.");
              }
              throw new Error("No se pudo cargar la información de la galería");
            }
            return resFicha.json();
          },
          {
            publicCache: true,
            freshForMs: 30 * 60 * 1000,
            maxAgeMs: 24 * 60 * 60 * 1000,
            onCached: (cached) => setFicha(cached),
          }
        ),
        cargarConCacheAndroid<string[]>(
          `paginas:ehentai:${gid}:${token}`,
          async (signal) => {
            const resPaginas = await fetch(`/api/externo/ehentai/${gid}/${token}/paginas`, { signal });
            if (!resPaginas.ok) {
              throw new Error("No se pudieron cargar las páginas de la galería");
            }
            const dataPaginas = await resPaginas.json();
            return dataPaginas.paginas || [];
          },
          {
            publicCache: true,
            freshForMs: 30 * 60 * 1000,
            maxAgeMs: 24 * 60 * 60 * 1000,
            onCached: (cached) => {
              if (cached.length > 0) setPaginas(cached);
            },
          }
        ),
      ]);

      if (!listaPaginas || listaPaginas.length === 0) {
        throw new Error("Esta galería no contiene páginas");
      }

      setFicha(dataFicha);
      setPaginas(listaPaginas);
    } catch (err) {
      setError(err);
    } finally {
      setCargando(false);
    }
  }, [gid, token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const volverA = `/externo/ehentai/${gid}/${token}`;

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <AvisoFuente
          error={error}
          volverA={volverA}
          volverTexto="Volver a la galería"
          onReintentar={cargar}
        />
      </div>
    );
  }

  if ((cargando && (!ficha || paginas.length === 0)) || !ficha) {
    return (
      <p className="py-24 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
        Cargando lector de E-Hentai...
      </p>
    );
  }

  return (
    <OlympusReader
      chapter={{
        id: `${gid}/${token}`,
        name: "Capítulo Completo",
        urlOriginal: ficha.url_original,
      }}
      serie={{
        slug: `${gid}/${token}`,
        tipo: "ehentai",
        urlOriginal: ficha.url_original,
      }}
      grupo="E-Hentai"
      source="ehentai"
      externalId={gid}
      initialPage={initialPage}
      hrefVolver={volverA}
      hrefCapitulo={() => volverA}
      pages={paginas.map((url, i) => ({
        pageNumber: i + 1,
        url,
        width: 0,
        height: 0,
      }))}
      prevChapter={null}
      nextChapter={null}
      initialMode="cascade"
    />
  );
}

export default function LeerEhentaiPage(props: {
  params: Promise<{ gid: string; token: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <LectorEhentaiContenido {...props} />
    </Suspense>
  );
}
