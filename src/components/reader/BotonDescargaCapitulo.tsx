"use client";

import { useCallback, useState } from "react";
import { descargarCapituloLocal, prepararCarpetaDestinoPC, type ProgresoDescarga } from "@/lib/descargaCapitulo";

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

  const iniciarDescarga = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (estado === "descargando") return;

      try {
        // En PC, solicitar la carpeta de destino directamente durante el gesto de clic
        await prepararCarpetaDestinoPC();
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("cancelada por el usuario")) {
          return;
        }
      }

      setEstado("descargando");
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
        // Vuelve a estado inactivo después de 4 segundos
        setTimeout(() => {
          setEstado("inactivo");
          setProgreso(null);
        }, 4000);
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
    <button
      type="button"
      onClick={iniciarDescarga}
      disabled={estado === "descargando"}
      title={
        estado === "descargando"
          ? progreso
            ? `${progreso.porcentaje}% (${progreso.actual}/${progreso.total})`
            : "Descargando..."
          : estado === "completado"
          ? "¡Capítulo descargado!"
          : estado === "error"
          ? errorMensaje ?? "Error al descargar"
          : `Descargar ${capituloNombre} en FullHD original`
      }
      aria-label={`Descargar ${capituloNombre}`}
      className={`group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${
        estado === "descargando"
          ? "border-accent bg-accent/10 text-accent-ink cursor-wait"
          : estado === "completado"
          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
          : estado === "error"
          ? "border-red-500 bg-red-500/10 text-red-400"
          : "border-line bg-[var(--surface-raised)] text-subtle hover:border-accent hover:text-ink hover:scale-105 active:scale-95"
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
        <div className="flex flex-col items-center justify-center">
          <svg className="h-4 w-4 animate-spin text-accent-ink" viewBox="0 0 24 24">
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
          {progreso && progreso.porcentaje > 0 && (
            <span className="absolute -bottom-4 text-[9px] font-mono font-bold text-accent-ink whitespace-nowrap bg-panel/90 px-1 rounded shadow-sm">
              {progreso.porcentaje}%
            </span>
          )}
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
  );
}
