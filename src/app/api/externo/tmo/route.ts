import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

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
  const ruta = new URL(request.url).searchParams.get("ruta") ?? "";

  if (!ruta.startsWith("/") || ruta.includes("..") || !RUTAS_PERMITIDAS.some((p) => ruta.startsWith(p))) {
    return NextResponse.json({ error: "Ruta no permitida" }, { status: 400 });
  }

  // El catálogo y la ficha se navegan como visitante; leer un capítulo no.
  // Un capítulo es /single/manga/{serie}/{capitulo}, que son cinco tramos;
  // /single/manga/{serie}/chapters también tiene cinco pero es la lista.
  const tramos = ruta.split("?")[0].replace(/\/+$/, "").split("/");
  if (ruta.startsWith("/single/") && tramos.length >= 5 && tramos[4] !== "chapters") {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

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
      ...(ruta.startsWith("/single/")
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
