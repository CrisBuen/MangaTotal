"use client";

import { useCallback, useEffect, useState } from "react";
import {
  descargarCapituloLocal,
  esCapituloDescargado,
  esEntornoAndroid,
  prepararCarpetaDestinoPC,
  type ProgresoDescarga,
} from "@/lib/descargaCapitulo";

interface BotonDescargaCapituloProps {
  fuente: string;
  serieNombre: string;
  capituloNombre: string;
  obtenerPaginas: () => Promise<string[]>;
  className?: string;
}

export function BotonDescargaCapitulo({
  fuente,
  serieNombre,
  capituloNombre,
  obtenerPaginas,
  className = "",
}: BotonDescargaCapituloProps) {
  const [estado, setEstado] = useState<"inactivo" | "descargando" | "completado" | "error">("inactivo");
  const [progreso, setProgreso] = useState<ProgresoDescarga | null>(null);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (esCapituloDescargado(fuente, serieNombre, capituloNombre)) {
      setEstado("completado");
    }
  }, [fuente, serieNombre, capituloNombre]);

  const iniciarDescarga = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (estado === "descargando") return;

      // Solo en PC de escritorio solicitamos carpeta con File System Access API.
      // En Android nunca se invoca showDirectoryPicker (bloquea el WebView) y se guarda directo en MangaTotal/descargas.
      if (!esEntornoAndroid()) {
        try {
          await prepararCarpetaDestinoPC();
        } catch (err: unknown) {
          if (err instanceof Error && err.message.includes("cancelada por el usuario")) {
            return;
          }
        }
      }

      setEstado("descargando");
      setProgreso({
        fase: "conectando",
        actual: 0,
        total: 0,
        porcentaje: 0,
      });
      setErrorMensaje(null);

      try {
        await descargarCapituloLocal({
          fuente,
          serie: serieNombre,
          capitulo: capituloNombre,
          obtenerPaginas,
          onProgreso: (p) => setProgreso(p),
        });

        setEstado("completado");
        setProgreso(null);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("cancelada por el usuario")) {
          setEstado("inactivo");
          return;
        }
        setEstado("error");
        setErrorMensaje(err instanceof Error ? err.message : "Error al descargar");
        setTimeout(() => {
          setEstado("inactivo");
        }, 5000);
      }
    },
    [estado, fuente, serieNombre, capituloNombre, obtenerPaginas]
  );

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={iniciarDescarga}
        disabled={estado === "descargando"}
        title={
          estado === "descargando"
            ? progreso
              ? `${progreso.porcentaje}% (${progreso.actual}/${progreso.total || "?"})`
              : "Conectando con la fuente..."
            : estado === "completado"
            ? "Capítulo descargado en MangaTotal/descargas"
            : estado === "error"
            ? errorMensaje ?? "Error al descargar"
            : `Descargar ${capituloNombre} en FullHD original`
        }
        aria-label={`Descargar ${capituloNombre}`}
        className={`group relative flex h-8 items-center justify-center rounded-full border transition-all ${
          estado === "descargando"
            ? "border-accent bg-accent/15 text-accent-ink px-2.5 gap-1.5 cursor-wait shadow-sm"
            : estado === "completado"
            ? "w-8 border-emerald-500 bg-emerald-500/15 text-emerald-400"
            : estado === "error"
            ? "w-8 border-red-500 bg-red-500/15 text-red-400"
            : "w-8 border-line bg-[var(--surface-raised)] text-subtle hover:border-accent hover:text-ink hover:scale-105 active:scale-95"
        } ${className}`}
      >
        {estado === "inactivo" && (
          <svg
            className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 4v12m0 0l-4-4m4 4l4-4"
            />
          </svg>
        )}

        {estado === "descargando" && (
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
            <svg className="h-3.5 w-3.5 animate-spin text-accent-ink" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3.5"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <span>{progreso ? `${progreso.porcentaje}%` : "..."}</span>
          </div>
        )}

        {estado === "completado" && (
          <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}

        {estado === "error" && (
          <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )}
      </button>

      {estado === "error" && errorMensaje && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-950/90 border border-red-500/40 px-2 py-0.5 text-[10px] text-red-200 shadow-lg z-20">
          {errorMensaje}
        </span>
      )}
    </div>
  );
}
