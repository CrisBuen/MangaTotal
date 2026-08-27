"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CascadeReader } from "./CascadeReader";
import { FullscreenToggle } from "./FullscreenToggle";
import { RtlReader } from "./RtlReader";
import type { ReaderPage, ReadingMode } from "./types";
import { useProgresoExterno } from "./useProgresoExterno";

const CONTROLS_HIDE_MS = 2500;

interface Vecino {
  id: number;
  name: string;
}

/**
 * Lector de capítulos de Olympus Scanlation. Mismo lector que el propio,
 * con el nombre del grupo y el enlace a su sitio siempre visibles.
 */
export function OlympusReader({
  chapter,
  serie,
  grupo,
  pages,
  prevChapter,
  nextChapter,
  initialMode,
}: {
  chapter: { id: number; name: string; urlOriginal: string };
  serie: { slug: string; tipo: string; urlOriginal: string };
  grupo: string;
  pages: ReaderPage[];
  prevChapter: Vecino | null;
  nextChapter: Vecino | null;
  initialMode: ReadingMode;
}) {
  const [mode, setMode] = useState<ReadingMode>(initialMode);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  useProgresoExterno({
    source: "olympus",
    externalId: serie.slug,
    chapterId: String(chapter.id),
    chapterName: chapter.name,
  });

  const volverHref = `/externo/olympus/${serie.slug}`;
  const capituloHref = (id: number) =>
    `/leer-externo/olympus/${id}?slug=${serie.slug}&tipo=${serie.tipo}`;

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
    else document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    function onChange() {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      setControlsVisible(!fs);
    }
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const revealControls = useCallback(() => {
    if (!isFullscreen) return;
    setControlsVisible(true);
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen || !controlsVisible) return;
    const t = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
    return () => clearTimeout(t);
  }, [isFullscreen, controlsVisible, currentPage]);

  const showBar = !isFullscreen || controlsVisible;
  const progressPct = pages.length > 0 ? (currentPage / pages.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header
        className={`sticky top-0 z-50 border-b border-line bg-[color-mix(in_oklch,var(--bg)_92%,transparent)] backdrop-blur transition-opacity ${
          showBar ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          <Link
            href={volverHref}
            className="shrink-0 rounded-lg px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-ink"
          >
            ← Volver
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-medium text-ink">Capítulo {chapter.name}</p>
            {/* atribución visible en cada capítulo */}
            <a
              href={serie.urlOriginal}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-accent hover:underline"
            >
              {grupo} ↗
            </a>
          </div>

          <div className="flex shrink-0 items-center gap-2">
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

      <div className="fixed right-0 top-0 z-40 h-full w-1 bg-[var(--surface-raised)]" aria-hidden="true">
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
            seriesHref={volverHref}
            onPageVisible={setCurrentPage}
          />
        ) : (
          <RtlReader
            pages={pages}
            currentPage={currentPage}
            onNavigate={setCurrentPage}
            nextChapter={null}
            prevChapter={null}
            seriesSlug=""
            seriesHref={volverHref}
          />
        )}
      </div>

      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3 px-4 pb-12 pt-2">
        {prevChapter && (
          <Link
            href={capituloHref(prevChapter.id)}
            className="rounded-xl border border-line bg-panel px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink transition hover:border-accent"
          >
            ← Capítulo {prevChapter.name}
          </Link>
        )}
        <Link
          href={volverHref}
          className="rounded-xl border border-line px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-subtle transition hover:border-accent hover:text-ink"
        >
          Ver capítulos
        </Link>
        {nextChapter && (
          <Link
            href={capituloHref(nextChapter.id)}
            className="rounded-xl border border-accent bg-accent px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--bg)] transition hover:opacity-90"
          >
            Capítulo {nextChapter.name} →
          </Link>
        )}
      </div>

      <p className="px-4 pb-16 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
        Traducido por{" "}
        <a href={chapter.urlOriginal} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          {grupo}
        </a>
        , publicado con su permiso
      </p>
    </div>
  );
}
