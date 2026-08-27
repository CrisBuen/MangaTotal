"use client";

import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const WINDOWS_INSTALLER = "/descargas/MangaTotal-windows-setup.exe";

/**
 * Bloque de descarga del final del inicio: instalador de Windows y, en
 * Android, la instalación de la app desde el propio navegador (PWA).
 */
export function DownloadSection() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    setIsAndroid(/android/i.test(navigator.userAgent));
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);

    function onPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    }
    function onInstalled() {
      setPrompt(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installApp() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }

  return (
    <section
      className="rounded-[2rem] border border-line bg-panel p-8 sm:p-10"
      data-od-id="home-downloads"
      id="descargas"
    >
      <div className="mb-8 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
          Llevate MangaTotal
        </p>
        <h2 className="mt-3 font-display text-4xl font-black uppercase leading-[0.92] tracking-[-0.05em] text-ink sm:text-5xl">
          Instalá la app
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-subtle">
          Misma cuenta, misma biblioteca y el mismo progreso en todos lados. Se actualiza sola
          con cada versión nueva.
        </p>
      </div>

      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        {/* Windows */}
        <a
          href={WINDOWS_INSTALLER}
          download
          className="group flex flex-col items-center gap-3 rounded-2xl border border-line bg-[var(--surface-raised)] p-7 text-center transition hover:border-accent hover:shadow-[var(--glow)]"
          data-od-id="download-windows"
        >
          <svg viewBox="0 0 24 24" className="h-9 w-9 fill-current text-accent" aria-hidden="true">
            <path d="M3 5.5 10 4.5v7H3v-6zM11 4.3 21 3v8.5H11v-7.2zM3 12.5h7v7L3 18.5v-6zM11 12.5h10V21l-10-1.3v-7.2z" />
          </svg>
          <div>
            <p className="font-display text-xl font-bold text-ink group-hover:text-accent">
              Windows
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
              Instalador · 1,4 MB
            </p>
          </div>
          <span className="mt-1 rounded-xl border border-accent bg-[var(--accent-soft)] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
            Descargar
          </span>
        </a>

        {/* Android / instalación desde el navegador */}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-[var(--surface-raised)] p-7 text-center">
          <svg viewBox="0 0 24 24" className="h-9 w-9 fill-current text-accent" aria-hidden="true">
            <path d="M17.6 9.5H6.4v9.1c0 .5.4.9.9.9h1v3c0 .8.7 1.5 1.5 1.5S11.3 23.3 11.3 22.5v-3h1.4v3c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5v-3h1c.5 0 .9-.4.9-.9V9.5zM4.5 9.3c-.8 0-1.5.7-1.5 1.5v5.4c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5v-5.4c0-.8-.7-1.5-1.5-1.5zm15 0c-.8 0-1.5.7-1.5 1.5v5.4c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5v-5.4c0-.8-.7-1.5-1.5-1.5zM15.6 2.3l1-1.8a.3.3 0 0 0-.5-.3l-1.1 1.9a6.6 6.6 0 0 0-4.9 0L9 .2a.3.3 0 1 0-.5.3l1 1.8A5.9 5.9 0 0 0 6.4 7.5h11.2a5.9 5.9 0 0 0-2-5.2zM9.6 5.3a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2zm4.8 0a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2z" />
          </svg>
          <div>
            <p className="font-display text-xl font-bold text-ink">Android</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
              Se instala desde el navegador
            </p>
          </div>

          {installed ? (
            <span className="mt-1 rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle">
              Ya instalada
            </span>
          ) : prompt ? (
            <button
              onClick={installApp}
              className="mt-1 rounded-xl border border-accent bg-[var(--accent-soft)] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent transition hover:opacity-90"
              data-od-id="install-android"
            >
              Instalar
            </button>
          ) : (
            <p className="mt-1 max-w-56 text-xs leading-5 text-subtle">
              {isAndroid
                ? "Abrí el menú ⋮ de Chrome y elegí «Instalar aplicación»."
                : "Entrá desde tu celular con Chrome para instalarla."}
            </p>
          )}
        </div>
      </div>

      <p className="mt-7 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
        La app de Windows no está firmada: Windows puede pedir «Más información → Ejecutar de
        todas formas»
      </p>
    </section>
  );
}
