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

interface Puente {
  get(opciones: { url: string; headers?: Record<string, string> }): Promise<{
    status: number;
    /** El puente de Capacitor devuelve un objeto cuando la respuesta es JSON. */
    data: string | object;
  }>;
}

function puente(): Puente | null {
  if (typeof window === "undefined") return null;

  const capacitor = (window as unknown as {
    Capacitor?: { Plugins?: { CapacitorHttp?: Puente } };
  }).Capacitor;
  if (capacitor?.Plugins?.CapacitorHttp) return capacitor.Plugins.CapacitorHttp;

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
          const html = (await tauri.core!.invoke("traer_pagina", { url })) as string;
          return { status: 200, data: html };
        } catch (err) {
          // el comando avisa así cuando Cloudflare pide verificar
          const aviso = String(err);
          if (aviso.startsWith("DESAFIO:")) {
            throw new DesafioPendiente(aviso.slice("DESAFIO:".length));
          }
          throw err;
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

/** True si esta plataforma sabe abrir la ventana de verificación. */
export function puedeResolverDesafio(): boolean {
  return Boolean(tauriCore()?.invoke);
}

/**
 * Abre la ventana donde la persona toca la casilla de Cloudflare.
 *
 * La verificación la resuelve ella, en un navegador de verdad; acá solo se
 * recuerda el permiso que Cloudflare entrega, para los pedidos siguientes.
 * Devuelve true si quedó resuelto.
 */
export async function resolverDesafio(url: string): Promise<boolean> {
  const core = tauriCore();
  if (!core?.invoke) return false;
  return (await core.invoke("resolver_desafio", { url })) === true;
}
