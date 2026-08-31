"use client";

import { useCallback, useEffect, useState } from "react";
import {
  actualizarEscritorio,
  dismissVersion,
  fetchLatestDesktopRelease,
  installedDesktopVersion,
  isDesktopApp,
  isDismissed,
  puedeActualizarseSola,
  type DesktopRelease,
} from "@/lib/appVersion";

type Estado = "aviso" | "descargando" | "instalando" | "error";

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

/**
 * Actualizador de la app de Windows, al estilo del de Discord: aparece una
 * tarjeta con lo que trae la versión nueva, y al aceptar la descarga ocurre
 * dentro de la app, con su barra de progreso. Al terminar, MangaTotal se
 * cierra y se vuelve a abrir ya actualizado.
 */
export function DesktopUpdater() {
  const [release, setRelease] = useState<DesktopRelease | null>(null);
  const [instalada, setInstalada] = useState(1);
  const [estado, setEstado] = useState<Estado>("aviso");
  const [avance, setAvance] = useState({ descargado: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDesktopApp()) return;
    (async () => {
      const ultima = await fetchLatestDesktopRelease();
      if (!ultima) return;
      const actual = await installedDesktopVersion();
      if (ultima.versionCode <= actual) return;
      if (isDismissed(ultima.versionCode)) return;
      setInstalada(actual);
      setRelease(ultima);
    })();
  }, []);

  const actualizar = useCallback(async () => {
    if (!release) return;
    setError(null);
    setEstado("descargando");
    setAvance({ descargado: 0, total: Math.round(release.sizeMb * 1024 * 1024) });
    try {
      await actualizarEscritorio(release.installerUrl, (a) => {
        setAvance(a);
        if (a.total > 0 && a.descargado >= a.total) setEstado("instalando");
      });
      setEstado("instalando");
    } catch (err) {
      setEstado("error");
      setError(err instanceof Error ? err.message : "No se pudo actualizar");
    }
  }, [release]);

  if (!release) return null;

  const total = avance.total || Math.round(release.sizeMb * 1024 * 1024);
  const pct = total > 0 ? Math.min(100, Math.round((avance.descargado / total) * 100)) : 0;
  const ocupada = estado === "descargando" || estado === "instalando";
  // la instalación sin salir de la app llegó en la 1.2; las anteriores no
  // conocen el comando, así que a esas se les da el enlace de siempre
  const seInstalaSola = instalada >= 3 && puedeActualizarseSola();

  return (
    <div
      className="fixed bottom-5 right-5 z-[60] w-[26rem] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-[10px] border border-accent bg-panel  "
      role="status"
      data-od-id="desktop-updater"
    >
      {/* franja superior con la marca, como el actualizador de Discord */}
      <div className="flex items-center gap-3 border-b border-line bg-[var(--surface-raised)] px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-accent bg-[var(--accent-soft)] text-accent-ink">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M12 16 6 10h4V4h4v6h4zM5 18h14v2H5z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">
            {estado === "instalando"
              ? "Instalando MangaTotal…"
              : estado === "descargando"
                ? "Descargando actualización…"
                : `MangaTotal ${release.versionName} ya está disponible`}
          </p>
          <p className="font-mono text-[11px] tracking-[0.06em] text-subtle">
            {estado === "descargando"
              ? `${mb(avance.descargado)} de ${mb(total)} MB`
              : estado === "instalando"
                ? "Se va a reiniciar sola"
                : `${release.sizeMb} MB · ${release.date}`}
          </p>
        </div>
      </div>

      <div className="px-4 py-4">
        {ocupada ? (
          <>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-raised)]">
              <div
                className={`h-full rounded-full bg-accent transition-[width] duration-200 ${
                  estado === "instalando" ? "animate-pulse" : ""
                }`}
                style={{ width: `${estado === "instalando" ? 100 : pct}%` }}
              />
            </div>
            <p className="mt-3 text-[13px] leading-5 text-subtle">
              {estado === "instalando"
                ? "Cuando termine, MangaTotal se abre de nuevo con la versión nueva."
                : `${pct}% · no hace falta cerrar nada, seguí leyendo mientras tanto.`}
            </p>
          </>
        ) : (
          <>
            <ul className="space-y-1.5">
              {release.changes.slice(0, 5).map((cambio) => (
                <li key={cambio} className="flex gap-2 text-[13px] leading-5 text-subtle">
                  <span className="text-accent-ink">·</span>
                  {cambio}
                </li>
              ))}
            </ul>

            {error && (
              <div className="mt-3 rounded-md border border-danger px-3 py-2 text-[13px] leading-5 text-danger">
                <p>{error}</p>
                <a href={release.installerUrl} rel="noopener" className="underline">
                  Descargar el instalador a mano
                </a>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              {seInstalaSola ? (
                <button
                  onClick={actualizar}
                  className="flex-1 rounded-md border border-accent bg-accent px-4 py-2.5 text-center font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)] transition hover:opacity-90"
                >
                  {estado === "error" ? "Reintentar" : "Actualizar ahora"}
                </button>
              ) : (
                // versiones viejas de la app: no saben instalarse solas
                <a
                  href={release.installerUrl}
                  rel="noopener"
                  className="flex-1 rounded-md border border-accent bg-accent px-4 py-2.5 text-center font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)]"
                >
                  Descargar
                </a>
              )}
              <button
                onClick={() => {
                  dismissVersion(release.versionCode);
                  setRelease(null);
                }}
                className="rounded-md border border-line px-4 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:border-line-strong hover:text-ink"
              >
                Ahora no
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
