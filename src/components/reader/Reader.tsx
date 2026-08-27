"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CascadeReader } from "./CascadeReader";
import { FullscreenToggle } from "./FullscreenToggle";
import { RtlReader } from "./RtlReader";
import type { ChapterLink, ReaderChapter, ReaderPage, ReadingMode } from "./types";

const CONTROLS_HIDE_MS = 2500;
const PROGRESS_SAVE_MS = 1500;

export function Reader({
  chapter,
  series,
  pages,
  prevChapter,
  nextChapter,
  initialPage,
  initialMode,
}: {
  chapter: ReaderChapter;
  series: { title: string; slug: string };
  pages: ReaderPage[];
  prevChapter: ChapterLink | null;
  nextChapter: ChapterLink | null;
  initialPage: number;
  initialMode: ReadingMode;
}) {
  const [mode, setMode] = useState<ReadingMode>(initialMode);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(0);
  const currentPageRef = useRef(initialPage);

  // ── progreso: PATCH /api/progress con debounce ─────────────────────────
  const saveProgress = useCallback(
    (pageNumber: number) => {
      if (pageNumber === lastSavedRef.current) return;
      lastSavedRef.current = pageNumber;
      fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: chapter.id, pageNumber }),
        keepalive: true,
      }).catch(() => {});
    },
    [chapter.id]
  );

  const onPageChange = useCallback(
    (pageNumber: number) => {
      setCurrentPage(pageNumber);
      currentPageRef.current = pageNumber;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveProgress(pageNumber), PROGRESS_SAVE_MS);
    },
    [saveProgress]
  );

  // guardar al salir/desmontar
  useEffect(() => {
    const flush = () => saveProgress(currentPageRef.current);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [saveProgress]);

  // ── modo de lectura: cambiarlo lo recuerda como preferencia ────────────
  const changeMode = useCallback((next: ReadingMode) => {
    setMode(next);
    fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferred_reading_mode: next }),
    }).catch(() => {});
  }, []);

  // ── pantalla completa ──────────────────────────────────────────────────
  // pantalla completa sobre el documento, no sobre este contenedor: así
  // sobrevive al pasar de capítulo (el contenedor se desmonta, el documento no)
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    function onChange() {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      setControlsVisible(!fs ? true : false);
    }
    // al entrar ya en pantalla completa (venimos del capítulo anterior)
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // en pantalla completa: tap en el centro muestra controles unos segundos
  const revealControls = useCallback(() => {
    if (!isFullscreen) return;
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
  }, [isFullscreen]);

  const showBar = !isFullscreen || controlsVisible;
  const progressPct = chapter.pageCount > 0 ? (currentPage / chapter.pageCount) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-canvas text-ink"
      data-od-id="reader-shell"
    >
      {/* barra superior del lector */}
      <header
        className={`sticky top-0 z-50 border-b border-line bg-[color-mix(in_oklch,var(--bg)_88%,transparent)] backdrop-blur-xl transition-opacity ${
          showBar ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-3 py-2 sm:px-5"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          <Link
            href={`/serie/${series.slug}`}
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-xs font-bold uppercase tracking-[0.08em] text-subtle transition hover:bg-[var(--surface-raised)] hover:text-ink"
            data-od-id="reader-back-link"
          >
            ← Volver
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-display text-lg font-bold leading-tight text-ink">
              {series.title} — Cap. {chapter.number}
              {chapter.title ? `: ${chapter.title}` : ""}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2" data-od-id="reader-controls">
            {mode === "rtl" && (
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.08em] text-subtle sm:inline">
                página {currentPage} / {chapter.pageCount}
              </span>
            )}
            <div className="flex rounded-xl border border-line bg-panel p-1">
              <button
                onClick={() => changeMode("cascade")}
                title="Cascada (scroll vertical)"
                className={`min-h-11 px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] transition ${
                  mode === "cascade" ? "rounded-lg bg-accent text-canvas shadow-[var(--glow)]" : "rounded-lg text-subtle hover:bg-[var(--surface-raised)] hover:text-ink"
                }`}
                aria-pressed={mode === "cascade"}
              >
                Cascada
              </button>
              <button
                onClick={() => changeMode("rtl")}
                title="Página a página, derecha → izquierda"
                className={`min-h-11 px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] transition ${
                  mode === "rtl" ? "rounded-lg bg-accent text-canvas shadow-[var(--glow)]" : "rounded-lg text-subtle hover:bg-[var(--surface-raised)] hover:text-ink"
                }`}
                aria-pressed={mode === "rtl"}
              >
                RTL
              </button>
            </div>
            <FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
          </div>
        </div>
      </header>

      {/* barra lateral fina de progreso (docs/06 §6.2) */}
      <div className="fixed right-0 top-0 z-40 h-full w-1 bg-[var(--surface-raised)]" aria-hidden="true">
        <div
          className="w-full bg-accent transition-[height] duration-300"
          style={{ height: `${progressPct}%` }}
        />
      </div>

      {/* zona central: en fullscreen, tap revela controles */}
      <div onClick={revealControls}>
        {mode === "cascade" ? (
          <CascadeReader
            pages={pages}
            initialPage={initialPage}
            nextChapter={nextChapter}
            seriesSlug={series.slug}
            onPageVisible={onPageChange}
          />
        ) : (
          <RtlReader
            pages={pages}
            currentPage={currentPage}
            onNavigate={onPageChange}
            nextChapter={nextChapter}
            prevChapter={prevChapter}
            seriesSlug={series.slug}
          />
        )}
      </div>

      {/* botón flotante para salir de pantalla completa */}
      {isFullscreen && controlsVisible && (
        <button
          onClick={toggleFullscreen}
          className="fixed right-4 z-50 min-h-11 rounded-xl border border-line bg-panel px-4 text-xs font-bold uppercase tracking-[0.08em] text-ink shadow-xl transition hover:border-accent hover:bg-[var(--surface-raised)]"
          style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
          data-od-id="exit-fullscreen-button"
        >
          Salir (Esc)
        </button>
      )}
    </div>
  );
}
