"use client";

import { AvisoFuente } from "@/components/fuentes/AvisoFuente";
import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OlympusReader } from "@/components/reader/OlympusReader";
import { IKIGAI_NOMBRE, capituloIkigai, ikigaiDisponible, serieIkigai } from "@/lib/ikigai";

interface Vecino {
  id: number;
  name: string;
}

/** Lector de Ikigai Mangas: las páginas se piden desde el dispositivo. */
export default function LeerIkigaiPage(props: { params: Promise<{ id: string }> }) {
  const { id: chapterId } = use(props.params);
  const params = useSearchParams();
  const slug = params.get("slug") ?? "";
  const paginaInicial = Number(params.get("page")) || 1;

  const [paginas, setPaginas] = useState<string[] | null>(null);
  const [vecinos, setVecinos] = useState<{ prev: Vecino | null; next: Vecino | null }>({
    prev: null,
    next: null,
  });
  const [error, setError] = useState<unknown>(null);

  const cargar = useCallback(async () => {
    try {
      const cap = await capituloIkigai(chapterId);
      if (cap.paginas.length === 0) throw new Error("Este capítulo no tiene páginas");
      setPaginas(cap.paginas);

      if (slug) {
        const ficha = await serieIkigai(slug).catch(() => null);
        const lista = ficha?.capitulos ?? [];
        const i = lista.findIndex((c) => c.id === chapterId);
        if (i >= 0) {
          const anterior = lista[i - 1];
          const siguiente = lista[i + 1];
          setVecinos({
            prev: anterior ? { id: Number(anterior.id), name: anterior.numero ?? "" } : null,
            next: siguiente ? { id: Number(siguiente.id), name: siguiente.numero ?? "" } : null,
          });
        }
      }
    } catch (err) {
      setError(err);
    }
  }, [chapterId, slug]);

  useEffect(() => {
    if (!ikigaiDisponible()) {
      setError(new Error(IKIGAI_NOMBRE + " solo está disponible en la app de Android o de Windows"));
      return;
    }
    cargar();
  }, [cargar]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <AvisoFuente
          error={error}
          volverA={slug ? "/externo/ikigai/" + slug : "/explorar"}
          volverTexto="Volver"
          onReintentar={cargar}
        />
      </div>
    );
  }

  if (!paginas) {
    return (
      <p className="py-24 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
        Cargando capítulo...
      </p>
    );
  }

  return (
    <OlympusReader
      chapter={{
        id: Number(chapterId),
        name: "",
        urlOriginal: "https://visorikigai.gettocaboca.com/capitulo/" + chapterId + "/",
      }}
      serie={{
        slug,
        tipo: "ikigai",
        urlOriginal: "https://visorikigai.gettocaboca.com/series/" + slug + "/",
      }}
      grupo={IKIGAI_NOMBRE}
      pages={paginas.map((url, i) => ({ pageNumber: i + 1, url, width: 0, height: 0 }))}
      prevChapter={vecinos.prev}
      nextChapter={vecinos.next}
      initialMode="cascade"
      initialPage={paginaInicial}
      source="ikigai"
      hrefVolver={"/externo/ikigai/" + slug}
      hrefCapitulo={(capId) => "/leer-externo/ikigai/" + capId + "?slug=" + slug}
    />
  );
}
