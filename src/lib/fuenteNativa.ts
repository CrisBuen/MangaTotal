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
    __TAURI__?: { http?: { fetch: (url: string, init?: RequestInit) => Promise<Response> } };
  }).__TAURI__;
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
  if (res.status !== 200) throw new Error(`La fuente respondió ${res.status}`);

  return new DOMParser().parseFromString(res.data, "text/html");
}
