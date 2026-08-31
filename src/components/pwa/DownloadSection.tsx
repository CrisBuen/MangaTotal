"use client";

import { useEffect, useState } from "react";
import { enAppInstalada } from "@/lib/appVersion";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const WINDOWS_INSTALLER = "/descargas/MangaTotal-windows-setup.exe";
const ANDROID_APK = "/descargas/MangaTotal-android.apk";
const GOOGLE_PLAY_URL = process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL?.trim() ?? "";

/**
 * Bloque de descarga del final del inicio: instalador de Windows y, en
 * Android, la instalación de la app desde el propio navegador (PWA).
 *
 * No aparece dentro de las apps: ahí ya está instalada, y ofrecer
 * instalarla de nuevo no tiene sentido. En la web se muestra igual que
 * siempre, que es donde hace falta.
 */
export function DownloadSection() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  // null mientras no se sabe: en el servidor no hay forma de averiguarlo
  const [enApp, setEnApp] = useState<boolean | null>(null);

  useEffect(() => {
    setEnApp(enAppInstalada());
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

  if (enApp !== false) return null;

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

      <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <p className="font-display text-xl font-bold text-ink">Android Local</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
              APK · 4 MB
            </p>
          </div>

          <a
            href={ANDROID_APK}
            download
            className="mt-1 rounded-xl border border-accent bg-[var(--accent-soft)] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent transition hover:opacity-90"
            data-od-id="download-android"
          >
            Descargar APK
          </a>

          {installed ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
              Ya instalada
            </span>
          ) : prompt ? (
            <button
              onClick={installApp}
              className="font-mono text-[9px] uppercase tracking-[0.12em] text-subtle underline underline-offset-4 transition hover:text-accent"
              data-od-id="install-android"
            >
              o instalar desde el navegador
            </button>
          ) : isAndroid ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
              Permití instalar de orígenes desconocidos
            </span>
          ) : null}
        </div>

        {/* Edición revisada y actualizada exclusivamente por Google Play. */}
        {GOOGLE_PLAY_URL ? (
          <a
            href={GOOGLE_PLAY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center gap-3 rounded-2xl border border-line bg-[var(--surface-raised)] p-7 text-center transition hover:border-accent hover:shadow-[var(--glow)]"
            data-od-id="download-google-play"
          >
            <GooglePlayIcon />
            <div>
              <p className="font-display text-xl font-bold text-ink group-hover:text-accent">
                Google Play
              </p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                Android · edición Play
              </p>
            </div>
            <span className="mt-1 rounded-xl border border-accent bg-[var(--accent-soft)] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
              Ver en Google Play
            </span>
          </a>
        ) : (
          <div
            className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-[var(--surface-raised)] p-7 text-center opacity-75"
            data-od-id="download-google-play-coming-soon"
          >
            <GooglePlayIcon />
            <div>
              <p className="font-display text-xl font-bold text-ink">Google Play</p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                Android · edición Play
              </p>
            </div>
            <span className="mt-1 rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle">
              Próximamente
            </span>
          </div>
        )}
      </div>

      <p className="mt-7 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
        Windows puede pedir «Más información → Ejecutar de todas formas». Android Local requiere
        permitir la instalación desde el navegador; la edición Play se instala y actualiza desde
        Google Play.
      </p>
    </section>
  );
}

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden="true">
      <path fill="#00d6ff" d="M6 4.8c-.7.8-1 2-1 3.5v31.4c0 1.5.3 2.7 1 3.5l18.7-19.2L6 4.8Z" />
      <path fill="#ffd23f" d="m30.8 17.7-6.1 6.3 6.3 6.5 8.5-4.8c2.2-1.2 2.2-3.2 0-4.4l-8.7-3.6Z" />
      <path fill="#ff4b55" d="M6 43.2c1.1.9 2.8.9 4.6-.1L31 31.5 24.7 24 6 43.2Z" />
      <path fill="#45e06f" d="M6 4.8 24.7 24l6.1-6.3L10.6 4.9C8.8 3.9 7.1 3.9 6 4.8Z" />
    </svg>
  );
}
