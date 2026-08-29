"use client";

import Link from "next/link";
import { EnlaceCapitulo } from "./EnlaceCapitulo";
import { useCallback, useEffect, useRef, useState } from "react";
import { BotonVolver } from "./BotonVolver";
import { CascadeReader } from "./CascadeReader";
import { FullscreenToggle } from "./FullscreenToggle";
import { AjustesLectura, BotonAjustes } from "./AjustesLectura";
import {
  activarPantallaCompleta,
  pantallaCompletaEsTotal,
  salirPantallaCompleta,
} from "@/lib/pantalla";
import { RtlReader } from "./RtlReader";
import type { ReaderPage, ReadingMode } from "./types";
import { useProgresoExterno } from "./useProgresoExterno";

const CONTROLS_HIDE_MS = 2500;

interface Vecino {
  /** Olympus numera sus capítulos; ZonaTMO los identifica por slug. */
  id: number | string;
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
  initialPage = 1,
  source = "olympus",
  hrefVolver,
  hrefCapitulo,
}: {
  chapter: { id: number | string; name: string; urlOriginal: string };
  serie: { slug: string; tipo: string; urlOriginal: string };
  grupo: string;
  pages: ReaderPage[];
  prevChapter: Vecino | null;
  nextChapter: Vecino | null;
  initialMode: ReadingMode;
  /** Página por la que iba la lectura, para retomarla donde quedó. */
  initialPage?: number;
  /** Fuente, para guardar el progreso en la biblioteca. */
  source?: "olympus" | "tmo" | "ikigai" | "leercapitulo" | "catharsis";
  /** Enlaces propios de la fuente; por defecto, los de Olympus. */
  hrefVolver?: string;
  hrefCapitulo?: (id: number | string) => string;
}) {
  const [mode, setMode] = useState<ReadingMode>(initialMode);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  // en Android el puente esconde además las barras del sistema
  const [inmersivaNativa, setInmersivaNativa] = useState(false);
  // la misma información que inmersivaNativa, pero legible desde los
  // manejadores que se registran una sola vez al montar
  const usaPuenteNativo = useRef(false);

  useProgresoExterno({
    source,
    externalId: serie.slug,
    chapterId: String(chapter.id),
    chapterName: chapter.name,
    pageNumber: currentPage,
  });

  const volverHref = hrefVolver ?? `/externo/olympus/${serie.slug}`;
  const capituloHref =
    hrefCapitulo ??
    ((id: number | string) => `/leer-externo/olympus/${id}?slug=${serie.slug}&tipo=${serie.tipo}`);

  const changeMode = useCallback((next: ReadingMode) => {
    setMode(next);
    fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferred_reading_mode: next }),
    }).catch(() => {});
  }, []);

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
   * Es lo que se espera de un lector en el celular, y con las barras del
   * sistema escondidas la página gana el alto que en una pantalla angosta se
   * nota. Al dejar el capítulo se devuelven.
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
      salirPantallaCompleta();
    };
  }, []);

  useEffect(() => {
    function onChange() {
      // con el puente nativo la pantalla completa no pasa por el navegador,
      // así que este aviso no sabe nada y pisaría el estado bueno
      if (usaPuenteNativo.current) return;
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      setControlsVisible(!fs);
    }
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /**
   * Un toque alterna los controles.
   *
   * Antes solo los mostraba, así que para sacarlos de encima había que
   * esperar a que se fueran solos. Ahora el segundo toque los oculta, que es
   * lo que uno espera cuando quiere ver la página completa.
   */
  const alternarControles = useCallback(() => {
    if (!isFullscreen) return;
    setControlsVisible((visibles) => !visibles);
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
        className={`sticky top-0 z-50 border-b border-line bg-[color-mix(in_oklch,var(--bg)_92%,transparent)] backdrop-blur transition-all duration-200 ease-out ${
          showBar ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div
          className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          <BotonVolver
            href={volverHref}
            className="shrink-0 rounded-lg px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-ink"
          />
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

          {/* el modo de lectura se mudó al engranaje de abajo: en la franja
              de arriba de un teléfono no entra, y ahí no se alcanza con el
              pulgar. Donde las barras del sistema no se esconden se deja el
              botón de salir, o no habría cómo volver. */}
          {!inmersivaNativa && (
            <div className="flex shrink-0 items-center gap-2">
              <FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
            </div>
          )}
        </div>
      </header>

      <div className="fixed right-0 top-0 z-40 h-full w-1 bg-[var(--surface-raised)]" aria-hidden="true">
        <div
          className="w-full bg-accent transition-[height] duration-300"
          style={{ height: `${progressPct}%` }}
        />
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

      <div onClick={alternarControles}>
        {mode === "cascade" ? (
          <CascadeReader
            pages={pages}
            initialPage={initialPage}
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
          <EnlaceCapitulo
            href={capituloHref(prevChapter.id)}
            className="rounded-xl border border-line bg-panel px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink transition hover:border-accent"
          >
            ← Capítulo {prevChapter.name}
          </EnlaceCapitulo>
        )}
        <Link
          href={volverHref}
          className="rounded-xl border border-line px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-subtle transition hover:border-accent hover:text-ink"
        >
          Ver capítulos
        </Link>
        {nextChapter && (
          <EnlaceCapitulo
            href={capituloHref(nextChapter.id)}
            className="rounded-xl border border-accent bg-accent px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--bg)] transition hover:opacity-90"
          >
            Capítulo {nextChapter.name} →
          </EnlaceCapitulo>
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
