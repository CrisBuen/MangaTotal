"use client";

import { useCallback, useEffect, useState } from "react";
import {
  downloadUrlFor,
  fetchLatestRelease,
  installedVersionCode,
  isAndroidApp,
  type AndroidRelease,
} from "@/lib/appVersion";

/**
 * Bloque de Perfil para revisar actualizaciones de la app Android a mano,
 * incluso si el aviso se pospuso.
 */
export function UpdateChecker() {
  const [inApp, setInApp] = useState(false);
  const [installed, setInstalled] = useState(1);
  const [release, setRelease] = useState<AndroidRelease | null>(null);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    const latest = await fetchLatestRelease();
    setRelease(latest);
    setChecked(true);
    setChecking(false);
  }, []);

  useEffect(() => {
    setInApp(isAndroidApp());
    setInstalled(installedVersionCode());
    check();
  }, [check]);

  if (!inApp) return null;

  const hasUpdate = release !== null && release.versionCode > installed;

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
          <a
            href={downloadUrlFor(release, inApp)}
            rel="noopener"
            className="inline-block rounded-xl border border-accent bg-accent px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bg)]"
          >
            Actualizar a v{release.versionName}
          </a>
        </>
      ) : checked ? (
        <p className="text-xs text-subtle">La app está al día.</p>
      ) : null}
    </section>
  );
}
