"use client";

import { use, useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OlympusReader } from "@/components/reader/OlympusReader";
import { AvisoFuente } from "@/components/fuentes/AvisoFuente";
import type { FichaHitomi } from "@/lib/hitomiTipos";

function LectorHitomiContenido(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);
  const searchParams = useSearchParams();
  const initialPage = Math.max(1, parseInt(searchParams.get("page") ?? searchParams.get("p") ?? "1", 10) || 1);
  const [ficha, setFicha] = useState<FichaHitomi | null>(null);
  const [paginas, setPaginas] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [resFicha, resPaginas] = await Promise.all([
        fetch(`/api/externo/hitomi/${id}`),
        fetch(`/api/externo/hitomi/${id}/paginas`),
      ]);

      if (!resFicha.ok) {
        if (resFicha.status === 403) {
          throw new Error("Contenido +18 no disponible en esta edición.");
        }
        throw new Error("No se pudo cargar la información de la galería");
      }
      if (!resPaginas.ok) {
        throw new Error("No se pudieron cargar las páginas de la galería");
      }

      const dataFicha = await resFicha.json();
      const dataPaginas = await resPaginas.json();

      if (!dataPaginas.paginas || dataPaginas.paginas.length === 0) {
        throw new Error("Esta galería no contiene páginas");
      }

      setFicha(dataFicha);
      setPaginas(dataPaginas.paginas);
    } catch (err) {
      setError(err);
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const volverA = `/externo/hitomi/${id}`;

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

  if (cargando || !ficha) {
    return (
      <p className="py-24 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
        Cargando lector de Hitomi.la...
      </p>
    );
  }

  return (
    <OlympusReader
      chapter={{
        id,
        name: "Capítulo Completo",
        urlOriginal: ficha.url_original,
      }}
      serie={{
        slug: id,
        tipo: "hitomi",
        urlOriginal: ficha.url_original,
      }}
      grupo="Hitomi.la"
      source="hitomi"
      externalId={id}
      initialPage={initialPage}
      hrefVolver={volverA}
      hrefCapitulo={() => volverA}
      pages={paginas.map((url, i) => ({
        pageNumber: i + 1,
        url: url.startsWith("/api/externo/imagen")
          ? url
          : `/api/externo/imagen?u=${encodeURIComponent(url)}`,
        width: 0,
        height: 0,
      }))}
      prevChapter={null}
      nextChapter={null}
      initialMode="cascade"
    />
  );
}

export default function LeerHitomiPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <LectorHitomiContenido {...props} />
    </Suspense>
  );
}
