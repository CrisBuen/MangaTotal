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
  orientacion?(opciones: { horizontal: boolean }): Promise<void>;
}

interface CapacitorGlobal {
  Plugins?: { Pantalla?: PluginPantalla };
  registerPlugin?: (nombre: string) => PluginPantalla;
}

let recordado: PluginPantalla | null | undefined;

/**
 * El plugin nativo, buscado por los dos caminos.
 *
 * `Capacitor.Plugins` solo tiene los plugins que traen su parte en
 * JavaScript. Los que son solo nativos —como este— hay que pedirlos con
 * `registerPlugin`, y si se busca únicamente en `Plugins` no aparece nunca:
 * la app se comporta como si el puente no existiera y la barra de estado
 * sigue tapando la lectura.
 */
function pluginPantalla(): PluginPantalla | null {
  if (recordado !== undefined) return recordado;
  if (typeof window === "undefined") return (recordado = null);

  const capacitor = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!capacitor) return (recordado = null);

  const directo = capacitor.Plugins?.Pantalla;
  if (directo?.inmersiva) return (recordado = directo);

  if (typeof capacitor.registerPlugin === "function") {
    try {
      const p = capacitor.registerPlugin("Pantalla");
      // devuelve un intermediario aunque el plugin no exista; en la web y
      // en Windows no se llega hasta acá porque no hay Capacitor
      if (p) return (recordado = p);
    } catch {
      // no está registrado en esta plataforma
    }
  }
  return (recordado = null);
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

interface OrientacionNavegador {
  lock?: (orientacion: "landscape") => Promise<void>;
  unlock?: () => void;
}

async function orientarConNavegador(horizontal: boolean): Promise<void> {
  if (typeof screen === "undefined") return;
  const orientacion = screen.orientation as OrientacionNavegador | undefined;
  if (horizontal) {
    await orientacion?.lock?.("landscape").catch(() => {});
  } else {
    orientacion?.unlock?.();
  }
}

/**
 * Modo de reproducción de video en Android.
 *
 * A diferencia de la lectura, el video además fuerza paisaje. Queda separado
 * para que cualquier proveedor animado futuro reutilice exactamente la misma
 * entrada y salida sin acoplarse a JKAnime.
 */
export async function activarReproductorHorizontalAndroid(): Promise<void> {
  const nativo = pluginPantalla();
  if (nativo) {
    await nativo.inmersiva({ activa: true }).catch(() => {});
    const orientada = nativo.orientacion
      ? await nativo.orientacion({ horizontal: true }).then(() => true).catch(() => false)
      : false;
    if (!orientada) await orientarConNavegador(true);
    return;
  }

  await activarPantallaCompleta();
  await orientarConNavegador(true);
}

/** Devuelve orientación y barras al estado normal al abandonar el episodio. */
export async function salirReproductorHorizontalAndroid(): Promise<void> {
  const nativo = pluginPantalla();
  if (nativo) {
    await nativo.orientacion?.({ horizontal: false }).catch(() => {});
    await nativo.inmersiva({ activa: false }).catch(() => {});
  } else {
    await orientarConNavegador(false);
    await salirPantallaCompleta();
  }
}
