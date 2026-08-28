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

// ── App de escritorio (Windows) ───────────────────────────────────────────

export interface DesktopRelease {
  versionCode: number;
  versionName: string;
  date: string;
  installerUrl: string;
  sizeMb: number;
  changes: string[];
}

/** True si la página corre dentro de la app de Windows. */
export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

/**
 * Versión instalada de la app de escritorio. Las anteriores a este aviso no
 * exponían su versión, así que cuentan como 1 y también reciben la novedad.
 */
export async function installedDesktopVersion(): Promise<number> {
  try {
    const tauri = (window as unknown as {
      __TAURI__?: { app?: { getVersion?: () => Promise<string> } };
    }).__TAURI__;
    const version = await tauri?.app?.getVersion?.();
    if (!version) return 1;
    // "1.0" → 1, "1.1" → 2, "1.2" → 3
    const menor = parseInt(version.split(".")[1] ?? "0", 10) || 0;
    return menor + 1;
  } catch {
    return 1;
  }
}

export async function fetchLatestDesktopRelease(): Promise<DesktopRelease | null> {
  try {
    const res = await fetch("/descargas/windows-version.json", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as DesktopRelease;
  } catch {
    return null;
  }
}

// ── Actualización dentro de la app de Windows ─────────────────────────────

interface PuenteTauri {
  core?: { invoke: (comando: string, args?: Record<string, unknown>) => Promise<unknown> };
  event?: {
    listen: (
      evento: string,
      manejador: (mensaje: { payload: unknown }) => void
    ) => Promise<() => void>;
  };
}

function tauri(): PuenteTauri | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { __TAURI__?: PuenteTauri }).__TAURI__ ?? null;
}

/** True si esta versión de la app sabe instalar sola la actualización. */
export function puedeActualizarseSola(): boolean {
  return Boolean(tauri()?.core?.invoke);
}

export interface AvanceDescarga {
  descargado: number;
  total: number;
}

/**
 * Baja el instalador y lo ejecuta, todo dentro de la app: nada de mandar a
 * la persona al navegador. Al terminar, la app se cierra y se vuelve a abrir
 * ya actualizada.
 */
export async function actualizarEscritorio(
  installerUrl: string,
  onAvance: (avance: AvanceDescarga) => void
): Promise<void> {
  const puente = tauri();
  if (!puente?.core?.invoke) throw new Error("Esta versión no sabe actualizarse sola");

  const url = new URL(installerUrl, window.location.origin).toString();

  let dejarDeEscuchar: (() => void) | undefined;
  if (puente.event?.listen) {
    dejarDeEscuchar = await puente.event.listen("actualizacion://progreso", (mensaje) => {
      onAvance(mensaje.payload as AvanceDescarga);
    });
  }

  try {
    const ruta = (await puente.core.invoke("descargar_actualizacion", { url })) as string;
    await puente.core.invoke("instalar_actualizacion", { ruta });
  } finally {
    dejarDeEscuchar?.();
  }
}

/**
 * True si esto corre dentro de una app instalada (Android o Windows) y no en
 * el navegador.
 *
 * Sirve para no ofrecerle a alguien que instale la app cuando ya la está
 * usando. En la web devuelve false y todo sigue igual que siempre.
 */
export function enAppInstalada(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { __TAURI__?: unknown; Capacitor?: { isNativePlatform?: () => boolean } };
  if (w.__TAURI__) return true;
  if (w.Capacitor?.isNativePlatform?.()) return true;
  // versiones viejas de la app no traen isNativePlatform, pero sí el marcador
  // que se agrega al user agent
  return isAndroidApp();
}
