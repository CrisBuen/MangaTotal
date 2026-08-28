"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { retryThroughProxy } from "./pageImage";
import type { ChapterLink, ReaderPage } from "./types";

/** Cuánto insistir con el salto a la página guardada antes de rendirse. */
const REINTENTO_MS = 12000;

/**
 * Proporción del hueco de una página cuando todavía no se sabe nada: ni la
 * fuente la informa ni cargó ninguna imagen del capítulo.
 */
const PROPORCION_INICIAL = "2 / 3";

/**
 * Modo Cascada (webtoon): scroll vertical continuo con lazy load y precarga
 * de las páginas siguientes.
 *
 * Las fuentes externas no informan el tamaño de sus imágenes, así que hasta
 * que cada una carga su recuadro mide cero. Por eso acá no se confía en la
 * posición de los elementos hasta que tienen alto real: ni para saltar a la
 * página guardada, ni para saber por cuál se va.
 *
 * En cuanto una imagen carga se anota su medida real y el hueco pasa a ser
 * exacto. Antes se le sacaba el estilo al recuadro a mano, y eso se rompía
 * feo con las tiras de webtoon: una tira de 1000x14000 metida en un hueco de
 * proporción 2:3 se desborda quince veces su alto y se pisa con las de abajo,
 * que es lo que se veía como páginas mal cortadas.
 */
export function CascadeReader({
  pages,
  initialPage,
  nextChapter,
  seriesSlug,
  seriesHref,
  onPageVisible,
}: {
  pages: ReaderPage[];
  initialPage: number;
  nextChapter: ChapterLink | null;
  seriesSlug: string;
  /** Destino del botón "Volver": series externas no tienen slug propio. */
  seriesHref?: string;
  onPageVisible: (pageNumber: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // medida real de cada página, en cuanto su imagen la revela
  const [medidas, setMedidas] = useState<Record<number, string>>({});

  const anotarMedida = useCallback((pageNumber: number, img: HTMLImageElement) => {
    const { naturalWidth: ancho, naturalHeight: alto } = img;
    if (!ancho || !alto) return;
    setMedidas((previas) =>
      previas[pageNumber] ? previas : { ...previas, [pageNumber]: `${ancho} / ${alto}` }
    );
  }, []);

  /**
   * La proporción de la primera página que cargó, como molde para las que
   * todavía no.
   *
   * Las páginas de un mismo capítulo se parecen entre sí, así que una tira de
   * webtoon deja de reservarse un hueco de página de manga. No cuesta un
   * pedido más y se acomoda solo a cada capítulo.
   *
   * Se deriva de las medidas en vez de guardarse aparte: si fuera su propio
   * estado, el ref de cada imagen lo pisaría en cada render y entrarían en un
   * ciclo de renders sin fin.
   */
  const proporcionTipica = useMemo(() => {
    const paginas = Object.keys(medidas);
    return paginas.length > 0 ? medidas[Number(paginas[0])] : null;
  }, [medidas]);

  // mientras se acomoda en la página guardada no se reporta el avance, o se
  // guardaría una página cualquiera del camino
  const restaurando = useRef(initialPage > 1);
  const objetivo = useRef(initialPage);

  const terminarRestauracion = useCallback(() => {
    restaurando.current = false;
  }, []);

  /** Lleva el scroll a la página guardada, si ya se puede saber dónde está. */
  const irAlObjetivo = useCallback(() => {
    if (!restaurando.current) return;
    const el = pageRefs.current.get(objetivo.current);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    // sin alto real todavía no sabe dónde está: se reintenta más tarde
    if (rect.height < 40) return;

    const destino = rect.top + window.scrollY;
    if (destino <= 0) return;
    window.scrollTo({ top: destino });
  }, []);

  // Salto a la página guardada. Se insiste mientras van cargando las
  // imágenes de arriba, porque cada una que carga corre el resto hacia abajo.
  useEffect(() => {
    if (!restaurando.current) return;

    const desde = Date.now();
    const t = setInterval(() => {
      if (!restaurando.current || Date.now() - desde > REINTENTO_MS) {
        clearInterval(t);
        terminarRestauracion();
        return;
      }
      irAlObjetivo();
    }, 250);

    return () => clearInterval(t);
  }, [irAlObjetivo, terminarRestauracion]);

  // si la persona toca el scroll, se deja de pelear con ella
  useEffect(() => {
    if (!restaurando.current) return;
    const soltar = () => terminarRestauracion();
    window.addEventListener("wheel", soltar, { passive: true });
    window.addEventListener("touchmove", soltar, { passive: true });
    window.addEventListener("keydown", soltar);
    return () => {
      window.removeEventListener("wheel", soltar);
      window.removeEventListener("touchmove", soltar);
      window.removeEventListener("keydown", soltar);
    };
  }, [terminarRestauracion]);

  /**
   * Qué página se está viendo: la última cuyo borde superior ya pasó por el
   * tercio alto de la pantalla. Se calcula mirando las posiciones reales en
   * vez de escuchar intersecciones, que con recuadros de alto cero se
   * disparan todas juntas y dejan la última página como "actual".
   */
  useEffect(() => {
    let pendiente = false;

    const calcular = () => {
      pendiente = false;
      if (restaurando.current) return;

      const corte = window.innerHeight * 0.35;
      let actual = 0;
      for (const [n, el] of pageRefs.current) {
        const r = el.getBoundingClientRect();
        if (r.height < 40) continue; // todavía sin cargar: no cuenta
        if (r.top <= corte) actual = Math.max(actual, n);
      }
      if (actual > 0) onPageVisible(actual);
    };

    const alMover = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(calcular);
    };

    window.addEventListener("scroll", alMover, { passive: true });
    window.addEventListener("resize", alMover);
    alMover();
    return () => {
      window.removeEventListener("scroll", alMover);
      window.removeEventListener("resize", alMover);
    };
  }, [onPageVisible, pages.length]);

  return (
    <div ref={containerRef} className="mx-auto flex max-w-3xl flex-col items-center" data-od-id="cascade-reader">
      {pages.map((p, i) => (
        <div
          key={p.pageNumber}
          data-page={p.pageNumber}
          ref={(el) => {
            if (el) pageRefs.current.set(p.pageNumber, el);
            else pageRefs.current.delete(p.pageNumber);
          }}
          className="w-full"
          style={{
            // el hueco que ocupa la página antes de cargar, para que el scroll
            // no salte. Vale la medida que ya reveló su imagen; si todavía no
            // cargó, la que informa la fuente; y si tampoco, la del capítulo.
            aspectRatio:
              medidas[p.pageNumber] ??
              (p.width > 0 && p.height > 0
                ? `${p.width} / ${p.height}`
                : (proporcionTipica ?? PROPORCION_INICIAL)),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.url}
            alt={`Página ${p.pageNumber}`}
            className="block h-auto w-full select-none"
            // primeras páginas y las cercanas al punto de entrada: carga inmediata;
            // el resto lazy (el navegador precarga con margen las que vienen)
            loading={Math.abs(i + 1 - initialPage) <= 3 ? "eager" : "lazy"}
            draggable={false}
            referrerPolicy="no-referrer"
            ref={(img) => {
              // una imagen que ya estaba en la caché puede llegar cargada, y
              // entonces onLoad no se dispara nunca
              if (img?.complete) anotarMedida(p.pageNumber, img);
            }}
            onLoad={(e) => {
              // al cargar, el recuadro toma su alto real y corre lo de abajo:
              // hay que volver a apuntar al objetivo
              anotarMedida(p.pageNumber, e.currentTarget);
              irAlObjetivo();
            }}
            onError={(e) => retryThroughProxy(e.currentTarget)}
          />
        </div>
      ))}

      <div className="flex w-full flex-col items-center gap-4 border-t border-line py-12">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">Fin del capítulo</p>
        {nextChapter ? (
          <Link
            href={`/leer/${nextChapter.id}`}
            data-next-chapter
            className="inline-flex min-h-11 items-center rounded-xl border border-accent bg-accent px-5 text-xs font-bold uppercase tracking-[0.08em] text-canvas shadow-[var(--glow)] transition hover:bg-[var(--accent-hover)]"
          >
            Siguiente capítulo ({nextChapter.number}) →
          </Link>
        ) : (
          <Link
            href={seriesHref ?? `/serie/${seriesSlug}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-line bg-panel px-5 text-xs font-bold uppercase tracking-[0.08em] text-ink transition hover:border-accent hover:bg-[var(--surface-raised)]"
          >
            Volver a la serie
          </Link>
        )}
      </div>
    </div>
  );
}
