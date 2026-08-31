"use client";

import { useEffect } from "react";
import type { ReadingMode } from "./types";

/**
 * Los ajustes de lectura, en un panel que sube desde abajo.
 *
 * Antes el modo de lectura vivía en la barra de arriba, ocupando lugar en la
 * franja más angosta de un teléfono. Acá está a mano del pulgar y solo cuando
 * hace falta, que es como se maneja un lector en el celular.
 */
export function AjustesLectura({
  abierto,
  modo,
  onModo,
  onCerrar,
}: {
  abierto: boolean;
  modo: ReadingMode;
  onModo: (modo: ReadingMode) => void;
  onCerrar: () => void;
}) {
  // con el panel abierto, el gesto de atrás lo cierra en vez de sacarte del
  // capítulo: es lo que uno espera de una hoja que se abre por encima
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto, onCerrar]);

  return (
    <>
      <div
        onClick={onCerrar}
        aria-hidden={!abierto}
        className={`fixed inset-0 z-[60] bg-black/60 transition-opacity duration-200 ${
          abierto ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-label="Ajustes de lectura"
        aria-hidden={!abierto}
        className={`fixed inset-x-0 bottom-0 z-[61] rounded-t-3xl border-t border-line bg-panel transition-transform duration-200 ease-out ${
          abierto ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-full max-w-md px-6 pt-3">
          <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-[var(--surface-raised)]" />

          <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">
            Modo de lectura
          </p>

          <div className="mt-3 flex gap-2">
            {(
              [
                { id: "cascade", nombre: "Cascada", detalle: "Scroll continuo, para webtoon" },
                { id: "rtl", nombre: "RTL", detalle: "Página a página, de derecha a izquierda" },
              ] as const
            ).map((o) => (
              <button
                key={o.id}
                onClick={() => onModo(o.id)}
                aria-pressed={modo === o.id}
                className={`flex-1 rounded-[10px] border p-4 text-left transition ${
                  modo === o.id
                    ? "border-accent bg-[var(--accent-soft)]"
                    : "border-line hover:border-line-strong"
                }`}
              >
                <span
                  className={`block text-sm font-bold ${
                    modo === o.id ? "text-accent-ink" : "text-ink"
                  }`}
                >
                  {o.nombre}
                </span>
                <span className="mt-1 block text-[13px] leading-5 text-subtle">{o.detalle}</span>
              </button>
            ))}
          </div>

          <button
            onClick={onCerrar}
            className="mt-6 min-h-11 w-full rounded-md border border-line font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:border-line-strong hover:text-ink"
          >
            Cerrar
          </button>
        </div>
      </div>
    </>
  );
}

/** El engranaje que abre el panel. Vive abajo, a mano del pulgar. */
export function BotonAjustes({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label="Ajustes de lectura"
      className={`fixed bottom-5 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-[color-mix(in_oklch,var(--bg)_88%,transparent)] text-subtle transition-colors hover:border-line-strong hover:text-accent-ink ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
      style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M19.4 13a7.8 7.8 0 0 0 0-2l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.2a.5.5 0 0 0-.6-.2l-2.4 1a7.6 7.6 0 0 0-1.7-1l-.4-2.5a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.5c-.6.2-1.2.6-1.7 1l-2.4-1a.5.5 0 0 0-.6.2L2.5 8.8a.5.5 0 0 0 .1.6L4.6 11a7.8 7.8 0 0 0 0 2l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.2c.1.2.4.3.6.2l2.4-1c.5.4 1.1.8 1.7 1l.4 2.5c0 .2.2.4.5.4h3.8c.3 0 .5-.2.5-.4l.4-2.5c.6-.2 1.2-.6 1.7-1l2.4 1c.2.1.5 0 .6-.2l1.9-3.2a.5.5 0 0 0-.1-.6l-2-1.6ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z" />
      </svg>
    </button>
  );
}
