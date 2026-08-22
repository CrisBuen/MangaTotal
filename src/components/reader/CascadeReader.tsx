"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
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
  onPageVisible,
}: {
  pages: ReaderPage[];
  initialPage: number;
  nextChapter: ChapterLink | null;
  seriesSlug: string;
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
      el.scrollIntoView({ block: "start" });
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
    <div ref={containerRef} className="mx-auto flex max-w-3xl flex-col items-center">
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
          />
        </div>
      ))}

      <div className="flex w-full flex-col items-center gap-3 py-10">
        <p className="text-sm text-zinc-500">Fin del capítulo</p>
        {nextChapter ? (
          <Link
            href={`/leer/${nextChapter.id}`}
            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            Siguiente capítulo ({nextChapter.number}) →
          </Link>
        ) : (
          <Link
            href={`/serie/${seriesSlug}`}
            className="rounded-lg border border-zinc-700 px-5 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
          >
            Volver a la serie
          </Link>
        )}
      </div>
    </div>
  );
}
