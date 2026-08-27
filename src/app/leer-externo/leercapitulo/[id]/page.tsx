"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OlympusReader } from "@/components/reader/OlympusReader";
import { Surface } from "@/components/ui/Surface";
import { LC_NOMBRE, paginasLc } from "@/lib/leercapitulo";

type Capitulo = Awaited<ReturnType<typeof paginasLc>>;

/**
 * Lector de LeerCapítulo. El identificador de la ruta es el número del
 * capítulo, que es como lo nombran ellos; la serie viaja en la consulta.
 */
export default function LeerLcPage(props: { params: Promise<{ id: string }> }) {
  const { id: numero } = use(props.params);
  const params = useSearchParams();
  const serieId = params.get("serie") ?? "";
  const slug = params.get("slug") ?? "";

  const [capitulo, setCapitulo] = useState<Capitulo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setCapitulo(await paginasLc(serieId, slug, numero));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el capítulo");
    }
  }, [serieId, slug, numero]);

  useEffect(() => {
    if (!serieId || !slug) {
      setError("Falta la serie de este capítulo. Abrilo desde su ficha.");
      return;
    }
    cargar();
  }, [cargar, serieId, slug]);

  const volver = serieId && slug ? `/externo/leercapitulo/${serieId}/${slug}` : "/explorar";

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

  const href = (n: number | string) =>
    `/leer-externo/leercapitulo/${n}?serie=${serieId}&slug=${slug}`;

  return (
    <OlympusReader
      chapter={{ id: numero, name: capitulo.numero, urlOriginal: capitulo.url_original }}
      serie={{
        slug: `${serieId}/${slug}`,
        tipo: "leercapitulo",
        urlOriginal: `https://www.leercapitulo.co/manga/${serieId}/${slug}/`,
      }}
      grupo={LC_NOMBRE}
      pages={capitulo.paginas.map((url, i) => ({
        pageNumber: i + 1,
        url,
        width: 0,
        height: 0,
      }))}
      prevChapter={capitulo.anterior ? { id: capitulo.anterior, name: capitulo.anterior } : null}
      nextChapter={capitulo.siguiente ? { id: capitulo.siguiente, name: capitulo.siguiente } : null}
      initialMode="cascade"
      initialPage={Number(params.get("page")) || 1}
      source="leercapitulo"
      hrefVolver={volver}
      hrefCapitulo={href}
    />
  );
}
