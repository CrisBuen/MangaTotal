"use client";

import { AvisoFuente } from "@/components/fuentes/AvisoFuente";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OlympusReader } from "@/components/reader/OlympusReader";
import { IKIGAI_NOMBRE, IKIGAI_WEB, ikigaiDisponible, lecturaIkigai } from "@/lib/ikigai";

/** Lector de Ikigai Mangas: las páginas se piden desde el dispositivo. */
export default function LeerIkigaiPage(props: { params: Promise<{ id: string }> }) {
  const { id: chapterId } = use(props.params);
  const params = useSearchParams();
  const slug = params.get("slug") ?? "";
  const paginaInicial = Number(params.get("page")) || 1;

  const [lectura, setLectura] = useState<Awaited<ReturnType<typeof lecturaIkigai>> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const solicitud = useRef(0);

  const cargar = useCallback(async () => {
    const actual = ++solicitud.current;
    setError(null);
    setLectura(null);
    try {
      if (!ikigaiDisponible()) {
        throw new Error(IKIGAI_NOMBRE + " solo está disponible en la app de Android o de Windows");
      }
      const resultado = await lecturaIkigai(chapterId, slug);
      if (actual === solicitud.current) setLectura(resultado);
    } catch (err) {
      if (actual === solicitud.current) setError(err);
    }
  }, [chapterId, slug]);

  useEffect(() => {
    cargar();
    // Una respuesta vieja no debe reemplazar al capítulo al que ya se pasó.
    return () => { solicitud.current++; };
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

  if (!lectura) {
    return (
      <p className="py-24 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
        Cargando capítulo...
      </p>
    );
  }

  const { cap, ficha } = lectura;
  const lista = ficha?.capitulos ?? [];
  const indice = lista.findIndex((c) => c.id === cap.id);
  const anterior = indice >= 0 ? lista[indice - 1] : null;
  const siguiente = indice >= 0 ? lista[indice + 1] : null;
  const numeroCapitulo = lista[indice]?.numero ?? cap.id;

  return (
    <OlympusReader
      key={cap.id}
      chapter={{
        id: cap.id,
        // Nunca se manda vacío: el progreso usa este valor para decidir si
        // la serie ya empezó y debe aparecer en «Continuar leyendo».
        name: numeroCapitulo,
        urlOriginal: cap.url_original,
      }}
      serie={{
        slug,
        tipo: "ikigai",
        urlOriginal: IKIGAI_WEB + "/series/" + slug + "/",
      }}
      grupo={IKIGAI_NOMBRE}
      pages={cap.paginas.map((url, i) => ({ pageNumber: i + 1, url, width: 0, height: 0 }))}
      prevChapter={anterior ? { id: anterior.id, name: anterior.numero ?? "" } : null}
      nextChapter={siguiente ? { id: siguiente.id, name: siguiente.numero ?? "" } : null}
      initialMode="cascade"
      initialPage={paginaInicial}
      source="ikigai"
      hrefVolver={"/externo/ikigai/" + slug}
      hrefCapitulo={(capId) => "/leer-externo/ikigai/" + capId + "?slug=" + slug}
    />
  );
}
