import { NextResponse } from "next/server";

/**
 * Puente del servidor hacia LeerCapítulo (integrada con su permiso).
 *
 * Su sitio está detrás de Cloudflare. Se intenta desde acá: si pasa, la
 * fuente funciona también en el navegador; si no, el cliente lo reintenta
 * por el puente nativo de la app (ver src/lib/fuenteNativa.ts).
 */
const BASE = "https://www.leercapitulo.co";
const RUTAS_PERMITIDAS = ["/", "/manga/", "/genre/", "/initial/", "/leer/"];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function GET(request: Request) {
  const ruta = new URL(request.url).searchParams.get("ruta") ?? "";

  if (!ruta.startsWith("/") || ruta.includes("..") || !RUTAS_PERMITIDAS.some((p) => ruta.startsWith(p))) {
    return NextResponse.json({ error: "Ruta no permitida" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE}${ruta}`, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      // su catálogo cambia despacio: un rato de caché ahorra viajes
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "LeerCapítulo no respondió desde el servidor", bloqueado: true },
        { status: 502 }
      );
    }

    return NextResponse.json({ html: await res.text() });
  } catch {
    return NextResponse.json(
      { error: "No se pudo contactar con LeerCapítulo", bloqueado: true },
      { status: 502 }
    );
  }
}
