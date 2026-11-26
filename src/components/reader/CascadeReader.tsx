"use client";

import { BotonVolver } from "./BotonVolver";
import { ImagenFuente } from "@/components/fuentes/ImagenFuente";
import { EnlaceCapitulo } from "./EnlaceCapitulo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  guardarPosicionLector,
  leerPosicionLector,
  registrarFlusherProgreso,
} from "@/lib/navegacionEstado";
import { retryThroughProxy } from "./pageImage";
import type { ChapterLink, ReaderPage } from "./types";

/** Cuánto insistir con el salto a la página guardada antes de rendirse. */
const REINTENTO_MS = 8000;

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
  progressKey,
  headerOffset = 56,
}: {
  pages: ReaderPage[];
  initialPage: number;
  nextChapter: ChapterLink | null;
  seriesSlug: string;
  /** Destino del botón "Volver": series externas no tienen slug propio. */
  seriesHref?: string;
  onPageVisible: (pageNumber: number) => void;
  /** Clave local del capítulo para recordar también el desplazamiento vertical sub-página. */
  progressKey?: string;
  /** Altura estimada de la barra superior fija para alinear el desplazamiento al restaurar. */
  headerOffset?: number;
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

  const posGuardadaInicial = useMemo(
    () => (progressKey ? leerPosicionLector(progressKey) : null),
    [progressKey]
  );
  const ratioInicial =
    posGuardadaInicial && posGuardadaInicial.page === initialPage
      ? Math.min(0.96, Math.max(0, posGuardadaInicial.ratio ?? 0))
      : 0;

  // mientras se acomoda en la página guardada no se reporta el avance, o se
  // guardaría una página cualquiera del camino
  const restaurando = useRef(initialPage > 1 || ratioInicial > 0.01);
  const objetivo = useRef(initialPage);
  const ratioObjetivo = useRef(ratioInicial);
  const onPageVisibleRef = useRef(onPageVisible);
  onPageVisibleRef.current = onPageVisible;

  const terminarRestauracion = useCallback(() => {
    restaurando.current = false;
  }, []);

  /** Lleva el scroll a la página (y fracción interna) guardada, si ya se puede saber dónde está. */
  const irAlObjetivo = useCallback(() => {
    if (!restaurando.current) return;
    const el = pageRefs.current.get(objetivo.current);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    // sin alto real todavía no sabe dónde está: se reintenta más tarde
    if (rect.height < 40) return;

    const extraPx = ratioObjetivo.current * rect.height;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const calculado = rect.top + window.scrollY - headerOffset + extraPx;
    const destino = Math.min(maxScroll, Math.max(0, calculado));
    if (destino <= 0 && ratioObjetivo.current <= 0.01) return;
    window.scrollTo({ top: destino, behavior: "instant" as ScrollBehavior });
  }, [headerOffset]);

  // Salto inicial e insistencia mientras cargan las imágenes superiores (también reacciona
  // a cambios de medidas / proporcionTipica en tiras largas de webtoon).
  useEffect(() => {
    if (!restaurando.current) return;

    const raf = requestAnimationFrame(() => irAlObjetivo());
    const desde = Date.now();
    const t = setInterval(() => {
      if (!restaurando.current || Date.now() - desde > REINTENTO_MS) {
        clearInterval(t);
        terminarRestauracion();
        return;
      }
      irAlObjetivo();
    }, 250);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(t);
    };
  }, [irAlObjetivo, terminarRestauracion]);

  useEffect(() => {
    if (!restaurando.current) return;
    irAlObjetivo();
  }, [medidas, proporcionTipica, irAlObjetivo]);

  // si la persona toca el scroll, se deja de pelear con ella
  useEffect(() => {
    if (!restaurando.current) return;
    const soltar = () => terminarRestauracion();
    window.addEventListener("pointerdown", soltar, { passive: true });
    window.addEventListener("wheel", soltar, { passive: true });
    window.addEventListener("touchmove", soltar, { passive: true });
    window.addEventListener("keydown", soltar);
    return () => {
      window.removeEventListener("pointerdown", soltar);
      window.removeEventListener("wheel", soltar);
      window.removeEventListener("touchmove", soltar);
      window.removeEventListener("keydown", soltar);
    };
  }, [terminarRestauracion]);

  /**
   * Qué página se está viendo: la última cuyo borde superior ya pasó por el
   * tercio alto de la pantalla. Además calcula la fracción vertical recorrida
   * dentro de esa página para reanudar exactamente en el mismo cuadro en tiras
   * largas de webtoon.
   */
  useEffect(() => {
    let pendiente = false;
    let haScrolleado = false;
    let ultimoGuardadoTs = 0;
    let timerGuardado: ReturnType<typeof setTimeout> | null = null;

    const medirPosicion = (): { page: number; ratio: number } | null => {
      const corte = window.innerHeight * 0.35;
      let actual = 0;
      let rectActual: DOMRect | null = null;
      for (const [n, el] of pageRefs.current) {
        const r = el.getBoundingClientRect();
        if (r.height < 40) continue; // todavía sin cargar: no cuenta
        if (r.top <= corte && n >= actual) {
          actual = n;
          rectActual = r;
        }
      }
      if (actual <= 0 || !rectActual) return null;
      const ratio = Math.min(0.96, Math.max(0, (headerOffset - rectActual.top) / rectActual.height));
      return { page: actual, ratio };
    };

    const persistirSubpagina = () => {
      if (restaurando.current || !progressKey) return;
      // Evita que un montaje inicial transitorio en y<=10 (antes de que el lector padre
      // remonte CascadeReader en la página reanudada) pise el progreso guardado con page=1, ratio=0.
      if (!haScrolleado && window.scrollY <= 10) return;
      const medido = medirPosicion();
      if (!medido) return;
      ultimoGuardadoTs = Date.now();
      guardarPosicionLector(progressKey, { page: medido.page, ratio: medido.ratio });
    };

    const calcular = (desdeScrollReal: boolean) => {
      pendiente = false;
      if (restaurando.current) return;
      const medido = medirPosicion();
      if (!medido) return;
      onPageVisibleRef.current(medido.page);

      if (progressKey && (desdeScrollReal || haScrolleado || window.scrollY > 10)) {
        const ahora = Date.now();
        if (ahora - ultimoGuardadoTs >= 300) {
          persistirSubpagina();
        } else {
          if (timerGuardado) clearTimeout(timerGuardado);
          timerGuardado = setTimeout(persistirSubpagina, 300);
        }
      }
    };

    const alMover = (evento?: Event) => {
      if (evento?.type === "scroll" && !restaurando.current) {
        if (window.scrollY > 0 || haScrolleado) {
          haScrolleado = true;
        }
      }
      if (pendiente) return;
      pendiente = true;
      const desdeScroll = evento?.type === "scroll";
      requestAnimationFrame(() => calcular(desdeScroll));
    };

    const alOcultar = () => {
      if (document.visibilityState === "hidden") persistirSubpagina();
    };

    const quitarFlusher = registrarFlusherProgreso(persistirSubpagina);
    window.addEventListener("scroll", alMover, { passive: true });
    window.addEventListener("resize", alMover);
    document.addEventListener("visibilitychange", alOcultar);
    window.addEventListener("pagehide", persistirSubpagina);
    alMover();
    return () => {
      persistirSubpagina();
      quitarFlusher();
      if (timerGuardado) clearTimeout(timerGuardado);
      window.removeEventListener("scroll", alMover);
      window.removeEventListener("resize", alMover);
      document.removeEventListener("visibilitychange", alOcultar);
      window.removeEventListener("pagehide", persistirSubpagina);
    };
  }, [pages.length, progressKey, headerOffset]);

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
          <ImagenFuente
            src={p.url}
            alt={`Página ${p.pageNumber}`}
            className="block h-auto w-full select-none"
            // la página actual y la siguiente inmediata se cargan con prioridad;
            // el resto en lazy para no saturar el ancho de banda en señal móvil débil (H+/3G)
            loading={i + 1 === initialPage || i === initialPage ? "eager" : "lazy"}
            fetchPriority={i + 1 === initialPage ? "high" : i === initialPage ? "auto" : "low"}
            decoding="async"
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
        <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">Fin del capítulo</p>
        {nextChapter ? (
          <EnlaceCapitulo
            href={`/leer/${nextChapter.id}`}
            data-next-chapter
            className="inline-flex min-h-11 items-center rounded-md border border-accent bg-accent px-5 text-[13px] font-bold tracking-[0.08em] text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            Siguiente capítulo ({nextChapter.number}) →
          </EnlaceCapitulo>
        ) : (
          <BotonVolver
            href={seriesHref ?? `/serie/${seriesSlug}`}
            className="inline-flex min-h-11 items-center rounded-md border border-line bg-panel px-5 text-[13px] font-bold tracking-[0.08em] text-ink transition hover:border-line-strong hover:bg-[var(--surface-raised)]"
          >
            Volver a la serie
          </BotonVolver>
        )}
      </div>
    </div>
  );
}
