"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OlympusReader } from "@/components/reader/OlympusReader";
import { Surface } from "@/components/ui/Surface";
import { TMO_NOMBRE, capituloTmo } from "@/lib/zonatmo";

type Capitulo = Awaited<ReturnType<typeof capituloTmo>>;

/**
 * Lector de ZonaTMO. Su API entrega el capítulo anterior y el siguiente junto
 * con las páginas, así que no hace falta releer la ficha de la serie.
 */
export default function LeerTmoPage(props: { params: Promise<{ id: string }> }) {
  const { id: slugCapitulo } = use(props.params);
  const params = useSearchParams();
  const tipo = params.get("tipo") ?? "manga";
  const serieId = params.get("id") ?? "";
  const slug = params.get("slug") ?? "";

  const [capitulo, setCapitulo] = useState<Capitulo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const cap = await capituloTmo(slug, slugCapitulo);
      if (cap.paginas.length === 0) throw new Error("Este capítulo no tiene páginas");
      setCapitulo(cap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el capítulo");
    }
  }, [slug, slugCapitulo]);

  useEffect(() => {
    if (!slug) {
      setError("Falta la serie de este capítulo. Abrilo desde su ficha.");
      return;
    }
    cargar();
  }, [cargar, slug]);

  const volver = serieId ? `/externo/tmo/${tipo}/${serieId}/${slug}` : "/explorar";

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <Surface className="p-10 text-center">
          <p className="text-lg font-bold text-ink">{error}</p>
          <Link href={volver} className="mt-4 inline-block text-sm text-accent hover:underline">
            Volver
          </Link>
        </Surface>
      </div>
    );
  }

  if (!capitulo) {
    return (
      <p className="py-24 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
        Cargando capítulo...
      </p>
    );
  }

  return (
    <OlympusReader
      chapter={{
        id: slugCapitulo,
        name: capitulo.numero ?? "",
        urlOriginal: capitulo.url_original,
      }}
      serie={{
        slug: `${tipo}/${serieId}/${slug}`,
        tipo: "tmo",
        urlOriginal: `${capitulo.url_original.split("/").slice(0, -2).join("/")}/`,
      }}
      grupo={TMO_NOMBRE}
      pages={capitulo.paginas.map((url, i) => ({
        pageNumber: i + 1,
        url,
        width: 0,
        height: 0,
      }))}
      prevChapter={
        capitulo.anterior
          ? { id: capitulo.anterior.id, name: capitulo.anterior.numero ?? "" }
          : null
      }
      nextChapter={
        capitulo.siguiente
          ? { id: capitulo.siguiente.id, name: capitulo.siguiente.numero ?? "" }
          : null
      }
      initialMode={capitulo.derechaAIzquierda ? "rtl" : "cascade"}
      initialPage={Number(params.get("page")) || 1}
      source="tmo"
      hrefVolver={volver}
      hrefCapitulo={(capId) => `/leer-externo/tmo/${capId}?tipo=${tipo}&id=${serieId}&slug=${slug}`}
    />
  );
}
