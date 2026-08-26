"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { retryThroughProxy } from "./pageImage";
import type { ChapterLink, ReaderPage } from "./types";

/**
 * Modo Cascada (webtoon): scroll vertical continuo con lazy load por
 * IntersectionObserver y precarga de las páginas siguientes (docs/06 §6.2).
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
  const scrolledRef = useRef(false);

  // saltar a la página guardada al entrar
  useEffect(() => {
    if (scrolledRef.current || initialPage <= 1) return;
    const el = pageRefs.current.get(initialPage);
    if (el) {
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top });
      scrolledRef.current = true;
    }
  }, [initialPage]);

  // trackear qué página está en pantalla para guardar progreso
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const n = Number((entry.target as HTMLElement).dataset.page);
            if (n) onPageVisible(n);
          }
        }
      },
      { threshold: 0.25 }
    );
    pageRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
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
            // reserva el alto real de la página antes de cargar: sin saltos de scroll
            aspectRatio: p.width > 0 && p.height > 0 ? `${p.width} / ${p.height}` : undefined,
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
