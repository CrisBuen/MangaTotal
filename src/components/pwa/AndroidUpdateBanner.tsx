"use client";

import { useEffect, useState } from "react";
import {
  dismissVersion,
  fetchLatestRelease,
  installedVersionCode,
  isAndroidApp,
  isDismissed,
  type AndroidRelease,
} from "@/lib/appVersion";

/**
 * Aviso de actualización de la app Android. Solo aparece dentro de la app
 * y cuando hay una versión más nueva publicada. Si se pospone, queda
 * disponible en Perfil → Buscar actualizaciones.
 */
export function AndroidUpdateBanner() {
  const [release, setRelease] = useState<AndroidRelease | null>(null);

  useEffect(() => {
    if (!isAndroidApp()) return;
    fetchLatestRelease().then((latest) => {
      if (!latest) return;
      if (latest.versionCode <= installedVersionCode()) return;
      if (isDismissed(latest.versionCode)) return;
      setRelease(latest);
    });
  }, []);

  if (!release) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-24 z-[60] rounded-2xl border border-accent bg-panel p-4 shadow-[var(--glow)] backdrop-blur-xl lg:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      role="status"
      data-od-id="android-update-banner"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-accent bg-[var(--accent-soft)] text-accent">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M12 16 6 10h4V4h4v6h4zM5 18h14v2H5z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">
            Actualización disponible · v{release.versionName}
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
            {release.sizeMb} MB
          </p>
        </div>
      </div>

      <ul className="mb-4 space-y-1">
        {release.changes.slice(0, 4).map((change) => (
          <li key={change} className="flex gap-2 text-xs leading-5 text-subtle">
            <span className="text-accent">·</span>
            {change}
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <a
          href={release.apkUrl}
          download
          onClick={() => setRelease(null)}
          className="flex-1 rounded-xl border border-accent bg-accent px-4 py-2.5 text-center font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bg)]"
        >
          Actualizar
        </a>
        <button
          onClick={() => {
            dismissVersion(release.versionCode);
            setRelease(null);
          }}
          className="rounded-xl border border-line px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
