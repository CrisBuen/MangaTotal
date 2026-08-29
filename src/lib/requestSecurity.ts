import type { NextRequest } from "next/server";

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Las cookies SameSite ya frenan la mayoría del CSRF. Esta comprobación
 * agrega una segunda barrera para toda mutación sin depender de tokens en UI.
 */
export function origenPermitido(req: NextRequest): boolean {
  if (METODOS_SEGUROS.has(req.method.toUpperCase())) return true;

  const origen = req.headers.get("origin");
  if (!origen || origen === "null") return false;

  try {
    const recibido = new URL(origen);
    const hostEsperado = (
      req.headers.get("x-forwarded-host") ??
      req.headers.get("host") ??
      req.nextUrl.host
    )
      .split(",")[0]
      .trim()
      .toLowerCase();
    const protocoloEsperado = (
      req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")
    )
      .split(",")[0]
      .trim()
      .toLowerCase();

    return (
      recibido.protocol === `${protocoloEsperado}:` &&
      recibido.host.toLowerCase() === hostEsperado &&
      recibido.username === "" &&
      recibido.password === ""
    );
  } catch {
    return false;
  }
}
