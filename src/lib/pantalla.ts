/**
 * Pantalla completa, según dónde corra la app.
 *
 * En Android no alcanza con la API del navegador: esa solo agranda la página
 * dentro de la ventana, y la barra de estado de arriba y la de gestos de
 * abajo siguen tapando la lectura. Esconderlas es cosa del sistema, así que
 * ahí se le pide al puente nativo (ver mobile/patches/PantallaPlugin.java).
 *
 * En la web y en Windows se usa la del navegador, que es lo que hay.
 */

interface PluginPantalla {
  inmersiva(opciones: { activa: boolean }): Promise<void>;
}

function pluginPantalla(): PluginPantalla | null {
  if (typeof window === "undefined") return null;
  const p = (
    window as unknown as { Capacitor?: { Plugins?: { Pantalla?: PluginPantalla } } }
  ).Capacitor?.Plugins?.Pantalla;
  return p?.inmersiva ? p : null;
}

/** True si esto corre dentro de la app de Android. */
export function enAppAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/MangaTotalApp\//.test(navigator.userAgent)) return true;
  // el WebView de Android se identifica con "; wv)" y Chrome no
  return /Android/.test(navigator.userAgent) && /\bwv\b/.test(navigator.userAgent);
}

/**
 * True si esta plataforma esconde también las barras del sistema.
 *
 * Donde no, conviene dejar a la vista el botón de salir de pantalla completa:
 * sin barras del sistema que lo recuerden, se puede quedar sin saber cómo
 * volver.
 */
export function pantallaCompletaEsTotal(): boolean {
  return pluginPantalla() !== null;
}

export async function activarPantallaCompleta(): Promise<void> {
  const nativo = pluginPantalla();
  if (nativo) {
    await nativo.inmersiva({ activa: true }).catch(() => {});
    return;
  }
  await document.documentElement.requestFullscreen?.().catch(() => {});
}

export async function salirPantallaCompleta(): Promise<void> {
  const nativo = pluginPantalla();
  if (nativo) {
    await nativo.inmersiva({ activa: false }).catch(() => {});
    return;
  }
  if (document.fullscreenElement) await document.exitFullscreen?.().catch(() => {});
}
