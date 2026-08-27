/**
 * Detección de la app Android y de su versión instalada.
 *
 * La app agrega `MangaTotalApp/<n>` al user agent (ver `appendUserAgent` en
 * mobile/capacitor.config.json). Las versiones anteriores a ese cambio no
 * lo traen, así que se las considera versión 1 y también reciben el aviso.
 */

export interface AndroidRelease {
  versionCode: number;
  versionName: string;
  date: string;
  apkUrl: string;
  /** Copia en otro dominio: el WebView de la app no descarga del propio sitio. */
  apkExternalUrl?: string;
  sizeMb: number;
  changes: string[];
}

/** True si la página corre dentro de la app Android (WebView), no en Chrome. */
export function isAndroidApp(userAgent = navigator.userAgent): boolean {
  if (/MangaTotalApp\//.test(userAgent)) return true;
  // el WebView de Android se identifica con "; wv)" y Chrome no
  return /Android/.test(userAgent) && /\bwv\b/.test(userAgent);
}

/** Versión de la app instalada, o 1 si es anterior al marcador. */
export function installedVersionCode(userAgent = navigator.userAgent): number {
  const match = /MangaTotalApp\/(\d+)/.exec(userAgent);
  return match ? parseInt(match[1], 10) : 1;
}

export async function fetchLatestRelease(): Promise<AndroidRelease | null> {
  try {
    const res = await fetch("/descargas/android-version.json", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AndroidRelease;
  } catch {
    return null;
  }
}

const DISMISSED_KEY = "mangatotal:update-dismissed";

/** Recordar que se pospuso una versión (queda disponible en Perfil). */
export function dismissVersion(versionCode: number): void {
  try {
    localStorage.setItem(DISMISSED_KEY, String(versionCode));
  } catch {
    // modo incógnito o almacenamiento bloqueado: se vuelve a avisar
  }
}

export function isDismissed(versionCode: number): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === String(versionCode);
  } catch {
    return false;
  }
}

/**
 * Enlace de descarga que corresponde según dónde se esté.
 * Dentro de la app conviene el dominio externo: Capacitor abre esos
 * enlaces en el navegador del sistema, que sí sabe descargar el APK.
 */
export function downloadUrlFor(release: AndroidRelease, inApp: boolean): string {
  if (!inApp) return release.apkUrl;
  // Desde la versión 3 la app descarga e instala por su cuenta, así que
  // conviene el enlace del propio sitio. Las anteriores no sabían descargar:
  // para esas se usa el dominio externo, que Capacitor manda al navegador.
  if (installedVersionCode() >= 3) return release.apkUrl;
  return release.apkExternalUrl ?? release.apkUrl;
}
