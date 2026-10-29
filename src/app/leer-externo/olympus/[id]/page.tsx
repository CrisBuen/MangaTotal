"use client";

import { AvisoFuente } from "@/components/fuentes/AvisoFuente";
import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OlympusReader } from "@/components/reader/OlympusReader";
import { OLYMPUS_NOMBRE, urlSerieEnOlympus } from "@/lib/olympus";
import { cargarConCacheAndroid } from "@/lib/androidCache";
import { pedirCapituloOlympus } from "@/lib/olympusCliente";

interface CapituloData {
  id: number;
  name: string;
  title: string | null;
  pages: string[];
  prev: { id: number; name: string } | null;
  next: { id: number; name: string } | null;
  url_original: string;
  slug?: string;
}

/** Lector de capítulos de Olympus Scanlation. */
export default function LeerOlympusPage(props: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(props.params);
  const params = useSearchParams();
  const slugParam = params.get("slug")?.trim() ?? "";
  const tipo = params.get("tipo")?.trim() || "comic";
  const paginaInicial = Number(params.get("page")) || 1;

  const [capitulo, setCapitulo] = useState<CapituloData | null>(null);
  const [error, setError] = useState<unknown>(null);

  const cargar = useCallback(async () => {
    setError(null);
    setCapitulo(null);
    try {
      const id = parseInt(rawId, 10);
      if (!Number.isInteger(id)) {
        throw new Error("Identificador de capítulo inválido");
      }

      const qs = new URLSearchParams({
        tipo,
        ...(slugParam ? { slug: slugParam } : {}),
      });

      const data = await cargarConCacheAndroid<CapituloData>(
        `capitulo:olympus:${id}`,
        async (signal) => {
          return pedirCapituloOlympus(id, slugParam, tipo, signal);
        },
        {
          publicCache: true,
          freshForMs: 5 * 60 * 1000,
          maxAgeMs: 24 * 60 * 60 * 1000,
          timeoutMs: 25_000,
          onCached: (cached) => setCapitulo(cached),
        }
      );

      if (!data?.pages || data.pages.length === 0) {
        throw new Error("Este capítulo no tiene páginas disponibles");
      }

      setCapitulo(data);
    } catch (err) {
      setError(err);
    }
  }, [rawId, slugParam, tipo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const slugFinal = capitulo?.slug || slugParam;
  const volver = slugFinal ? `/externo/olympus/${slugFinal}` : "/explorar?fuente=olympus";

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <AvisoFuente
          error={error}
          volverA={volver}
          volverTexto="Volver a la serie"
          onReintentar={cargar}
        />
      </div>
    );
  }

  if (!capitulo) {
    return (
      <p className="py-24 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
        Cargando capítulo...
      </p>
    );
  }

  return (
    <OlympusReader
      key={capitulo.id}
      chapter={{
        id: capitulo.id,
        name: capitulo.name,
        urlOriginal: capitulo.url_original,
      }}
      serie={{
        slug: slugFinal,
        tipo,
        urlOriginal: urlSerieEnOlympus(tipo, slugFinal),
      }}
      grupo={OLYMPUS_NOMBRE}
      pages={capitulo.pages.map((url, i) => ({
        pageNumber: i + 1,
        url,
        width: 0,
        height: 0,
      }))}
      prevChapter={capitulo.prev}
      nextChapter={capitulo.next}
      initialMode="cascade"
      initialPage={paginaInicial}
      source="olympus"
      hrefVolver={volver}
      hrefCapitulo={(nextId) =>
        `/leer-externo/olympus/${nextId}?slug=${encodeURIComponent(slugFinal)}&tipo=${tipo}`
      }
    />
  );
}
