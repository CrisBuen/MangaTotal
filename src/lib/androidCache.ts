"use client";

import { isAndroidApp } from "./appVersion";

const CACHE_NAME = "android-local-data-v1";
const MAX_ENTRIES = 96;
const DEFAULT_MAX_AGE = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT = 12_000;

interface EntradaCache<T> {
  value: T;
  savedAt: number;
}

export interface AndroidCacheOptions<T> {
  privateData?: boolean;
  /** Durante este tiempo ni siquiera se gasta red: la copia local alcanza. */
  freshForMs?: number;
  /** Una copia más vieja que esto se descarta por completo. */
  maxAgeMs?: number;
  timeoutMs?: number;
  force?: boolean;
  onCached?: (value: T) => void;
}

function disponible(): boolean {
  return typeof window !== "undefined" && isAndroidApp() && "caches" in window;
}

function requestDe(clave: string, privada: boolean): Request {
  const tipo = privada ? "privado" : "publico";
  return new Request(
    `${window.location.origin}/__android_cache__/${tipo}/${encodeURIComponent(clave)}`
  );
}

/** Lee datos persistidos dentro del WebView. Nunca se usa en web ni Windows. */
export async function leerCacheAndroid<T>(
  clave: string,
  opciones: Pick<AndroidCacheOptions<T>, "privateData" | "maxAgeMs"> = {}
): Promise<EntradaCache<T> | null> {
  if (!disponible()) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const respuesta = await cache.match(requestDe(clave, Boolean(opciones.privateData)));
    if (!respuesta) return null;
    const entrada = (await respuesta.json()) as EntradaCache<T>;
    const maxAge = opciones.maxAgeMs ?? DEFAULT_MAX_AGE;
    if (!entrada || Date.now() - entrada.savedAt > maxAge) {
      await cache.delete(requestDe(clave, Boolean(opciones.privateData)));
      return null;
    }
    return entrada;
  } catch {
    return null;
  }
}

/** Guarda solo JSON pequeño (catálogos y estado), nunca páginas ni videos. */
export async function guardarCacheAndroid<T>(
  clave: string,
  value: T,
  opciones: Pick<AndroidCacheOptions<T>, "privateData"> = {}
): Promise<void> {
  if (!disponible()) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      requestDe(clave, Boolean(opciones.privateData)),
      new Response(JSON.stringify({ value, savedAt: Date.now() }), {
        headers: { "content-type": "application/json; charset=utf-8" },
      })
    );

    // Evita que búsquedas y filtros distintos hagan crecer la app sin límite.
    const entradas = await cache.keys();
    const sesion = requestDe("sesion:me", true).url;
    const candidatas = [
      ...entradas.filter((entrada) => entrada.url.includes("/__android_cache__/publico/")),
      ...entradas.filter(
        (entrada) =>
          entrada.url.includes("/__android_cache__/privado/") && entrada.url !== sesion
      ),
    ];
    for (const vieja of candidatas.slice(0, Math.max(0, entradas.length - MAX_ENTRIES))) {
      await cache.delete(vieja);
    }
  } catch {
    // Si Android se quedó sin espacio, se sigue por red con normalidad.
  }
}

/** Al cerrar sesión no puede quedar visible la biblioteca de otra cuenta. */
export async function borrarCachePrivadaAndroid(): Promise<void> {
  if (!disponible()) return;
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
  if (!disponible()) return fetch(input, init);
  const controlador = new AbortController();
  const temporizador = window.setTimeout(() => controlador.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controlador.signal });
  } finally {
    window.clearTimeout(temporizador);
  }
}

/**
 * En Android muestra primero la copia del teléfono y la revalida después.
 * Con mala señal conserva lo último válido en vez de vaciar toda la grilla.
 */
export async function cargarConCacheAndroid<T>(
  clave: string,
  cargar: (signal: AbortSignal) => Promise<T>,
  opciones: AndroidCacheOptions<T> = {}
): Promise<T> {
  if (!disponible()) return cargar(new AbortController().signal);

  const cache = await leerCacheAndroid<T>(clave, opciones);
  if (cache) opciones.onCached?.(cache.value);

  const fresca = cache && Date.now() - cache.savedAt <= (opciones.freshForMs ?? 0);
  const sinRed = typeof navigator !== "undefined" && navigator.onLine === false;
  const alFondo = typeof document !== "undefined" && document.visibilityState !== "visible";

  if (cache && !opciones.force && (fresca || sinRed || alFondo)) return cache.value;

  try {
    const value = await conLimite(cargar, opciones.timeoutMs ?? DEFAULT_TIMEOUT);
    await guardarCacheAndroid(clave, value, opciones);
    return value;
  } catch (error) {
    if (cache) return cache.value;
    throw error;
  }
}
