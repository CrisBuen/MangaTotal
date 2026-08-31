"use client";

import { useCallback, useEffect, useState } from "react";
import {
  actualizarEscritorio,
  downloadUrlFor,
  fetchLatestDesktopRelease,
  fetchLatestRelease,
  installedDesktopVersion,
  installedVersionCode,
  isAndroidApp,
  isDesktopApp,
  isPlayStoreApp,
  puedeActualizarseSola,
} from "@/lib/appVersion";

interface Novedad {
  versionCode: number;
  versionName: string;
  changes: string[];
  descargaUrl: string;
}

/**
 * Bloque de Perfil para revisar actualizaciones de la app Android a mano,
 * incluso si el aviso se pospuso.
 */
export function UpdateChecker() {
  const [inApp, setInApp] = useState(false);
  const [installed, setInstalled] = useState(1);
  const [release, setRelease] = useState<Novedad | null>(null);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [bajando, setBajando] = useState<number | null>(null);
  const [errorActualizar, setErrorActualizar] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    if (isDesktopApp()) {
      const ultima = await fetchLatestDesktopRelease();
      setRelease(
        ultima
          ? {
              versionCode: ultima.versionCode,
              versionName: ultima.versionName,
              changes: ultima.changes,
              descargaUrl: ultima.installerUrl,
            }
          : null
      );
    } else {
      const ultima = await fetchLatestRelease();
      setRelease(
        ultima
          ? {
              versionCode: ultima.versionCode,
              versionName: ultima.versionName,
              changes: ultima.changes,
              descargaUrl: downloadUrlFor(ultima, true),
            }
          : null
      );
    }
    setChecked(true);
    setChecking(false);
  }, []);

  useEffect(() => {
    (async () => {
      const enApp = (isAndroidApp() && !isPlayStoreApp()) || isDesktopApp();
      setInApp(enApp);
      setInstalled(isDesktopApp() ? await installedDesktopVersion() : installedVersionCode());
      if (enApp) check();
    })();
  }, [check]);

  // en Windows la actualización se baja y se instala sin salir de la app
  const actualizarAqui = async () => {
    if (!release) return;
    setErrorActualizar(null);
    setBajando(0);
    try {
      await actualizarEscritorio(release.descargaUrl, ({ descargado, total }) => {
        setBajando(total > 0 ? Math.round((descargado / total) * 100) : 0);
      });
    } catch (err) {
      setBajando(null);
      setErrorActualizar(err instanceof Error ? err.message : "No se pudo actualizar");
    }
  };

  if (!inApp) return null;

  const hasUpdate = release !== null && release.versionCode > installed;
  // la instalación dentro de la app llegó en la 1.2 de escritorio
  const enEscritorio = isDesktopApp() && installed >= 3 && puedeActualizarseSola();

  return (
    <section
      className="rounded-2xl border border-line bg-panel p-5"
      data-od-id="update-checker"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Aplicación</h2>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
            Versión instalada {installed}
            {release ? ` · última ${release.versionName}` : ""}
          </p>
        </div>
        <button
          onClick={check}
          disabled={checking}
          className="shrink-0 rounded-xl border border-line px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-50"
        >
          {checking ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {hasUpdate ? (
        <>
          <ul className="mb-4 space-y-1">
            {release.changes.map((change) => (
              <li key={change} className="flex gap-2 text-xs leading-5 text-subtle">
                <span className="text-accent">·</span>
                {change}
              </li>
            ))}
          </ul>
          {errorActualizar && (
            <p className="mb-3 rounded-xl border border-danger px-3 py-2 text-xs leading-5 text-danger">
              {errorActualizar}
            </p>
          )}

          {enEscritorio ? (
            <button
              onClick={actualizarAqui}
              disabled={bajando !== null}
              className="inline-block rounded-xl border border-accent bg-accent px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bg)] disabled:opacity-70"
            >
              {bajando === null
                ? `Actualizar a v${release.versionName}`
                : bajando >= 100
                  ? "Instalando…"
                  : `Descargando… ${bajando}%`}
            </button>
          ) : (
            <a
              href={release.descargaUrl}
              rel="noopener"
              className="inline-block rounded-xl border border-accent bg-accent px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bg)]"
            >
              Actualizar a v{release.versionName}
            </a>
          )}
        </>
      ) : checked ? (
        <p className="text-xs text-subtle">La app está al día.</p>
      ) : null}
    </section>
  );
}
