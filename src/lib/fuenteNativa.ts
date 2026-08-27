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
    data: string;
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
        const html = (await tauri.core!.invoke("traer_pagina", { url })) as string;
        return { status: 200, data: html };
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

  return new DOMParser().parseFromString(res.data, "text/html");
}
