/**
 * Puente para leer sitios que bloquean a los servidores.
 *
 * Algunas fuentes (ZonaTMO, Ikigai) rechazan las peticiones que vienen de
 * centros de datos: desde Vercel responden 403, aunque desde una conexión
 * hogareña aceptan cualquier cliente. Por eso sus páginas se piden desde el
 * dispositivo de cada persona, igual que hace Mihon:
 *
 *   · Android  → puente nativo de Capacitor
 *   · Windows  → puente nativo de Tauri
 *   · Web      → no disponible (un sitio no puede leer otro)
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** El puente nativo de Android, con los mismos nombres que el de Windows. */
interface PluginFuentes {
  traerPagina(opciones: {
    url: string;
    userAgent: string | null;
  }): Promise<{ status: number; data: string }>;
  resolverDesafio(opciones: { url: string; userAgent: string | null }): Promise<{ ok: boolean }>;
  limpiarVerificacion(): Promise<void>;
}

interface Puente {
  get(opciones: { url: string; headers?: Record<string, string> }): Promise<{
    status: number;
    /** El puente de Capacitor devuelve un objeto cuando la respuesta es JSON. */
    data: string | object;
  }>;
}

function capacitorPlugins() {
  if (typeof window === "undefined") return null;
  return (
    window as unknown as {
      Capacitor?: { Plugins?: { CapacitorHttp?: Puente; Fuentes?: PluginFuentes } };
    }
  ).Capacitor?.Plugins;
}

function pluginFuentes(): PluginFuentes | null {
  const p = capacitorPlugins()?.Fuentes;
  return p?.traerPagina ? p : null;
}

/**
 * Traduce el aviso del puente nativo.
 *
 * Los dos puentes avisan igual —con un texto que empieza en DESAFIO:— pero
 * cada plataforma lo envuelve a su manera, así que se busca la marca en vez
 * de comparar el mensaje entero.
 */
function comoDesafio(err: unknown): unknown {
  const aviso = err instanceof Error ? err.message : String(err);
  const marca = aviso.indexOf("DESAFIO:");
  if (marca === -1) return err;
  return new DesafioPendiente(aviso.slice(marca + "DESAFIO:".length).trim());
}

function puente(): Puente | null {
  if (typeof window === "undefined") return null;

  // la app de Android trae su propio puente: adjunta el permiso de Cloudflare
  // que dejó la ventana de verificación, y avisa cuando hay que pedirlo
  const fuentes = pluginFuentes();
  if (fuentes) {
    return {
      async get({ url }) {
        try {
          return await fuentes.traerPagina({ url, userAgent: userAgentElegido() });
        } catch (err) {
          throw comoDesafio(err);
        }
      },
    };
  }

  const capacitorHttp = capacitorPlugins()?.CapacitorHttp;
  if (capacitorHttp) return capacitorHttp;

  const tauri = (window as unknown as {
    __TAURI__?: {
      core?: { invoke: (comando: string, args?: Record<string, unknown>) => Promise<unknown> };
      http?: { fetch: (url: string, init?: RequestInit) => Promise<Response> };
    };
  }).__TAURI__;

  // la app de escritorio trae su propio comando: pide la página desde la
  // conexión de la persona y devuelve el HTML
  if (tauri?.core?.invoke) {
    return {
      async get({ url }) {
        try {
          const html = (await tauri.core!.invoke("traer_pagina", {
            url,
            userAgent: userAgentElegido(),
          })) as string;
          return { status: 200, data: html };
        } catch (err) {
          // el comando avisa así cuando Cloudflare pide verificar
          throw comoDesafio(err);
        }
      },
    };
  }

  if (tauri?.http?.fetch) {
    return {
      async get({ url, headers }) {
        const res = await tauri.http!.fetch(url, { headers });
        return { status: res.status, data: await res.text() };
      },
    };
  }

  return null;
}

/** True si esta plataforma puede leer fuentes que bloquean servidores. */
export function fuenteNativaDisponible(): boolean {
  return puente() !== null;
}

/** Pide una página y la devuelve lista para consultar con selectores. */
export async function traerDocumento(url: string): Promise<Document> {
  const nativo = puente();
  if (!nativo) {
    throw new Error("Esta fuente solo está disponible en la app de Android o de Windows");
  }

  const res = await nativo.get({
    url,
    headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9" },
  });
  if (res.status !== 200) {
    // 5xx = el servidor de la fuente está caído, no es un problema nuestro
    if (res.status >= 500) {
      throw new Error(
        "Esta fuente no está disponible en este momento (su servidor respondió " +
          res.status +
          "). Probá más tarde."
      );
    }
    throw new Error("La fuente respondió " + res.status);
  }

  return new DOMParser().parseFromString(String(res.data), "text/html");
}

/** Pide un JSON y lo devuelve ya parseado. */
export async function traerJson<T>(url: string): Promise<T> {
  const nativo = puente();
  if (!nativo) {
    throw new Error("Esta fuente solo está disponible en la app de Android o de Windows");
  }

  const res = await nativo.get({
    url,
    headers: {
      "User-Agent": UA,
      "Accept-Language": "es-ES,es;q=0.9",
      Accept: "application/json",
    },
  });
  if (res.status !== 200) {
    if (res.status >= 500) {
      throw new Error(
        "Esta fuente no está disponible en este momento (su servidor respondió " +
          res.status +
          "). Probá más tarde."
      );
    }
    throw new Error("La fuente respondió " + res.status);
  }

  // el puente de Capacitor ya devuelve objetos cuando el tipo es JSON
  if (typeof res.data === "object") return res.data as T;
  return JSON.parse(res.data as string) as T;
}

// ── verificación de Cloudflare ───────────────────────────────────────────

/** Error que indica que la fuente pide resolver el "no soy un robot". */
export class DesafioPendiente extends Error {
  constructor(public readonly host: string) {
    super("Esta fuente pide verificar que hay una persona");
    this.name = "DesafioPendiente";
  }
}

function tauriCore() {
  if (typeof window === "undefined") return null;
  return (
    window as unknown as {
      __TAURI__?: {
        core?: { invoke: (c: string, a?: Record<string, unknown>) => Promise<unknown> };
      };
    }
  ).__TAURI__?.core;
}

const CLAVE_UA = "mangatotal:user-agent";

/** El user agent elegido en Ajustes, si hay uno. */
export function userAgentElegido(): string | null {
  try {
    return localStorage.getItem(CLAVE_UA);
  } catch {
    return null;
  }
}

export function guardarUserAgent(valor: string | null): void {
  try {
    if (valor && valor.trim()) localStorage.setItem(CLAVE_UA, valor.trim());
    else localStorage.removeItem(CLAVE_UA);
  } catch {
    // almacenamiento bloqueado: se sigue con el de siempre
  }
}

/** El user agent por defecto, el mismo que usa la app. */
export const UA_POR_DEFECTO = UA;

/**
 * Borra el permiso de Cloudflare y los datos del navegador interno.
 *
 * Es la salida cuando la verificación queda trabada: sin esto, un permiso
 * vencido dejaría la fuente inservible sin forma de reintentar.
 */
export async function limpiarVerificacion(): Promise<boolean> {
  const fuentes = pluginFuentes();
  if (fuentes) {
    await fuentes.limpiarVerificacion();
    return true;
  }

  const core = tauriCore();
  if (!core?.invoke) return false;
  await core.invoke("limpiar_verificacion");
  return true;
}

/** True si esta plataforma sabe abrir la ventana de verificación. */
export function puedeResolverDesafio(): boolean {
  return Boolean(pluginFuentes()) || Boolean(tauriCore()?.invoke);
}

/**
 * Abre la ventana donde la persona toca la casilla de Cloudflare.
 *
 * La verificación la resuelve ella, en un navegador de verdad; acá solo se
 * recuerda el permiso que Cloudflare entrega, para los pedidos siguientes.
 * Devuelve true si quedó resuelto.
 */
export async function resolverDesafio(url: string): Promise<boolean> {
  const fuentes = pluginFuentes();
  if (fuentes) {
    const r = await fuentes.resolverDesafio({ url, userAgent: userAgentElegido() });
    return r?.ok === true;
  }

  const core = tauriCore();
  if (!core?.invoke) return false;
  return (
    (await core.invoke("resolver_desafio", { url, userAgent: userAgentElegido() })) === true
  );
}
