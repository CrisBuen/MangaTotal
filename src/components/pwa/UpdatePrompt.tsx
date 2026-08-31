"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Cada cuánto se busca una versión nueva estando la app abierta. */
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Registra el service worker y avisa cuando hay una versión nueva
 * publicada, con un botón para actualizar al instante (como Discord).
 * Sirve igual en el navegador, en la PWA instalada y en la app de escritorio.
 */
export function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let registration: ServiceWorkerRegistration | null = null;

    // cuando el worker nuevo toma el control, se recarga una sola vez
    const onControllerChange = () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    async function register() {
      try {
        registration = await navigator.serviceWorker.register("/sw.js");

        // ya había una versión nueva esperando de una visita anterior
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaiting(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const nueva = registration?.installing;
          if (!nueva) return;
          nueva.addEventListener("statechange", () => {
            // "installed" con un controlador activo = actualización, no primera visita
            if (nueva.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(nueva);
            }
          });
        });
      } catch {
        // sin service worker la app sigue funcionando normalmente
      }
    }

    register();

    // buscar versiones nuevas cada tanto y al volver a la ventana
    const check = () => registration?.update().catch(() => {});
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const update = useCallback(() => {
    waiting?.postMessage("SKIP_WAITING");
  }, [waiting]);

  if (!waiting) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-[10px] border border-accent bg-panel p-4  "
      role="status"
      data-od-id="update-prompt"
    >
      <div className="flex items-center gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-accent bg-[var(--accent-soft)] text-accent-ink">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">Nueva versión disponible</p>
          <p className="mt-0.5 text-[13px] text-subtle">Actualizá para tener las últimas mejoras.</p>
        </div>
        <button
          onClick={update}
          className="shrink-0 rounded-md border border-accent bg-accent px-4 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)] transition hover:opacity-90"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
