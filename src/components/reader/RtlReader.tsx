"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import type { ChapterLink, ReaderPage } from "./types";

/**
 * Modo RTL paginado (manga tradicional): una página a la vez, navegación
 * invertida — mitad derecha / flecha izquierda = siguiente (docs/06 §6.3).
 */
export function RtlReader({
  pages,
  currentPage,
  onNavigate,
  nextChapter,
  prevChapter,
  seriesSlug,
}: {
  pages: ReaderPage[];
  currentPage: number;
  onNavigate: (pageNumber: number) => void;
  nextChapter: ChapterLink | null;
  prevChapter: ChapterLink | null;
  seriesSlug: string;
}) {
  const total = pages.length;
  const page = pages[currentPage - 1];
  const atEnd = currentPage >= total;

  const goNext = useCallback(() => {
    if (currentPage < total) onNavigate(currentPage + 1);
  }, [currentPage, total, onNavigate]);

  const goPrev = useCallback(() => {
    if (currentPage > 1) onNavigate(currentPage - 1);
  }, [currentPage, onNavigate]);

  // teclado invertido a propósito, como un manga físico:
  // ← siguiente · → anterior
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  // precarga la página actual + las 2 siguientes (transición instantánea)
  useEffect(() => {
    for (let i = currentPage; i < Math.min(currentPage + 2, total); i++) {
      const img = new Image();
      img.src = pages[i].url;
    }
  }, [currentPage, pages, total]);

  if (!page) return null;

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center" data-od-id="rtl-reader">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={page.pageNumber}
        src={page.url}
        alt={`Página ${page.pageNumber}`}
        className="max-h-[calc(100vh-5.5rem)] w-auto max-w-full select-none object-contain"
        draggable={false}
      />

      {/* zonas de click: derecha = siguiente, izquierda = anterior */}
      <button
        aria-label="Página siguiente"
        onClick={goNext}
        className="absolute inset-y-0 right-0 w-1/2 cursor-w-resize"
      />
      <button
        aria-label="Página anterior"
        onClick={goPrev}
        className="absolute inset-y-0 left-0 w-1/2 cursor-e-resize"
      />

      {atEnd && (
        <div className="absolute bottom-16 z-10 flex flex-col items-center gap-3 rounded-2xl border border-line bg-[color-mix(in_oklch,var(--bg)_90%,transparent)] px-6 py-5 shadow-2xl backdrop-blur-xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">Fin del capítulo</p>
          <div className="flex gap-2">
            {nextChapter && (
              <Link
                href={`/leer/${nextChapter.id}`}
                className="inline-flex min-h-11 items-center rounded-xl border border-accent bg-accent px-4 text-xs font-bold uppercase tracking-[0.08em] text-canvas shadow-[var(--glow)] transition hover:bg-[var(--accent-hover)]"
              >
                ← Capítulo {nextChapter.number}
              </Link>
            )}
            <Link
              href={`/serie/${seriesSlug}`}
              className="inline-flex min-h-11 items-center rounded-xl border border-line bg-panel px-4 text-xs font-bold uppercase tracking-[0.08em] text-ink transition hover:border-accent hover:bg-[var(--surface-raised)]"
            >
              Volver a la serie
            </Link>
          </div>
        </div>
      )}

      {currentPage === 1 && prevChapter && (
        <div className="absolute left-3 top-3 z-10">
          <Link
            href={`/leer/${prevChapter.id}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-line bg-[color-mix(in_oklch,var(--bg)_88%,transparent)] px-3 text-xs font-bold text-ink backdrop-blur-lg transition hover:border-accent hover:bg-panel"
          >
            Capítulo anterior ({prevChapter.number}) →
          </Link>
        </div>
      )}
    </div>
  );
}
