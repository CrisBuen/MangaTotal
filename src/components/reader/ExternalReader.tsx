"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CascadeReader } from "./CascadeReader";
import { FullscreenToggle } from "./FullscreenToggle";
import { RtlReader } from "./RtlReader";
import type { ReaderPage, ReadingMode } from "./types";

const CONTROLS_HIDE_MS = 2500;

interface ExternalChapterInfo {
  id: string;
  number: string | null;
  title: string | null;
  group: string | null;
}

/**
 * Lector de capítulos de MangaDex: misma experiencia que el lector propio
 * (cascada / RTL, pantalla completa, barra de progreso), pero las páginas
 * vienen de los servidores de MangaDex y no hay progreso persistido.
 */
interface ExternalChapterLink {
  id: string;
  number: string | null;
}

export function ExternalReader({
  chapter,
  seriesId,
  pages,
  prevChapter,
  nextChapter,
  initialMode,
}: {
  chapter: ExternalChapterInfo;
  seriesId: string | null;
  pages: ReaderPage[];
  prevChapter?: ExternalChapterLink | null;
  nextChapter?: ExternalChapterLink | null;
  initialMode: ReadingMode;
}) {
  const [mode, setMode] = useState<ReadingMode>(initialMode);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPageChange = useCallback((pageNumber: number) => setCurrentPage(pageNumber), []);

  const changeMode = useCallback((next: ReadingMode) => {
    setMode(next);
    fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferred_reading_mode: next }),
    }).catch(() => {});
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else containerRef.current?.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    function onChange() {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      setControlsVisible(!fs);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const revealControls = useCallback(() => {
    if (!isFullscreen) return;
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
  }, [isFullscreen]);

  const showBar = !isFullscreen || controlsVisible;
  const progressPct = pages.length > 0 ? (currentPage / pages.length) * 100 : 0;
  const backHref = seriesId ? `/externo/${seriesId}` : "/explorar";

  return (
    <div
      ref={containerRef}
      className={`min-h-screen bg-canvas text-ink ${isFullscreen ? "h-screen overflow-y-auto" : ""}`}
    >
      <header
        className={`sticky top-0 z-50 border-b border-line bg-[color-mix(in_oklch,var(--bg)_92%,transparent)] backdrop-blur transition-opacity ${
          showBar ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2">
          <Link
            href={backHref}
            className="shrink-0 rounded-lg px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-ink"
          >
            ← Volver
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-medium text-ink">
              Cap. {chapter.number ?? "?"}
              {chapter.title ? `: ${chapter.title}` : ""}
            </p>
            {chapter.group && (
              <p className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                {chapter.group} · MangaDex
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {mode === "rtl" && (
              <span className="hidden font-mono text-[10px] text-subtle sm:inline">
                {currentPage} / {pages.length}
              </span>
            )}
            <div className="flex rounded-lg border border-line bg-[var(--surface-raised)] p-0.5">
              {(["cascade", "rtl"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => changeMode(m)}
                  className={`rounded-md px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition ${
                    mode === m ? "bg-accent text-[var(--bg)]" : "text-subtle hover:text-ink"
                  }`}
                >
                  {m === "cascade" ? "Cascada" : "RTL"}
                </button>
              ))}
            </div>
            <FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
          </div>
        </div>
      </header>

      <div className="fixed right-0 top-0 z-40 h-full w-1 bg-[var(--surface-raised)]">
        <div
          className="w-full bg-accent transition-[height] duration-300"
          style={{ height: `${progressPct}%` }}
        />
      </div>

      <div onClick={revealControls}>
        {mode === "cascade" ? (
          <CascadeReader
            pages={pages}
            initialPage={1}
            nextChapter={null}
            seriesSlug=""
            seriesHref={backHref}
            onPageVisible={onPageChange}
          />
        ) : (
          <RtlReader
            pages={pages}
            currentPage={currentPage}
            onNavigate={onPageChange}
            nextChapter={null}
            prevChapter={null}
            seriesSlug=""
            seriesHref={backHref}
          />
        )}
      </div>

      {/* navegación entre capítulos: siempre a una versión legible */}
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3 px-4 pb-12 pt-2">
        {prevChapter && (
          <Link
            href={`/leer-externo/${prevChapter.id}`}
            className="rounded-xl border border-line bg-panel px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink transition hover:border-accent"
          >
            ← Capítulo {prevChapter.number ?? "anterior"}
          </Link>
        )}
        <Link
          href={backHref}
          className="rounded-xl border border-line px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-subtle transition hover:border-accent hover:text-ink"
        >
          Ver capítulos
        </Link>
        {nextChapter && (
          <Link
            href={`/leer-externo/${nextChapter.id}`}
            className="rounded-xl border border-accent bg-accent px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--bg)] transition hover:opacity-90"
          >
            Capítulo {nextChapter.number ?? "siguiente"} →
          </Link>
        )}
      </div>

      {isFullscreen && controlsVisible && (
        <button
          onClick={toggleFullscreen}
          className="fixed bottom-4 right-4 z-50 rounded-full border border-line bg-[var(--surface-raised)] px-4 py-2 text-sm text-ink shadow-lg"
        >
          Salir (Esc)
        </button>
      )}
    </div>
  );
}
