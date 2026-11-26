"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AvisoFuente } from "@/components/fuentes/AvisoFuente";
import { OlympusReader } from "@/components/reader/OlympusReader";
import { cargarConCacheAndroid } from "@/lib/androidCache";
import {
  CW_NOMBRE,
  CW_WEB,
  imagenCw,
  paginasCw,
  serieCw,
  type CapituloCw,
  type FichaCw,
  type PaginaCw,
} from "@/lib/catharsis";

/**
 * Lector de Catharsis World.
 *
 * En la ruta va el capítulo y en la consulta la serie, porque los vecinos
 * (anterior y siguiente) salen de la lista de la serie.
 */
export default function LeerCwPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const params = useSearchParams();
  const serieId = params.get("serie") ?? "";

  const [paginas, setPaginas] = useState<PaginaCw[] | null>(null);
  const [ficha, setFicha] = useState<FichaCw | null>(null);
  const [capitulos, setCapitulos] = useState<CapituloCw[]>([]);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<unknown>(null);

  const cargar = useCallback(async () => {
    setError(null);
    setPaginas(null);
    try {
      // Cargamos primero la ficha (o en paralelo tolerando el fallo del visor)
      // para conservar siempre el enlace directo al capítulo oficial en Catharsis World.
      const [resCap, resFicha] = await Promise.allSettled([
        cargarConCacheAndroid(
          `capitulo:catharsis:v2:${id}`,
          () => paginasCw(id, false, serieId),
          {
            publicCache: true,
            freshForMs: 30 * 60 * 1000,
            maxAgeMs: 24 * 60 * 60 * 1000,
            onCached: (guardado) => setPaginas(guardado.paginas),
          }
        ),
        cargarConCacheAndroid<FichaCw>(
          `ficha:catharsis:${serieId}`,
          () => serieCw(serieId),
          {
            publicCache: true,
            freshForMs: 5 * 60 * 1000,
            maxAgeMs: 24 * 60 * 60 * 1000,
            onCached: (guardado) => {
              setFicha(guardado);
              setCapitulos(guardado.capitulos);
              setNombre(guardado.nombre);
            },
          }
        ),
      ]);

      if (resFicha.status === "fulfilled") {
        setFicha(resFicha.value);
        setCapitulos(resFicha.value.capitulos);
        setNombre(resFicha.value.nombre);
      }
      if (resCap.status === "rejected") {
        throw resCap.reason;
      }
      if (resFicha.status === "rejected") {
        throw resFicha.reason;
      }
      setPaginas(resCap.value.paginas);
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

  let donde = capitulos.findIndex((c) => c.id === id);
  if (donde === -1) {
    const numBuscado = id.includes("-cap-") ? parseFloat(id.split("-cap-")[1]) : parseFloat(id);
    if (Number.isFinite(numBuscado)) {
      donde = capitulos.findIndex((c) => c.numero === numBuscado);
    }
  }
  const anterior = donde > 0 ? capitulos[donde - 1] : null;
  const siguiente = donde >= 0 && donde < capitulos.length - 1 ? capitulos[donde + 1] : null;
  const actual = donde >= 0 ? capitulos[donde] : null;

  const numCapUrl =
    actual?.etiqueta ??
    (id.includes("-cap-") ? id.split("-cap-")[1] : null);
  const slugOIdOficial = ficha?.slug ?? (ficha?.v3Id ? String(ficha.v3Id) : null);
  const urlCapituloOficial =
    slugOIdOficial && numCapUrl
      ? `${CW_WEB}/manga/${slugOIdOficial}/chapter/${numCapUrl}`
      : slugOIdOficial
        ? `${CW_WEB}/manga/${slugOIdOficial}`
        : CW_WEB;

  if (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    const esBloqueoLector = /Turnstile|WebAssembly|pase de lectura/i.test(mensaje);
    if (esBloqueoLector) {
      return (
        <div className="mx-auto max-w-lg px-4 py-20">
          <div className="space-y-5 rounded-xl border border-line bg-panel p-6">
            <div className="space-y-1">
              <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-accent-ink">
                {CW_NOMBRE}
                {nombre ? ` · ${nombre}` : ""}
              </p>
              <h1 className="font-display text-2xl font-bold text-ink">
                {actual ? `Capítulo ${actual.etiqueta}` : "Visor protegido en Catharsis World"}
              </h1>
            </div>
            <p className="text-sm leading-6 text-subtle">{mensaje}</p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href={urlCapituloOficial}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-11 items-center rounded-md border border-accent bg-accent px-5 font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)]"
              >
                Abrir capítulo en {CW_NOMBRE} ↗
              </a>
              <Link
                href={volver}
                className="inline-flex min-h-11 items-center rounded-md border border-line px-4 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:border-line-strong hover:text-ink"
              >
                ← Volver a la ficha
              </Link>
              {serieId && (
                <Link
                  href={`/migrar?fuente=catharsis&id=${encodeURIComponent(serieId)}&slug=${encodeURIComponent(serieId)}&titulo=${encodeURIComponent(nombre || "")}`}
                  className="inline-flex min-h-11 items-center rounded-md border border-line px-4 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:border-line-strong hover:text-ink"
                >
                  Migrar obra
                </Link>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <AvisoFuente error={error} volverA={volver} volverTexto="Volver" onReintentar={cargar} />
      </div>
    );
  }

  if (!paginas) {
    return (
      <p className="py-24 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
        Cargando capítulo...
      </p>
    );
  }

  return (
    <OlympusReader
      key={id}
      chapter={{
        id,
        name: actual?.etiqueta ?? "",
        urlOriginal: urlCapituloOficial,
      }}
      serie={{
        slug: serieId,
        tipo: "catharsis",
        urlOriginal: slugOIdOficial ? `${CW_WEB}/manga/${slugOIdOficial}` : CW_WEB,
      }}
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
