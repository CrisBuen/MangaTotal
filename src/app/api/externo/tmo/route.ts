import { NextResponse } from "next/server";

/**
 * Puente del servidor hacia la API de ZonaTMO (integrada con su permiso).
 *
 * Su sitio está detrás de Cloudflare y históricamente rechazaba a las IPs
 * de centros de datos. Se intenta igual desde acá: si pasa, la fuente
 * funciona también en el navegador; si no, el cliente lo reintenta por el
 * puente nativo de la app (ver src/lib/fuenteNativa.ts).
 */
const BASE = "https://zonatmo.net/wp-api/api";
const RUTAS_PERMITIDAS = ["/listing/", "/single/", "/tops/"];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ruta = params.get("ruta") ?? "";
  const fresco = params.get("fresco") === "1";

  if (!ruta.startsWith("/") || ruta.includes("..") || !RUTAS_PERMITIDAS.some((p) => ruta.startsWith(p))) {
    return NextResponse.json({ error: "Ruta no permitida" }, { status: 400 });
  }

  // Catálogo, ficha y lectura son públicos. El avance se escribe únicamente
  // mediante los handlers privados de la cuenta; este puente sigue siendo GET.

  try {
    const res = await fetch(`${BASE}${ruta}`, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Accept-Language": "es-ES,es;q=0.9",
        Referer: "https://zonatmo.net/",
      },
      // el catálogo cambia despacio y se cachea; la ficha y el capítulo no,
      // porque el enlace de las imágenes viene firmado y caduca
      ...(fresco || ruta.startsWith("/single/")
        ? { cache: "no-store" as const }
        : { next: { revalidate: 300 } }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "ZonaTMO no respondió desde el servidor", bloqueado: true },
        { status: 502 }
      );
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(
      { error: "No se pudo contactar con ZonaTMO", bloqueado: true },
      { status: 502 }
    );
  }
}
