"use client";

import { isAndroidApp } from "./appVersion";

const CACHE_NAME = "android-local-data-v1";
const MAX_ENTRIES = 240;
const DEFAULT_MAX_AGE = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT = 20_000;

interface EntradaCache<T> {
  value: T;
  savedAt: number;
}

/** Caché en memoria RAM para respuestas instantáneas (0 ms) al navegar entre catálogo, serie y lector. */
const memoriaCache = new Map<string, EntradaCache<unknown>>();
/** Deduplicación de peticiones en curso para no disparar dos veces la misma consulta. */
const enVuelo = new Map<string, Promise<unknown>>();

function claveMemoria(clave: string, privada: boolean): string {
  return `${privada ? "priv" : "pub"}:${clave}`;
}

function guardarEnMemoria<T>(clave: string, privada: boolean, entrada: EntradaCache<T>): void {
  const k = claveMemoria(clave, privada);
  if (memoriaCache.has(k)) memoriaCache.delete(k);
  memoriaCache.set(k, entrada);
  if (memoriaCache.size > MAX_ENTRIES) {
    const primera = memoriaCache.keys().next().value;
    if (primera !== undefined) memoriaCache.delete(primera);
  }
}

/**
 * Detecta si el dispositivo reporta ahorro de datos o señal móvil lenta (2G / 3G / H+).
 */
export function esConexionLenta(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean; downlink?: number };
  }).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  if (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g" || conn.effectiveType === "3g") {
    return true;
  }
  if (typeof conn.downlink === "number" && conn.downlink > 0 && conn.downlink < 1.5) {
    return true;
  }
  return false;
}

export interface AndroidCacheOptions<T> {
  privateData?: boolean;
  /** Opt-in para JSON público de catálogo en web/Windows; nunca sesión o biblioteca. */
  publicCache?: boolean;
  /** Durante este tiempo ni siquiera se gasta red: la copia local alcanza. */
  freshForMs?: number;
  /** Una copia más vieja que esto se descarta por completo. */
  maxAgeMs?: number;
  timeoutMs?: number;
  force?: boolean;
  onCached?: (value: T) => void;
}

function disponible(opciones: { publicCache?: boolean; privateData?: boolean } = {}): boolean {
  return typeof window !== "undefined" && (
    isAndroidApp() || !opciones.privateData || opciones.publicCache === true
  );
}

function requestDe(clave: string, privada: boolean): Request {
  const tipo = privada ? "privado" : "publico";
  return new Request(
    `${window.location.origin}/__android_cache__/${tipo}/${encodeURIComponent(clave)}`
  );
}

/** Lee primero de RAM (0 ms) y luego de CacheStorage en las 4 plataformas. */
export async function leerCacheAndroid<T>(
  clave: string,
  opciones: Pick<AndroidCacheOptions<T>, "privateData" | "maxAgeMs" | "publicCache"> = {}
): Promise<EntradaCache<T> | null> {
  if (!disponible(opciones)) return null;
  const privada = Boolean(opciones.privateData);
  const maxAge = opciones.maxAgeMs ?? DEFAULT_MAX_AGE;
  const kMem = claveMemoria(clave, privada);
  const enMem = memoriaCache.get(kMem) as EntradaCache<T> | undefined;
  if (enMem) {
    if (Date.now() - enMem.savedAt <= maxAge) {
      return enMem;
    }
    memoriaCache.delete(kMem);
  }

  if (!("caches" in window)) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const respuesta = await cache.match(requestDe(clave, privada));
    if (!respuesta) return null;
    const entrada = (await respuesta.json()) as EntradaCache<T>;
    if (!entrada || Date.now() - entrada.savedAt > maxAge) {
      await cache.delete(requestDe(clave, privada));
      return null;
    }
    guardarEnMemoria(clave, privada, entrada);
    return entrada;
  } catch {
    return null;
  }
}

/** Guarda solo JSON pequeño (catálogos, fichas y estado), nunca páginas ni videos. */
export async function guardarCacheAndroid<T>(
  clave: string,
  value: T,
  opciones: Pick<AndroidCacheOptions<T>, "privateData" | "publicCache"> = {}
): Promise<void> {
  if (!disponible(opciones)) return;
  const privada = Boolean(opciones.privateData);
  const entrada: EntradaCache<T> = { value, savedAt: Date.now() };
  guardarEnMemoria(clave, privada, entrada);

  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      requestDe(clave, privada),
      new Response(JSON.stringify(entrada), {
        headers: { "content-type": "application/json; charset=utf-8" },
      })
    );

    // Evita que búsquedas y filtros distintos hagan crecer la app sin límite.
    const entradas = await cache.keys();
    if (entradas.length <= MAX_ENTRIES) return;
    const sesion = requestDe("sesion:me", true).url;
    const candidatas = [
      ...entradas.filter((item) => item.url.includes("/__android_cache__/publico/")),
      ...entradas.filter(
        (item) =>
          item.url.includes("/__android_cache__/privado/") && item.url !== sesion
      ),
    ];
    for (const vieja of candidatas.slice(0, Math.max(0, entradas.length - MAX_ENTRIES))) {
      await cache.delete(vieja);
    }
  } catch {
    // Si el dispositivo se quedó sin espacio, se sigue con RAM y red con normalidad.
  }
}

/** Al cerrar sesión no puede quedar visible la biblioteca de otra cuenta. */
export async function borrarCachePrivadaAndroid(): Promise<void> {
  for (const k of Array.from(memoriaCache.keys())) {
    if (k.startsWith("priv:")) memoriaCache.delete(k);
  }
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const entradas = await cache.keys();
    await Promise.all(
      entradas
        .filter((entrada) => new URL(entrada.url).pathname.includes("/__android_cache__/privado/"))
        .map((entrada) => cache.delete(entrada))
    );
  } catch {
    // Cerrar sesión no depende de que la limpieza local haya funcionado.
  }
}

async function conLimite<T>(
  cargar: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controlador = new AbortController();
  const temporizador = window.setTimeout(() => controlador.abort(), timeoutMs);
  try {
    return await cargar(controlador.signal);
  } finally {
    window.clearTimeout(temporizador);
  }
}

/** Fetch abortable para que una señal casi caída no deje la interfaz colgada. */
export async function fetchConLimiteAndroid(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT
): Promise<Response> {
  if (typeof window === "undefined") return fetch(input, init);
  const limite = esConexionLenta() ? Math.max(timeoutMs, 26_000) : timeoutMs;
  const controlador = new AbortController();
  const temporizador = window.setTimeout(() => controlador.abort(), limite);
  try {
    return await fetch(input, { ...init, signal: controlador.signal });
  } finally {
    window.clearTimeout(temporizador);
  }
}

/**
 * Muestra primero la copia local (RAM o CacheStorage) en las 4 plataformas.
 * Con mala señal (H+ / 3G / 2G) extiende la vigencia de la caché y conserva lo último válido.
 */
export async function cargarConCacheAndroid<T>(
  clave: string,
  cargar: (signal: AbortSignal) => Promise<T>,
  opciones: AndroidCacheOptions<T> = {}
): Promise<T> {
  const publico = !opciones.privateData && typeof window !== "undefined";
  if (!disponible(opciones) && !publico) return cargar(new AbortController().signal);

  const privada = Boolean(opciones.privateData);
  const kMem = claveMemoria(clave, privada);
  const maxAge = opciones.maxAgeMs ?? DEFAULT_MAX_AGE;

  // 1. Lectura síncrona inmediata desde RAM si existe
  const enMem = memoriaCache.get(kMem) as EntradaCache<T> | undefined;
  let cache: EntradaCache<T> | null = null;
  if (enMem && Date.now() - enMem.savedAt <= maxAge) {
    cache = enMem;
    opciones.onCached?.(cache.value);
  } else {
    cache = await leerCacheAndroid<T>(clave, opciones);
    if (cache) opciones.onCached?.(cache.value);
  }

  const conexionLenta = esConexionLenta();
  const baseFreshMs = opciones.freshForMs ?? 0;
  // En conexión lenta (H+ / 3G) extendemos la validez de la caché para ahorrar datos y tiempo
  const freshMsEfectivo =
    conexionLenta && baseFreshMs > 0 ? Math.max(baseFreshMs * 3, 20 * 60_000) : baseFreshMs;

  const fresca = cache && Date.now() - cache.savedAt <= freshMsEfectivo;
  const sinRed = typeof navigator !== "undefined" && navigator.onLine === false;
  const alFondo = typeof document !== "undefined" && document.visibilityState !== "visible";

  if (cache && !opciones.force && (fresca || sinRed || alFondo)) return cache.value;

  const timeoutEfectivo = conexionLenta
    ? Math.max(opciones.timeoutMs ?? DEFAULT_TIMEOUT, 28_000)
    : (opciones.timeoutMs ?? DEFAULT_TIMEOUT);

  // Deduplicar peticiones idénticas en vuelo cuando no es forzada
  if (!opciones.force) {
    const existente = enVuelo.get(kMem) as Promise<T> | undefined;
    if (existente) {
      try {
        return await existente;
      } catch (error) {
        if (cache) return cache.value;
        throw error;
      }
    }
  }

  const promesa = (async () => {
    const value = await conLimite(cargar, timeoutEfectivo);
    const esCatalogoVacio =
      clave.startsWith("explorar:") &&
      value !== null &&
      typeof value === "object" &&
      "series" in (value as Record<string, unknown>) &&
      Array.isArray((value as unknown as { series?: unknown[] }).series) &&
      (value as unknown as { series: unknown[] }).series.length === 0;
    if (!esCatalogoVacio) {
      await guardarCacheAndroid(clave, value, opciones);
    }
    return value;
  })();

  if (!opciones.force) {
    enVuelo.set(kMem, promesa);
  }

  try {
    return await promesa;
  } catch (error) {
    if (cache) return cache.value;
    throw error;
  } finally {
    if (enVuelo.get(kMem) === promesa) {
      enVuelo.delete(kMem);
    }
  }
}
