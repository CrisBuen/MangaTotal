"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OlympusReader } from "@/components/reader/OlympusReader";
import { Surface } from "@/components/ui/Surface";
import { TMO_NOMBRE, capituloTmo, serieTmo, tmoDisponible } from "@/lib/zonatmo";

interface Vecino {
  id: number;
  name: string;
}

/**
 * Lector de ZonaTMO. Todo ocurre en el dispositivo: las páginas se piden
 * desde la conexión de la persona, porque su servidor bloquea los centros
 * de datos.
 */
export default function LeerTmoPage(props: { params: Promise<{ id: string }> }) {
  const { id: chapterId } = use(props.params);
  const params = useSearchParams();
  const tipo = params.get("tipo") ?? "manga";
  const serieId = params.get("id") ?? "";
  const slug = params.get("slug") ?? "";

  const [paginas, setPaginas] = useState<string[] | null>(null);
  const [vecinos, setVecinos] = useState<{ prev: Vecino | null; next: Vecino | null }>({
    prev: null,
    next: null,
  });
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const cap = await capituloTmo(chapterId);
      if (cap.paginas.length === 0) throw new Error("Este capítulo no tiene páginas");
      setPaginas(cap.paginas);

      // capítulos vecinos, para encadenar la lectura
      if (serieId && slug) {
        const ficha = await serieTmo(tipo, serieId, slug).catch(() => null);
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
      setError(err instanceof Error ? err.message : "No se pudo cargar el capítulo");
    }
  }, [chapterId, tipo, serieId, slug]);

  useEffect(() => {
    if (!tmoDisponible()) {
      setError("ZonaTMO solo está disponible en la app de Android o de Windows");
      return;
    }
    cargar();
  }, [cargar]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <Surface className="p-10 text-center">
          <p className="text-lg font-bold text-ink">{error}</p>
          <Link
            href={serieId ? `/externo/tmo/${tipo}/${serieId}/${slug}` : "/explorar"}
            className="mt-4 inline-block text-sm text-accent hover:underline"
          >
            Volver
          </Link>
        </Surface>
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
        urlOriginal: `https://zonatmo.org/view_uploads/${chapterId}`,
      }}
      serie={{
        slug: `${tipo}/${serieId}/${slug}`,
        tipo: "tmo",
        urlOriginal: `https://zonatmo.org/library/${tipo}/${serieId}/${slug}`,
      }}
      grupo={TMO_NOMBRE}
      pages={paginas.map((url, i) => ({ pageNumber: i + 1, url, width: 0, height: 0 }))}
      prevChapter={vecinos.prev}
      nextChapter={vecinos.next}
      initialMode="cascade"
      source="tmo"
      hrefVolver={`/externo/tmo/${tipo}/${serieId}/${slug}`}
      hrefCapitulo={(capId) => `/leer-externo/tmo/${capId}?tipo=${tipo}&id=${serieId}&slug=${slug}`}
    />
  );
}
