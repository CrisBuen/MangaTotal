"use client";

import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Botón "Instalar app". Solo aparece cuando el navegador ofrece la
 * instalación (Chrome/Edge en Windows y Android) y todavía no está instalada.
 */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    function onPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    }
    function onInstalled() {
      setPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt) return null;

  return (
    <button
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice;
        setPrompt(null);
      }}
      className="hidden min-h-9 items-center rounded-xl border border-accent bg-[var(--accent-soft)] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent transition hover:opacity-90 sm:inline-flex"
      data-od-id="install-app"
    >
      Instalar app
    </button>
  );
}
