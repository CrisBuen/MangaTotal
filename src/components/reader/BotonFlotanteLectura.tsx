"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { capituloHref } from "@/lib/externas";
import { anotarHistorial } from "@/components/library/historial";
import { useProgresoSerie } from "@/components/library/useProgresoSerie";

export interface CapituloInfo {
  id: string | number;
  name?: string | number | null;
  number?: string | number | null;
  href?: string;
}

export interface BotonFlotanteLecturaProps {
  source: string;
  externalId: string;
  slug?: string | null;
  title: string;
  coverUrl?: string | null;
  type?: string | null;
  /** Capítulos disponibles para deducir el capítulo 1 o resolver el nombre del capítulo actual. */
  capitulos?: CapituloInfo[];
  /** Primer capítulo explícito si la vista ya lo tiene precalculado. */
  primerCapitulo?: CapituloInfo | null;
  /** Progreso explícito (para páginas del servidor como /serie/[slug] que ya traen su bookmark). */
  progresoManual?: {
    chapterId: string | number;
    chapterName?: string | number | null;
    chapterNumber?: string | number | null;
    pageNumber?: number | null;
    href?: string;
  } | null;
  /** Si la página aún está cargando datos de la serie o lista de capítulos. */
  cargando?: boolean;
  /** Función personalizada para armar el href si la fuente requiere parámetros especiales. */
  resolverHref?: (capituloId: string, pagina: number | null) => string;
}

function encontrarPrimerCapitulo(lista: CapituloInfo[]): CapituloInfo | null {
  if (!lista || lista.length === 0) return null;

  // 1. Coincidencia exacta con capítulo 1
  const cap1 = lista.find((c) => {
    const val = String(c.name ?? c.number ?? "").trim().toLowerCase();
    return val === "1" || val === "01" || val === "1.0" || val === "capítulo 1" || val === "cap. 1";
  });
  if (cap1) return cap1;

  // 2. Si no, el de menor número positivo
  let menor: { item: CapituloInfo; num: number } | null = null;
  for (const item of lista) {
    const raw = String(item.name ?? item.number ?? "").replace(/[^0-9.]/g, "");
    const num = parseFloat(raw);
    if (Number.isFinite(num) && num > 0) {
      if (!menor || num < menor.num) {
        menor = { item, num };
      }
    }
  }
  if (menor) return menor.item;

  // 3. Fallback: el primer elemento
  return lista[0];
}

function formatearSubtitulo(nombreCap: string, pagina: number | null | undefined, esInicio: boolean): string {
  if (esInicio) {
    if (!nombreCap || nombreCap === "1" || nombreCap === "01") return "Capítulo 1";
    if (nombreCap.toLowerCase().includes("completo")) return "Capítulo Completo";
    if (/^\d+(\.\d+)?$/.test(nombreCap)) return `Capítulo ${nombreCap}`;
    return nombreCap;
  }

  let prefijo = nombreCap;
  if (/^\d+(\.\d+)?$/.test(nombreCap)) {
    prefijo = `Cap. ${nombreCap}`;
  } else if (/^cap[íi]tulo\s+/i.test(nombreCap)) {
    prefijo = nombreCap.replace(/^cap[íi]tulo\s+/i, "Cap. ");
  } else if (nombreCap.toLowerCase().includes("completo")) {
    prefijo = "Cap. Completo";
  }

  const numPag = pagina && pagina > 0 ? pagina : 1;
  return `${prefijo} · Pág. ${numPag}`;
}

/**
 * Cuadro flotante en la esquina inferior derecha para continuar la lectura o
 * empezar desde el capítulo 1 en cualquier serie de cualquier fuente (actual o futura).
 *
 * Muestra "Continuar" + "Cap. X · Pág. Y" si ya se leyó, o "Empezar a leer" + "Capítulo 1" si no.
 */
export function BotonFlotanteLectura({
  source,
  externalId,
  slug,
  title,
  coverUrl,
  type,
  capitulos = [],
  primerCapitulo,
  progresoManual,
  cargando = false,
  resolverHref,
}: BotonFlotanteLecturaProps) {
  const esLocal = source === "local" || source === "mangatotal";

  const progresoAuto = useProgresoSerie(
    esLocal ? "" : source,
    esLocal ? "" : externalId
  );

  const progreso = progresoManual
    ? {
        ultimoId: String(progresoManual.chapterId),
        ultimoNombre: progresoManual.chapterName ? String(progresoManual.chapterName) : null,
        ultimoNumero: progresoManual.chapterNumber != null ? Number(progresoManual.chapterNumber) : null,
        ultimaPagina: progresoManual.pageNumber ?? null,
      }
    : progresoAuto;

  const tieneProgreso = Boolean(progreso.ultimoId);

  const primerCap = useMemo(() => {
    return primerCapitulo ?? encontrarPrimerCapitulo(capitulos);
  }, [primerCapitulo, capitulos]);

  // Si está cargando o aún no hay datos de capítulos ni progreso, no renderizamos
  if (cargando) return null;
  if (!tieneProgreso && !primerCap) return null;

  const targetId = tieneProgreso
    ? String(progreso.ultimoId)
    : String(primerCap!.id);

  const targetPage = tieneProgreso
    ? progreso.ultimaPagina && progreso.ultimaPagina > 0
      ? progreso.ultimaPagina
      : 1
    : 1;

  let targetName = "";
  if (tieneProgreso) {
    if (progreso.ultimoNombre) {
      targetName = progreso.ultimoNombre;
    } else if (progreso.ultimoNumero != null) {
      targetName = String(progreso.ultimoNumero);
    } else if (capitulos.length > 0) {
      const match = capitulos.find((c) => String(c.id) === targetId);
      targetName = String(match?.name ?? match?.number ?? targetId);
    } else {
      targetName = targetId;
    }
  } else {
    targetName = String(primerCap!.name ?? primerCap!.number ?? "1");
  }

  let targetHref = "";
  if (tieneProgreso && progresoManual?.href) {
    targetHref = progresoManual.href;
  } else if (!tieneProgreso && primerCap?.href) {
    targetHref = primerCap.href;
  } else if (resolverHref) {
    targetHref = resolverHref(targetId, targetPage);
  } else {
    targetHref = capituloHref(
      source,
      externalId,
      slug ?? null,
      type ?? null,
      targetId,
      targetPage,
      targetName
    );
  }

  const titulo = tieneProgreso ? "Continuar" : "Empezar a leer";
  const subtitulo = formatearSubtitulo(targetName, targetPage, !tieneProgreso);

  const handleClick = () => {
    if (!esLocal && title && externalId) {
      void anotarHistorial({
        source,
        external_id: externalId,
        slug: slug ?? null,
        title,
        cover_url: coverUrl ?? null,
        type: type ?? null,
        last_chapter_id: targetId,
        last_chapter_name: targetName,
        last_page_number: targetPage,
      });
    }
  };

  return (
    <Link
      href={targetHref}
      onClick={handleClick}
      aria-label={`${titulo}: ${subtitulo}`}
      className="group fixed right-3.5 sm:right-6 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 z-40 flex w-[172px] sm:w-[188px] items-center gap-2.5 rounded-xl border border-purple-500/40 bg-[#0d0f18]/95 p-2.5 shadow-2xl shadow-purple-950/60 backdrop-blur-md transition-all duration-200 hover:scale-[1.03] hover:border-purple-400 hover:shadow-purple-900/60 active:scale-[0.98]"
      data-od-id="boton-flotante-lectura"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-md shadow-purple-800/40 group-hover:from-purple-500 group-hover:to-indigo-400 transition-colors">
        {tieneProgreso ? (
          <svg className="h-4 w-4 fill-current ml-0.5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        ) : (
          <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1z" />
          </svg>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate font-display text-[12.5px] font-bold leading-tight text-ink group-hover:text-purple-300 transition-colors">
            {titulo}
          </p>
          <svg className="h-3.5 w-3.5 shrink-0 text-purple-400/80 group-hover:text-purple-300 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L10.94 10 7.23 6.29a.75.75 0 111.04-1.08l4.25 4.25a.75.75 0 010 1.08l-4.25 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="truncate font-mono text-[10.5px] font-medium leading-tight text-purple-300/80 mt-0.5" title={subtitulo}>
          {subtitulo}
        </p>
      </div>
    </Link>
  );
}
