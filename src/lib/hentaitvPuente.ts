import { getSessionSecret } from "@/lib/env";

const VIGENCIA_SEGUNDOS = 60;
const PROPOSITO = "hentaitv-origen-v1";

/** Evita que un Host manipulado convierta la llamada interna en SSRF. */
export function origenPuenteHentaitv(requestUrl: string): string {
  const url = new URL(requestUrl);
  const host = url.hostname.toLowerCase();
  const locales = new Set(["localhost", "127.0.0.1", "::1"]);
  const configurados = new Set(["mangatotal.com", "www.mangatotal.com"]);
  for (const value of [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (!value) continue;
    try {
      configurados.add(new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase());
    } catch {
      // Vercel administra estas variables; un valor roto simplemente no sirve.
    }
  }
  if (process.env.APP_PUBLIC_URL) {
    try {
      configurados.add(new URL(process.env.APP_PUBLIC_URL).hostname.toLowerCase());
    } catch {
      // getSessionSecret mostrara antes los errores de configuracion criticos.
    }
  }
  if (!locales.has(host) && !configurados.has(host)) {
    throw new Error("Host interno de MangaTotal no autorizado");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && locales.has(host))) {
    throw new Error("Protocolo interno de MangaTotal no autorizado");
  }
  return url.origin;
}

function base64Url(bytes: ArrayBuffer): string {
  const valores = new Uint8Array(bytes);
  let binario = "";
  for (const value of valores) binario += String.fromCharCode(value);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function claveHmac(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function mensaje(recurso: string, userId: number, expires: number): ArrayBuffer {
  return new TextEncoder().encode(`${PROPOSITO}:${recurso}:${userId}:${expires}`).buffer as ArrayBuffer;
}

/**
 * Autoriza durante un minuto el salto interno Node -> Edge. La ruta Edge no
 * acepta direcciones remotas: solamente un recurso validado de HentaiTV.
 */
export async function firmarPuenteHentaitv(recurso: string, userId: number) {
  const expires = Math.floor(Date.now() / 1000) + VIGENCIA_SEGUNDOS;
  const signature = base64Url(
    await crypto.subtle.sign("HMAC", await claveHmac(), mensaje(recurso, userId, expires)),
  );
  return { expires, signature };
}

export async function verificarPuenteHentaitv(
  recurso: string,
  userId: number,
  expires: number,
  signature: string,
): Promise<boolean> {
  const ahora = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(userId) || userId <= 0) return false;
  if (!Number.isSafeInteger(expires) || expires < ahora || expires > ahora + VIGENCIA_SEGUNDOS + 10) {
    return false;
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;

  const esperada = base64Url(
    await crypto.subtle.sign("HMAC", await claveHmac(), mensaje(recurso, userId, expires)),
  );
  return signature === esperada;
}
