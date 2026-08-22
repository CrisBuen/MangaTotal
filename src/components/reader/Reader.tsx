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
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current?.requestFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    function onChange() {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      setControlsVisible(!fs ? true : false);
    }
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
      className={`min-h-screen bg-zinc-950 text-zinc-100 ${
        isFullscreen ? "h-screen overflow-y-auto" : ""
      }`}
    >
      {/* barra superior del lector */}
      <header
        className={`sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur transition-opacity ${
          showBar ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2">
          <Link
            href={`/serie/${series.slug}`}
            className="shrink-0 rounded-lg px-2 py-1 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            ← Volver
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-medium">
              {series.title} — Cap. {chapter.number}
              {chapter.title ? `: ${chapter.title}` : ""}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {mode === "rtl" && (
              <span className="hidden text-xs text-zinc-500 sm:inline">
                página {currentPage} / {chapter.pageCount}
              </span>
            )}
            <div className="flex rounded-lg bg-zinc-900 p-0.5">
              <button
                onClick={() => changeMode("cascade")}
                title="Cascada (scroll vertical)"
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  mode === "cascade" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Cascada
              </button>
              <button
                onClick={() => changeMode("rtl")}
                title="Página a página, derecha → izquierda"
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  mode === "rtl" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                RTL
              </button>
            </div>
            <FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
          </div>
        </div>
      </header>

      {/* barra lateral fina de progreso (docs/06 §6.2) */}
      <div className="fixed right-0 top-0 z-40 h-full w-1 bg-zinc-900">
        <div
          className="w-full bg-violet-600 transition-[height] duration-300"
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
          className="fixed bottom-4 right-4 z-50 rounded-full border border-zinc-700 bg-zinc-900/90 px-4 py-2 text-sm text-zinc-200 shadow-lg"
        >
          Salir (Esc)
        </button>
      )}
    </div>
  );
}
