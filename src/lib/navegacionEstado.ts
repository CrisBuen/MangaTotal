"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MundoMangaTotal = "lectura" | "anime";
export type ModoLectura = "cascade" | "rtl";

export interface PosicionLector {
  page: number;
  ratio: number;
  chapterId?: string;
  updatedAt: number;
}

const CLAVE_ULTIMO_EXPLORAR_LECTURA = "mangatotal:ultimo-explorar:lectura";
const CLAVE_ULTIMO_EXPLORAR_ANIME = "mangatotal:ultimo-explorar:anime";
const CLAVE_ULTIMO_EXPLORAR_LEGADO = "mangatotal:ultimo-explorar";
const CLAVE_FUENTE_LECTURA = "mangatotal:fuente-lectura";
const CLAVE_FUENTE_ANIME = "mangatotal:fuente-anime";
const PREFIJO_ESTADO_FUENTE = "mangatotal:fuente-estado:";
const PREFIJO_MUNDO_URL = "mangatotal:mundo-url:";
const PREFIJO_SCROLL = "mangatotal:scroll:ruta:";
const CLAVE_PILA_NAV = "mangatotal:nav:pila";
const CLAVE_MODO_LECTURA = "mangatotal:modo-lectura";
const CLAVE_POSICIONES_LECTOR = "mangatotal:lector:posiciones";
const CLAVE_CAMBIO_CAPITULO = "mangatotal:lector:cambio-cap";
const PREFIJO_ORDEN_FICHA = "mangatotal:ficha:orden:";
const MAX_PILA_NAV = 40;
const MAX_POSICIONES_LECTOR = 60;

// Estado en memoria dentro de la pestaña para coordinar NavigationTracker,
// escribirUrlHistorial y useRestaurarScroll sin carreras ni ecos de Next.js.
let ultimaUrlCanonicaEscrita: string | null = null;
let ultimaEscrituraTs = 0;
let siguienteEsReemplazo = false;
let restaurandoScrollActivo = false;
let timerRestaurando: ReturnType<typeof setTimeout> | null = null;
const clavesParaIrArriba = new Set<string>();
const rutaSubscribers = new Set<(nuevaRuta: string, anteriorRuta: string | null, modo: "push" | "replace") => void>();
const flushersProgreso = new Set<() => void>();
const historialesPendientes = new Map<string, Promise<unknown>>();
let rutaActivaEnMemoria: string | null = null;

function enCliente(): boolean {
  return typeof window !== "undefined";
}

function leerSession(clave: string): string | null {
  if (!enCliente()) return null;
  try {
    return window.sessionStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribirSession(clave: string, valor: string): void {
  if (!enCliente()) return;
  try {
    window.sessionStorage.setItem(clave, valor);
  } catch {
    /* Modo privado o almacenamiento lleno: degradamos sin romper navegación. */
  }
}

function borrarSession(clave: string): void {
  if (!enCliente()) return;
  try {
    window.sessionStorage.removeItem(clave);
  } catch {
    /* Ignorar si sessionStorage no está disponible. */
  }
}

function leerLocal(clave: string): string | null {
  if (!enCliente()) return null;
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribirLocal(clave: string, valor: string): void {
  if (!enCliente()) return;
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    /* Ignorar si localStorage no está disponible. */
  }
}

/**
 * Normaliza pathname + search ordenando sus parámetros de forma determinista y
 * descartando parámetros vacíos y el #hash. Evita claves distintas cuando cambia
 * el orden de query params tras pushState/replaceState o enlaces externos.
 */
export function normalizarClaveRuta(pathname: string, search = ""): string {
  const rutaLimpia = (pathname || "/").split("#")[0].split("?")[0] || "/";
  const queryBruta = search.includes("?") ? search.split("?").slice(1).join("?") : search;
  const querySinHash = queryBruta.split("#")[0];
  if (!querySinHash) return rutaLimpia;

  const params = new URLSearchParams(querySinHash);
  const pares: [string, string][] = [];
  params.forEach((valor, clave) => {
    if (valor !== "") pares.push([clave, valor]);
  });
  if (pares.length === 0) return rutaLimpia;

  pares.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  const ordenado = new URLSearchParams();
  for (const [k, v] of pares) ordenado.append(k, v);
  const qs = ordenado.toString();
  return qs ? `${rutaLimpia}?${qs}` : rutaLimpia;
}

export function normalizarUrlRelativa(urlRelativa: string): string {
  if (!urlRelativa) return "/";
  const sinOrigen = urlRelativa.replace(/^https?:\/\/[^/]+/i, "");
  const sinHash = sinOrigen.split("#")[0] || "/";
  const idx = sinHash.indexOf("?");
  if (idx === -1) return sinHash || "/";
  return normalizarClaveRuta(sinHash.slice(0, idx), sinHash.slice(idx + 1));
}

export function obtenerRutaActualRelativa(): string {
  if (!enCliente()) return "/";
  return window.location.pathname + window.location.search;
}

export function obtenerClaveRutaActual(): string {
  if (!enCliente()) return "/";
  return normalizarClaveRuta(window.location.pathname, window.location.search);
}

/**
 * Clona `window.history.state` conservando propiedades de la app (`odAnimeSheet`, etc.)
 * pero omitiendo las marcas internas de Next.js 15 (`__NA`, `_N`, `__PRIVATE_NEXTJS_INTERNALS_TREE`).
 *
 * En `next@15.5.24`, pasar un objeto que ya trae `__NA: true` hace que Next.js
 * salte `applyUrlFromHistoryPushReplace` y deje `useSearchParams()` obsoleto; pasar `null`
 * destruye estado custom. Al omitir esas marcas, Next.js copia sus internos y sí sincroniza.
 */
function clonarEstadoParaNext(extra?: Record<string, unknown>): Record<string, unknown> | null {
  if (!enCliente()) return extra ?? null;
  const actual = window.history.state;
  const copia: Record<string, unknown> = {};
  if (actual && typeof actual === "object") {
    for (const [clave, valor] of Object.entries(actual as Record<string, unknown>)) {
      if (
        clave === "__NA" ||
        clave === "_N" ||
        clave === "__PRIVATE_NEXTJS_INTERNALS_TREE"
      ) {
        continue;
      }
      copia[clave] = valor;
    }
  }
  if (extra) {
    for (const [clave, valor] of Object.entries(extra)) {
      if (valor === undefined) delete copia[clave];
      else copia[clave] = valor;
    }
  }
  return Object.keys(copia).length > 0 ? copia : null;
}

export function marcarSiguienteComoReemplazo(): void {
  siguienteEsReemplazo = true;
}

export function consumirMarcaReemplazo(): boolean {
  const actual = siguienteEsReemplazo;
  siguienteEsReemplazo = false;
  return actual;
}

export function fueEscritaPorNosotros(pathname: string, search: string): boolean {
  if (!ultimaUrlCanonicaEscrita) return false;
  if (Date.now() - ultimaEscrituraTs > 2000) return false;
  return normalizarClaveRuta(pathname, search) === ultimaUrlCanonicaEscrita;
}

export function suscribirCambioRutaManual(
  cb: (nuevaRuta: string, anteriorRuta: string | null, modo: "push" | "replace") => void
): () => void {
  rutaSubscribers.add(cb);
  return () => {
    rutaSubscribers.delete(cb);
  };
}

/**
 * Escribe una URL en el historial del navegador de forma compatible con Next.js 15 App Router,
 * actualizando también la pila interna de navegación.
 */
export function escribirUrlHistorial(
  url: string | URL,
  modo: "push" | "replace",
  estadoExtra?: Record<string, unknown>,
  modoPila: "push" | "replace" = modo
): void {
  if (!enCliente()) return;
  const destino = typeof url === "string" ? new URL(url, window.location.origin) : url;
  const rutaDestino = destino.pathname + destino.search + destino.hash;
  const claveAnterior = obtenerClaveRutaActual();
  const claveNueva = normalizarClaveRuta(destino.pathname, destino.search);

  ultimaUrlCanonicaEscrita = claveNueva;
  ultimaEscrituraTs = Date.now();
  if (modoPila === "replace") {
    marcarSiguienteComoReemplazo();
  }

  const estado = clonarEstadoParaNext(estadoExtra);
  if (modo === "push") {
    window.history.pushState(estado, "", rutaDestino);
  } else {
    window.history.replaceState(estado, "", rutaDestino);
  }

  // Actualizamos nuestra pila interna sin esperar al startTransition asíncrono de Next.js.
  if (claveNueva !== claveAnterior || modoPila === "replace") {
    const rutaSinHash = destino.pathname + destino.search;
    registrarVisitaRuta(rutaSinHash, { reemplazar: modoPila === "replace" });
    rutaActivaEnMemoria = claveNueva;
    rutaSubscribers.forEach((cb) => cb(claveNueva, claveAnterior, modoPila));
  }
}

// ── Memoria por mundo y por fuente ─────────────────────────────────────────

export function guardarUltimoExplorar(mundo: MundoMangaTotal, urlRelativa: string): void {
  if (!urlRelativa.startsWith("/explorar")) return;
  if (mundo === "anime") {
    escribirSession(CLAVE_ULTIMO_EXPLORAR_ANIME, urlRelativa);
  } else {
    escribirSession(CLAVE_ULTIMO_EXPLORAR_LECTURA, urlRelativa);
    // Legado: solo Lectura lo escribe para no desviar fichas de manga hacia Anime.
    escribirSession(CLAVE_ULTIMO_EXPLORAR_LEGADO, urlRelativa);
  }
}

export function leerUltimoExplorar(mundo: MundoMangaTotal): string | null {
  if (mundo === "anime") {
    const u = leerSession(CLAVE_ULTIMO_EXPLORAR_ANIME);
    return u && u.startsWith("/explorar") ? u : null;
  }
  const u = leerSession(CLAVE_ULTIMO_EXPLORAR_LECTURA) ?? leerSession(CLAVE_ULTIMO_EXPLORAR_LEGADO);
  if (!u || !u.startsWith("/explorar")) return null;
  try {
    const parsed = new URL(u, "https://mangatotal.local");
    if (parsed.searchParams.get("seccion") === "animada") return null;
  } catch {
    return null;
  }
  return u;
}

export function guardarUltimaFuente(mundo: MundoMangaTotal, fuente: string): void {
  if (!fuente) return;
  escribirSession(mundo === "anime" ? CLAVE_FUENTE_ANIME : CLAVE_FUENTE_LECTURA, fuente);
}

export function leerUltimaFuente(mundo: MundoMangaTotal): string | null {
  return leerSession(mundo === "anime" ? CLAVE_FUENTE_ANIME : CLAVE_FUENTE_LECTURA);
}

export function guardarEstadoFuente(mundo: MundoMangaTotal, fuente: string, urlRelativa: string): void {
  if (!fuente || !urlRelativa.startsWith("/explorar")) return;
  escribirSession(`${PREFIJO_ESTADO_FUENTE}${mundo}:${fuente}`, urlRelativa);
}

export function leerEstadoFuente(mundo: MundoMangaTotal, fuente: string): string | null {
  if (!fuente) return null;
  const guardado = leerSession(`${PREFIJO_ESTADO_FUENTE}${mundo}:${fuente}`);
  return guardado && guardado.startsWith("/explorar") ? guardado : null;
}

export function guardarUltimaRutaMundo(mundo: MundoMangaTotal, urlRelativa: string): void {
  if (!urlRelativa || urlRelativa === "/") return;
  escribirSession(`${PREFIJO_MUNDO_URL}${mundo}`, urlRelativa);
}

export function leerUltimaRutaMundo(mundo: MundoMangaTotal): string | null {
  const url = leerSession(`${PREFIJO_MUNDO_URL}${mundo}`);
  if (!url || url === "/") return null;
  return url;
}

// ── Snapshots y restauración de scroll ─────────────────────────────────────

export function estaRestaurandoScroll(): boolean {
  return restaurandoScrollActivo;
}

function finalizarRestauracionScroll(): void {
  restaurandoScrollActivo = false;
  if (timerRestaurando) {
    clearTimeout(timerRestaurando);
    timerRestaurando = null;
  }
}

export function guardarScrollRuta(clave: string, y: number): void {
  if (!clave || !enCliente()) return;
  if (restaurandoScrollActivo) return;
  const valor = Math.round(y);
  if (valor <= 2) {
    borrarSession(PREFIJO_SCROLL + clave);
  } else {
    escribirSession(PREFIJO_SCROLL + clave, String(valor));
  }
}

export function leerScrollRuta(clave: string): number {
  if (!clave) return 0;
  const raw = leerSession(PREFIJO_SCROLL + clave);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 2 ? n : 0;
}

export function limpiarScrollRuta(clave: string): void {
  if (!clave) return;
  borrarSession(PREFIJO_SCROLL + clave);
}

/**
 * Marca que la ruta destino debe empezar arriba (p. ej. al pasar de página en
 * un catálogo), evitando que un scroll guardado viejo de esa página vuelva a
 * jalar hacia abajo cuando carguen sus tarjetas.
 */
export function marcarScrollArriba(clave: string): void {
  if (!clave) return;
  limpiarScrollRuta(clave);
  clavesParaIrArriba.add(clave);
  if (enCliente()) {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }
}

export function setRutaActivaMemoria(clave: string): void {
  rutaActivaEnMemoria = clave;
}

export function getRutaActivaMemoria(): string | null {
  return rutaActivaEnMemoria;
}

/**
 * Restaura el scroll guardado para `clave` una única vez por llegada,
 * esperando a que `listo === true` y reintentando brevemente ante cambios de altura
 * por hidratación o carga de imágenes sin pelear nunca con el desplazamiento manual.
 */
export function useRestaurarScroll(
  clave: string,
  listo: boolean,
  habilitado = true
): void {
  const claveRestauradaRef = useRef<string | null>(null);

  useEffect(() => {
    if (!habilitado || !listo || !clave || !enCliente()) {
      // Si volvió a cargar al cambiar de página por popstate, permitimos restaurar
      // una vez que los ítems de la nueva página terminen de renderizar.
      claveRestauradaRef.current = null;
      return;
    }
    if (claveRestauradaRef.current === clave) return;

    claveRestauradaRef.current = clave;
    if (clavesParaIrArriba.has(clave)) {
      clavesParaIrArriba.delete(clave);
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      return;
    }

    const objetivo = leerScrollRuta(clave);
    if (objetivo <= 2) return;

    let cancelado = false;
    restaurandoScrollActivo = true;
    if (timerRestaurando) clearTimeout(timerRestaurando);

    const detener = () => {
      if (cancelado) return;
      cancelado = true;
      observer?.disconnect();
      window.removeEventListener("wheel", detener);
      window.removeEventListener("touchmove", detener);
      window.removeEventListener("pointerdown", detener);
      window.removeEventListener("keydown", detener);
      finalizarRestauracionScroll();
    };

    const intentar = () => {
      if (cancelado) return;
      window.scrollTo({ top: objetivo, behavior: "instant" as ScrollBehavior });
      if (Math.abs(window.scrollY - objetivo) <= 4 && document.documentElement.scrollHeight >= objetivo + 40) {
        // Confirmamos en el siguiente frame para no soltar antes del render final.
        requestAnimationFrame(() => {
          if (!cancelado && Math.abs(window.scrollY - objetivo) <= 8) {
            detener();
          }
        });
      }
    };

    window.addEventListener("wheel", detener, { passive: true });
    window.addEventListener("touchmove", detener, { passive: true });
    window.addEventListener("pointerdown", detener, { passive: true });
    window.addEventListener("keydown", detener);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && document.body) {
      observer = new ResizeObserver(() => intentar());
      observer.observe(document.body);
    }

    const raf = requestAnimationFrame(() => intentar());
    const t1 = setTimeout(() => intentar(), 120);
    const t2 = setTimeout(() => intentar(), 320);
    const tFin = setTimeout(() => detener(), 1800);
    timerRestaurando = tFin;

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(tFin);
      detener();
    };
  }, [clave, listo, habilitado]);
}

// ── Pila interna de navegación (sustituye document.referrer roto en SPA) ──

function leerPilaBruta(): string[] {
  const raw = leerSession(CLAVE_PILA_NAV);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function guardarPilaBruta(pila: string[]): void {
  escribirSession(CLAVE_PILA_NAV, JSON.stringify(pila.slice(-MAX_PILA_NAV)));
}

export function registrarVisitaRuta(
  urlRelativa: string,
  opts?: { esPop?: boolean; reemplazar?: boolean }
): string[] {
  const normalizada = normalizarUrlRelativa(urlRelativa);
  const pila = leerPilaBruta();

  if (pila.length === 0) {
    const inicial = [normalizada];
    guardarPilaBruta(inicial);
    return inicial;
  }

  const ultimo = pila[pila.length - 1];
  if (opts?.esPop) {
    // Si venimos de atrás, recortamos hasta la coincidencia más cercana en la cola reciente.
    for (let i = pila.length - 2; i >= Math.max(0, pila.length - 10); i--) {
      if (pila[i] === normalizada) {
        const recortada = pila.slice(0, i + 1);
        guardarPilaBruta(recortada);
        return recortada;
      }
    }
    if (ultimo !== normalizada) {
      const nueva = [...pila, normalizada];
      guardarPilaBruta(nueva);
      return nueva;
    }
    return pila;
  }

  if (opts?.reemplazar) {
    const reemplazada = [...pila.slice(0, -1), normalizada];
    guardarPilaBruta(reemplazada);
    return reemplazada;
  }

  if (ultimo === normalizada) return pila;
  const siguiente = [...pila, normalizada];
  guardarPilaBruta(siguiente);
  return siguiente;
}

export function obtenerRutaAnteriorInterna(): string | null {
  const pila = leerPilaBruta();
  if (pila.length < 2) return null;
  return pila[pila.length - 2];
}

export function esRutaLectorOPlayer(ruta: string): boolean {
  const path = ruta.split("?")[0];
  if (path.startsWith("/leer/") || path.startsWith("/leer-externo/")) return true;
  if (/^\/(explorar|anime)\/(jkanime|tioanime|mundodonghua|hentaitv)\/[^/]+\/[^/]+/.test(path)) {
    return true;
  }
  return false;
}

export function puedeVolverInterno(filtro?: (anterior: string) => boolean): boolean {
  if (!enCliente()) return false;
  const anterior = obtenerRutaAnteriorInterna();
  if (!anterior) return false;
  if (window.history.length <= 1) return false;
  return filtro ? filtro(anterior) : true;
}

export function navegarAtrasInteligente(
  router: { push: (href: string) => void; replace?: (href: string) => void },
  fallbackHref: string,
  opciones?: {
    evitarLector?: boolean;
    replaceFallback?: boolean;
    soloSiDistintoDe?: string;
  }
): void {
  const anterior = obtenerRutaAnteriorInterna();
  const actual = obtenerClaveRutaActual();
  const puede =
    Boolean(anterior) &&
    enCliente() &&
    window.history.length > 1 &&
    anterior !== actual &&
    (!opciones?.soloSiDistintoDe || anterior !== normalizarUrlRelativa(opciones.soloSiDistintoDe)) &&
    (!opciones?.evitarLector || !esRutaLectorOPlayer(anterior!));

  if (puede) {
    window.history.back();
    return;
  }
  if (opciones?.replaceFallback && router.replace) {
    marcarSiguienteComoReemplazo();
    router.replace(fallbackHref);
  } else {
    router.push(fallbackHref);
  }
}

// ── Estado del lector, modo preferido, flusher global y carreras de historial ──

export function leerModoLecturaPreferido(respaldo: ModoLectura = "cascade"): ModoLectura {
  const guardado = leerLocal(CLAVE_MODO_LECTURA);
  if (guardado === "rtl" || guardado === "cascade") return guardado;
  return respaldo;
}

export function guardarModoLecturaPreferido(modo: ModoLectura): void {
  escribirLocal(CLAVE_MODO_LECTURA, modo);
}

function leerMapaPosiciones(): Record<string, PosicionLector> {
  const raw = leerLocal(CLAVE_POSICIONES_LECTOR);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, PosicionLector>) : {};
  } catch {
    return {};
  }
}

export function guardarPosicionLector(
  clave: string,
  datos: { page: number; ratio?: number; chapterId?: string; updatedAt?: number }
): void {
  if (!clave || !enCliente()) return;
  const mapa = leerMapaPosiciones();
  const paginaNormalizada = Math.max(1, Math.trunc(datos.page || 1));
  const previa = mapa[clave];
  // Si quien guarda solo informa página (p. ej. debounce de Reader), conservar el
  // desplazamiento sub-página de la misma página en lugar de pisarlo con 0.
  const ratioFinal =
    datos.ratio !== undefined
      ? Math.min(0.96, Math.max(0, Number(datos.ratio) || 0))
      : previa && previa.page === paginaNormalizada
        ? Math.min(0.96, Math.max(0, Number(previa.ratio ?? 0) || 0))
        : 0;

  mapa[clave] = {
    page: paginaNormalizada,
    ratio: ratioFinal,
    chapterId: datos.chapterId ?? previa?.chapterId,
    updatedAt: datos.updatedAt ?? Date.now(),
  };

  // Mantener tope LRU para no llenar localStorage en cuentas con mucha lectura.
  const entradas = Object.entries(mapa).sort(
    (a, b) => (b[1]?.updatedAt ?? 0) - (a[1]?.updatedAt ?? 0)
  );
  const recortado = Object.fromEntries(entradas.slice(0, MAX_POSICIONES_LECTOR));
  escribirLocal(CLAVE_POSICIONES_LECTOR, JSON.stringify(recortado));
}

export function leerPosicionLector(clave: string): PosicionLector | null {
  if (!clave) return null;
  const mapa = leerMapaPosiciones();
  return mapa[clave] ?? null;
}

export function registrarFlusherProgreso(fn: () => void): () => void {
  flushersProgreso.add(fn);
  return () => {
    flushersProgreso.delete(fn);
  };
}

export function ejecutarFlushProgresoGlobal(): void {
  flushersProgreso.forEach((fn) => {
    try {
      fn();
    } catch {
      /* Un flusher fallido no debe bloquear los demás. */
    }
  });
}

export function claveHistorialPendiente(source: string, externalId: string): string {
  return `${source}:${externalId}`;
}

export function registrarPromesaHistorial(clave: string, promesa: Promise<unknown>): void {
  if (!clave) return;
  const envuelta = promesa.catch(() => undefined).finally(() => {
    if (historialesPendientes.get(clave) === envuelta) {
      historialesPendientes.delete(clave);
    }
  });
  historialesPendientes.set(clave, envuelta);
}

export async function esperarHistorialPendiente(
  clave: string,
  timeoutMs = 800
): Promise<void> {
  const pendiente = historialesPendientes.get(clave);
  if (!pendiente) return;
  await Promise.race([
    pendiente,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export function marcarCambioCapituloLector(): void {
  escribirSession(CLAVE_CAMBIO_CAPITULO, String(Date.now()));
}

export function esCambioCapituloLector(consumir = false): boolean {
  const raw = leerSession(CLAVE_CAMBIO_CAPITULO);
  if (!raw) return false;
  const ts = parseInt(raw, 10);
  const valido = Number.isFinite(ts) && Date.now() - ts < 3000;
  if (consumir || !valido) borrarSession(CLAVE_CAMBIO_CAPITULO);
  return valido;
}

/** Hook pequeño para fichas externas: recuerda el orden de capítulos (e idioma en MangaDex). */
export function useEstadoFicha<T extends Record<string, string>>(
  claveFicha: string,
  valoresPorDefecto: T
): [T, (parcial: Partial<T>) => void] {
  const key = `${PREFIJO_ORDEN_FICHA}${claveFicha}`;
  const [estado, setEstado] = useState<T>(valoresPorDefecto);

  useEffect(() => {
    const raw = leerSession(key);
    if (!raw) {
      setEstado(valoresPorDefecto);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<T>;
      setEstado((actual) => ({ ...actual, ...parsed }));
    } catch {
      /* Ignorar JSON corrupto. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const actualizar = useCallback(
    (parcial: Partial<T>) => {
      setEstado((previo) => {
        const siguiente = { ...previo, ...parcial };
        escribirSession(key, JSON.stringify(siguiente));
        return siguiente;
      });
    },
    [key]
  );

  return [estado, actualizar];
}
