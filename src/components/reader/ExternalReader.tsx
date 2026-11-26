"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BotonVolver } from "./BotonVolver";
import { CascadeReader } from "./CascadeReader";
import { EnlaceCapitulo } from "./EnlaceCapitulo";
import { FullscreenToggle } from "./FullscreenToggle";
import { AjustesLectura, BotonAjustes } from "./AjustesLectura";
import {
  esCambioCapituloLector,
  guardarModoLecturaPreferido,
  leerModoLecturaPreferido,
  leerPosicionLector,
} from "@/lib/navegacionEstado";
import {
  activarPantallaCompleta,
  pantallaCompletaEsTotal,
  salirPantallaCompleta,
} from "@/lib/pantalla";
import { RtlReader } from "./RtlReader";
import type { ReaderPage, ReadingMode } from "./types";
import { useProgresoExterno } from "./useProgresoExterno";

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
  initialPage = 1,
}: {
  chapter: ExternalChapterInfo;
  seriesId: string | null;
  pages: ReaderPage[];
  prevChapter?: ExternalChapterLink | null;
  nextChapter?: ExternalChapterLink | null;
  initialMode: ReadingMode;
  /** Página por la que iba la lectura, para retomarla donde quedó. */
  initialPage?: number;
}) {
  const maxPage = Math.max(1, pages.length);
  const paginaSegura = Math.min(maxPage, Math.max(1, Math.trunc(initialPage || 1)));
  const progressKey = `cap:mangadex:${seriesId ?? "unknown"}:${chapter.id}`;

  const [mode, setMode] = useState<ReadingMode>(initialMode);
  const [currentPage, setCurrentPage] = useState(paginaSegura);
  const [cascadeKey, setCascadeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  // en Android el puente esconde además las barras del sistema
  const [inmersivaNativa, setInmersivaNativa] = useState(false);
  // la misma información que inmersivaNativa, pero legible desde los
  // manejadores que se registran una sola vez al montar
  const usaPuenteNativo = useRef(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMode(leerModoLecturaPreferido(initialMode));
    const sp = new URLSearchParams(window.location.search);
    if (!sp.has("page") && paginaSegura <= 1) {
      const local = leerPosicionLector(progressKey);
      if (local && local.page > 1) {
        const clamped = Math.min(maxPage, local.page);
        if (clamped > 1) {
          setCurrentPage(clamped);
          setCascadeKey((k) => k + 1);
        }
      }
    }
  }, [initialMode, maxPage, paginaSegura, progressKey]);

  const onPageChange = useCallback(
    (pageNumber: number) => setCurrentPage(Math.min(maxPage, Math.max(1, Math.trunc(pageNumber || 1)))),
    [maxPage]
  );

  const changeMode = useCallback((next: ReadingMode) => {
    setMode(next);
    guardarModoLecturaPreferido(next);
    fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferred_reading_mode: next }),
    }).catch(() => {});
  }, []);

  // pantalla completa sobre el documento, no sobre este contenedor: así
  // sobrevive al pasar de capítulo (el contenedor se desmonta, el documento no)
  const toggleFullscreen = useCallback(() => {
    const saliendo = isFullscreen;
    if (saliendo) salirPantallaCompleta();
    else activarPantallaCompleta();
    if (inmersivaNativa) {
      setIsFullscreen(!saliendo);
      setControlsVisible(saliendo);
    }
  }, [isFullscreen, inmersivaNativa]);

  useEffect(() => {
    function onChange() {
      // con el puente nativo la pantalla completa no pasa por el navegador,
      // así que este aviso no sabe nada y pisaría el estado bueno
      if (usaPuenteNativo.current) return;
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      setControlsVisible(!fs);
    }
    // al entrar ya en pantalla completa (venimos del capítulo anterior)
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /**
   * Un toque alterna los controles: el segundo los oculta en vez de obligar a
   * esperar a que se vayan solos.
   */
  const revealControls = useCallback(() => {
    if (!isFullscreen) return;
    setControlsVisible((visibles) => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (visibles) return false;
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
      return true;
    });
  }, [isFullscreen]);

  /**
   * En el teléfono se entra a leer directo a pantalla completa, con las barras
   * del sistema escondidas. Al dejar el capítulo se devuelven.
   */
  useEffect(() => {
    const nativa = pantallaCompletaEsTotal();
    setInmersivaNativa(nativa);
    usaPuenteNativo.current = nativa;
    if (!nativa) return;

    activarPantallaCompleta();
    setIsFullscreen(true);
    setControlsVisible(false);

    return () => {
      if (!esCambioCapituloLector(true)) salirPantallaCompleta();
    };
  }, []);

  const showBar = !isFullscreen || controlsVisible;
  const progressPct = pages.length > 0 ? (currentPage / pages.length) * 100 : 0;
  useProgresoExterno({
    source: "mangadex",
    externalId: seriesId ?? "",
    chapterId: chapter.id,
    chapterName: chapter.number ?? "",
    pageNumber: currentPage,
  });

  const backHref = seriesId ? `/externo/${seriesId}` : "/explorar";

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-canvas text-ink"
    >
      <header
        className={`${isFullscreen ? "fixed inset-x-0" : "sticky"} top-0 z-50 border-b border-line bg-[color-mix(in_oklch,var(--bg)_92%,transparent)] transition-opacity ${
          showBar ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          <BotonVolver
            href={backHref}
            className="shrink-0 rounded-lg px-2 py-1 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-ink"
          />
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-medium text-ink">
              Cap. {chapter.number ?? "?"}
              {chapter.title ? `: ${chapter.title}` : ""}
            </p>
            {chapter.group && (
              <p className="truncate font-mono text-[11px] tracking-[0.06em] text-subtle">
                {chapter.group} · MangaDex
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {mode === "rtl" && (
              <span className="hidden font-mono text-[11px] text-subtle sm:inline">
                {currentPage} / {pages.length}
              </span>
            )}
            {/* el modo de lectura vive ahora en el engranaje de abajo, al
                alcance del pulgar. Donde las barras del sistema no se
                esconden se deja el botón de salir. */}
            {!inmersivaNativa && (
              <FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
            )}
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
            key={cascadeKey}
            pages={pages}
            initialPage={currentPage}
            nextChapter={null}
            seriesSlug=""
            seriesHref={backHref}
            onPageVisible={onPageChange}
            progressKey={progressKey}
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
          <EnlaceCapitulo
            href={`/leer-externo/${prevChapter.id}`}
            className="rounded-md border border-line bg-panel px-5 py-2.5 font-mono text-[11px] font-bold tracking-[0.1em] text-ink transition hover:border-line-strong"
          >
            ← Capítulo {prevChapter.number ?? "anterior"}
          </EnlaceCapitulo>
        )}
        <BotonVolver
          href={backHref}
          className="rounded-md border border-line px-5 py-2.5 font-mono text-[11px] font-bold tracking-[0.1em] text-subtle transition hover:border-line-strong hover:text-ink"
        >
          Ver capítulos
        </BotonVolver>
        {nextChapter && (
          <EnlaceCapitulo
            href={`/leer-externo/${nextChapter.id}`}
            className="rounded-md border border-accent bg-accent px-5 py-2.5 font-mono text-[11px] font-bold tracking-[0.1em] text-[var(--on-accent)] transition hover:opacity-90"
          >
            Capítulo {nextChapter.number ?? "siguiente"} →
          </EnlaceCapitulo>
        )}
      </div>

      <BotonAjustes onClick={() => setAjustesAbiertos(true)} visible={showBar} />
      <AjustesLectura
        abierto={ajustesAbiertos}
        modo={mode}
        onModo={(m) => {
          changeMode(m);
          setAjustesAbiertos(false);
        }}
        onCerrar={() => setAjustesAbiertos(false)}
      />

      {isFullscreen && controlsVisible && !inmersivaNativa && (
        <button
          onClick={toggleFullscreen}
          className="fixed right-4 z-50 rounded-full border border-line bg-[var(--surface-raised)] px-4 py-2 text-sm text-ink shadow-lg"
          style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          Salir (Esc)
        </button>
      )}
    </div>
  );
}
