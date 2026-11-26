"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BotonVolver } from "./BotonVolver";
import { CascadeReader } from "./CascadeReader";
import { FullscreenToggle } from "./FullscreenToggle";
import { AjustesLectura, BotonAjustes } from "./AjustesLectura";
import {
  esCambioCapituloLector,
  escribirUrlHistorial,
  guardarModoLecturaPreferido,
  guardarPosicionLector,
  leerModoLecturaPreferido,
  leerPosicionLector,
  registrarFlusherProgreso,
} from "@/lib/navegacionEstado";
import {
  activarPantallaCompleta,
  pantallaCompletaEsTotal,
  salirPantallaCompleta,
} from "@/lib/pantalla";
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
  const maxPage = Math.max(1, pages.length);
  const paginaSegura = Math.min(maxPage, Math.max(1, Math.trunc(initialPage || 1)));
  const progressKey = `cap:local:${chapter.id}`;

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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(0);
  const currentPageRef = useRef(paginaSegura);

  useEffect(() => {
    setMode(leerModoLecturaPreferido(initialMode));
    const sp = new URLSearchParams(window.location.search);
    if (!sp.has("page") && paginaSegura <= 1) {
      const local = leerPosicionLector(progressKey);
      if (local && local.page > 1) {
        const clamped = Math.min(maxPage, local.page);
        if (clamped > 1) {
          currentPageRef.current = clamped;
          setCurrentPage(clamped);
          setCascadeKey((k) => k + 1);
        }
      }
    }
  }, [initialMode, maxPage, paginaSegura, progressKey]);

  // ── progreso: PATCH /api/progress con debounce ─────────────────────────
  const saveProgress = useCallback(
    (pageNumber: number) => {
      const clamped = Math.min(maxPage, Math.max(1, Math.trunc(pageNumber || 1)));
      if (clamped === lastSavedRef.current) return;
      guardarPosicionLector(progressKey, {
        page: clamped,
        chapterId: String(chapter.id),
      });
      fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: chapter.id, pageNumber: clamped }),
        keepalive: true,
      })
        .then((res) => {
          if (res.ok) lastSavedRef.current = clamped;
        })
        .catch(() => {});
    },
    [chapter.id, maxPage, progressKey]
  );

  const onPageChange = useCallback(
    (pageNumber: number) => {
      const clamped = Math.min(maxPage, Math.max(1, Math.trunc(pageNumber || 1)));
      setCurrentPage(clamped);
      currentPageRef.current = clamped;
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get("page") !== String(clamped) && (clamped > 1 || url.searchParams.has("page"))) {
          url.searchParams.set("page", String(clamped));
          escribirUrlHistorial(url, "replace");
        }
      } catch {}
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveProgress(clamped), PROGRESS_SAVE_MS);
    },
    [maxPage, saveProgress]
  );

  // guardar al ocultar/salir/desmontar
  useEffect(() => {
    const flush = () => saveProgress(currentPageRef.current);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const quitarFlusher = registrarFlusherProgreso(flush);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      flush();
      quitarFlusher();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [saveProgress]);

  // ── modo de lectura: cambiarlo lo recuerda como preferencia ────────────
  const changeMode = useCallback((next: ReadingMode) => {
    setMode(next);
    guardarModoLecturaPreferido(next);
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
    const saliendo = isFullscreen;
    if (saliendo) salirPantallaCompleta();
    else activarPantallaCompleta();

    // el navegador avisa por "fullscreenchange"; el puente nativo no, así que
    // con él hay que llevar el estado a mano
    if (inmersivaNativa) {
      setIsFullscreen(!saliendo);
      setControlsVisible(saliendo);
    }
  }, [isFullscreen, inmersivaNativa]);

  /**
   * En el teléfono se entra a leer directo a pantalla completa.
   *
   * Con las barras del sistema escondidas la página gana el alto que en una
   * pantalla angosta se nota. Al dejar el capítulo se devuelven.
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

  useEffect(() => {
    function onChange() {
      // con el puente nativo la pantalla completa no pasa por el navegador,
      // así que este aviso no sabe nada y pisaría el estado bueno
      if (usaPuenteNativo.current) return;
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
        className={`${isFullscreen ? "fixed inset-x-0" : "sticky"} top-0 z-50 border-b border-line bg-[color-mix(in_oklch,var(--bg)_88%,transparent)] transition-opacity ${
          showBar ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-3 py-2 sm:px-5"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          <BotonVolver
            href={`/serie/${series.slug}`}
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-[13px] font-bold tracking-[0.08em] text-subtle transition hover:bg-[var(--surface-raised)] hover:text-ink"
          />
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-display text-lg font-bold leading-tight text-ink">
              {series.title} — Cap. {chapter.number}
              {chapter.title ? `: ${chapter.title}` : ""}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2" data-od-id="reader-controls">
            {mode === "rtl" && (
              <span className="hidden font-mono text-[11px] tracking-[0.08em] text-subtle sm:inline">
                página {currentPage} / {chapter.pageCount}
              </span>
            )}
            {/* el modo de lectura se mudó al engranaje de abajo: en la
                franja de arriba de un teléfono no entra, y ahí no se alcanza
                con el pulgar. Donde las barras del sistema no se esconden se
                deja el botón de salir, o no habría cómo volver. */}
            {!inmersivaNativa && (
              <FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
            )}
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
            key={cascadeKey}
            pages={pages}
            initialPage={currentPage}
            nextChapter={nextChapter}
            seriesSlug={series.slug}
            onPageVisible={onPageChange}
            progressKey={progressKey}
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
          className="fixed right-4 z-50 min-h-11 rounded-md border border-line bg-panel px-4 text-[13px] font-bold tracking-[0.08em] text-ink shadow-xl transition hover:border-line-strong hover:bg-[var(--surface-raised)]"
          style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
          data-od-id="exit-fullscreen-button"
        >
          Salir (Esc)
        </button>
      )}
    </div>
  );
}
