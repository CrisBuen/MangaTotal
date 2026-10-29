"use client";

import { useEffect, useState } from "react";
import {
  dismissVersion,
  downloadUrlFor,
  fetchLatestRelease,
  installedVersionCode,
  isAndroidApp,
  isDismissed,
  isPlayStoreApp,
} from "@/lib/appVersion";

interface Novedad {
  versionCode: number;
  versionName: string;
  sizeMb: number;
  changes: string[];
  descargaUrl: string;
}

/**
 * Aviso de actualización de la app Android. Solo aparece dentro de la app
 * y cuando hay una versión más nueva publicada. Si se pospone, queda
 * disponible en Perfil → Buscar actualizaciones.
 *
 * La app de Windows tiene el suyo: ver DesktopUpdater.
 */
export function AndroidUpdateBanner() {
  const [release, setRelease] = useState<Novedad | null>(null);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    if (!isAndroidApp() || isPlayStoreApp()) return;
    (async () => {
      const ultima = await fetchLatestRelease();
      if (!ultima) return;
      if (ultima.versionCode <= installedVersionCode()) return;
      if (isDismissed(ultima.versionCode)) return;
      setRelease({
        versionCode: ultima.versionCode,
        versionName: ultima.versionName,
        sizeMb: ultima.sizeMb,
        changes: ultima.changes,
        descargaUrl: downloadUrlFor(ultima, true),
      });
    })();
  }, []);

  const iniciarActualizacion = async () => {
    if (!release || descargando) return;
    setDescargando(true);

    const urlObjetivo = release.descargaUrl.startsWith("http")
      ? release.descargaUrl
      : `https://www.mangatotal.com${release.descargaUrl.startsWith("/") ? "" : "/"}${release.descargaUrl}`;

    // 1. Probar puente nativo de Capacitor si está disponible
    try {
      const fuentes = (window as unknown as { Capacitor?: { Plugins?: { Fuentes?: { iniciarDescargaActualizacion?: (args: { url: string }) => Promise<void> } } } })?.Capacitor?.Plugins?.Fuentes;
      if (fuentes?.iniciarDescargaActualizacion) {
        await fuentes.iniciarDescargaActualizacion({ url: urlObjetivo });
        return;
      }
    } catch {}

    // 2. Si no tiene el método nativo (en versiones anteriores instaladas),
    // lanzar la descarga navegando a la URL absoluta con Content-Disposition attachment
    window.location.href = urlObjetivo;
  };

  if (!release) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-24 z-[60] rounded-[10px] border border-accent bg-panel p-4   lg:inset-x-auto lg:right-5 lg:bottom-5 lg:w-96"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      role="status"
      data-od-id="android-update-banner"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-accent bg-[var(--accent-soft)] text-accent-ink">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M12 16 6 10h4V4h4v6h4zM5 18h14v2H5z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">
            Actualización disponible · v{release.versionName}
          </p>
          <p className="font-mono text-[11px] tracking-[0.06em] text-subtle">
            {release.sizeMb} MB
          </p>
        </div>
      </div>

      <ul className="mb-4 space-y-1">
        {release.changes.slice(0, 4).map((change) => (
          <li key={change} className="flex gap-2 text-[13px] leading-5 text-subtle">
            <span className="text-accent-ink">·</span>
            {change}
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        {descargando ? (
          <button
            type="button"
            disabled
            className="flex-1 rounded-md border border-accent bg-accent/80 px-4 py-2.5 text-center font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)] opacity-90 cursor-wait"
          >
            Descargando ({release.sizeMb} MB)…
          </button>
        ) : (
          <button
            type="button"
            onClick={iniciarActualizacion}
            className="flex-1 rounded-md border border-accent bg-accent px-4 py-2.5 text-center font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)] transition-opacity hover:opacity-95 active:scale-[0.98]"
          >
            Actualizar
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (!descargando) dismissVersion(release.versionCode);
            setRelease(null);
          }}
          className="rounded-md border border-line px-4 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle hover:text-ink"
        >
          {descargando ? "Cerrar" : "Ahora no"}
        </button>
      </div>

      {descargando && (
        <div className="mt-2.5 border-t border-line/60 pt-2 text-center">
          <p className="text-[11px] leading-4 text-subtle">
            Descargando con el gestor del sistema. La instalación se abrirá automáticamente.
          </p>
          <p className="mt-1 text-[11px] text-subtle">
            ¿No inicia?{" "}
            <a
              href="https://raw.githubusercontent.com/CrisBuen/MangaTotal/main/public/descargas/MangaTotal-android.apk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-ink underline"
            >
              Descargar en el navegador
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
