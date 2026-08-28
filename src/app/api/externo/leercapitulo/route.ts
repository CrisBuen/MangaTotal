import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { paginasDelHtml } from "@/lib/leercapituloCodigo";

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

/**
 * Sus páginas pesan más de 200 KB, casi todo publicidad y scripts que no
 * usamos. Se recorta antes de mandarla: en una conexión lenta es la
 * diferencia entre esperar y no esperar.
 */
function aligerar(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/\s{2,}/g, " ");
}

/** Los capítulos vecinos salen de su selector, que trae la lista entera. */
function vecinos(html: string, numero: string) {
  const numeros = [
    ...new Set(
      [...html.matchAll(/<option[^>]*value="([^"]*\/leer\/[^"]*)"/g)]
        .map((m) => m[1].split("/").filter(Boolean).pop() ?? "")
        .filter(Boolean)
    ),
  ];

  const i = numeros.indexOf(numero);
  return {
    // los listan del más nuevo al más viejo
    anterior: i >= 0 && i + 1 < numeros.length ? numeros[i + 1] : null,
    siguiente: i > 0 ? numeros[i - 1] : null,
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ruta = params.get("ruta") ?? "";
  const fresco = params.get("fresco") === "1";

  // Un capítulo se resuelve entero acá: las URLs y la clave que deshace su
  // barajado cambian juntas, así que tienen que salir de este mismo pedido.
  if (params.get("accion") === "capitulo") {
    if (!ruta.startsWith("/leer/")) {
      return NextResponse.json({ error: "Ruta no permitida" }, { status: 400 });
    }

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

    const numero = ruta.split("/").filter(Boolean).pop() ?? "";

    try {
      const res = await fetch(BASE + ruta, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "es-ES,es;q=0.9",
        },
        cache: "no-store",
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: "LeerCapítulo no respondió desde el servidor", bloqueado: true },
          { status: 502 }
        );
      }

      const html = await res.text();
      const paginas = paginasDelHtml(html);
      if (paginas.length === 0) {
        return NextResponse.json({ error: "Este capítulo no trae páginas" }, { status: 404 });
      }

      const respuesta = NextResponse.json({
        paginas,
        numero,
        ...vecinos(html, numero),
        url_original: BASE + ruta,
      });
      // las direcciones son de un solo uso: no se guardan en caché
      respuesta.headers.set("Cache-Control", "no-store");
      return respuesta;
    } catch (error) {
      if (error instanceof Error && error.message.includes("CAMBIO-DE-DOMINIO-LEERCAPITULO.txt")) {
        return NextResponse.json({ error: error.message }, { status: 502 });
      }
      return NextResponse.json(
        { error: "No se pudo contactar con LeerCapítulo", bloqueado: true },
        { status: 502 }
      );
    }
  }

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
      // el catálogo cambia despacio y se cachea unos minutos; el botón de
      // actualizar pide fresco para ver los capítulos recién subidos
      ...(fresco ? { cache: "no-store" as const } : { next: { revalidate: 300 } }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "LeerCapítulo no respondió desde el servidor", bloqueado: true },
        { status: 502 }
      );
    }

    const respuesta = NextResponse.json({ html: aligerar(await res.text()) });
    if (fresco) respuesta.headers.set("Cache-Control", "no-store");
    return respuesta;
  } catch {
    return NextResponse.json(
      { error: "No se pudo contactar con LeerCapítulo", bloqueado: true },
      { status: 502 }
    );
  }
}
