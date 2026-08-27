"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AvisoFuente } from "@/components/fuentes/AvisoFuente";
import { OlympusReader } from "@/components/reader/OlympusReader";
import {
  CW_NOMBRE,
  CW_WEB,
  imagenCw,
  paginasCw,
  serieCw,
  type CapituloCw,
  type PaginaCw,
} from "@/lib/catharsis";

/**
 * Lector de Catharsis World.
 *
 * En la ruta va el capítulo y en la consulta la serie, porque los vecinos
 * (anterior y siguiente) salen de la lista de la serie. Las dos cosas se
 * piden a la vez: son independientes y así se abre en un viaje.
 */
export default function LeerCwPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const params = useSearchParams();
  const serieId = params.get("serie") ?? "";

  const [paginas, setPaginas] = useState<PaginaCw[] | null>(null);
  const [capitulos, setCapitulos] = useState<CapituloCw[]>([]);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<unknown>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [capitulo, ficha] = await Promise.all([paginasCw(id), serieCw(serieId)]);
      setPaginas(capitulo.paginas);
      setCapitulos(ficha.capitulos);
      setNombre(ficha.nombre);
    } catch (err) {
      setError(err);
    }
  }, [id, serieId]);

  useEffect(() => {
    if (!serieId) {
      setError(new Error("Falta la serie de este capítulo. Abrilo desde su ficha."));
      return;
    }
    cargar();
  }, [cargar, serieId]);

  const volver = serieId ? `/externo/catharsis/${serieId}` : "/explorar";

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <AvisoFuente error={error} volverA={volver} volverTexto="Volver" onReintentar={cargar} />
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

  const donde = capitulos.findIndex((c) => c.id === id);
  const anterior = donde > 0 ? capitulos[donde - 1] : null;
  const siguiente = donde >= 0 && donde < capitulos.length - 1 ? capitulos[donde + 1] : null;
  const actual = donde >= 0 ? capitulos[donde] : null;

  return (
    <OlympusReader
      chapter={{
        id,
        name: actual?.etiqueta ?? "",
        urlOriginal: CW_WEB,
      }}
      serie={{ slug: serieId, tipo: "catharsis", urlOriginal: CW_WEB }}
      grupo={nombre ? `${CW_NOMBRE} · ${nombre}` : CW_NOMBRE}
      pages={paginas.map((p) => ({
        pageNumber: p.numero,
        url: imagenCw(p.id),
        // Catharsis sí informa el tamaño real de cada página: el lector puede
        // reservarle el hueco exacto antes de que cargue, así no salta el
        // scroll ni se pierde por dónde ibas
        width: p.ancho,
        height: p.alto,
      }))}
      prevChapter={anterior ? { id: anterior.id, name: anterior.etiqueta } : null}
      nextChapter={siguiente ? { id: siguiente.id, name: siguiente.etiqueta } : null}
      initialMode="cascade"
      initialPage={Number(params.get("page")) || 1}
      source="catharsis"
      hrefVolver={volver}
      hrefCapitulo={(capId) => `/leer-externo/catharsis/${capId}?serie=${serieId}`}
    />
  );
}
