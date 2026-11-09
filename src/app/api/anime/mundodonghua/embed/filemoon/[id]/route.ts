import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Envoltorio ligero para incrustar reproductores de Filemoon (bysekoze.com)
 * sorteando el bloqueo de dominio autorizado ("embedding from mangatotal.com is not allowed")
 * con autorización de los propietarios y sin transferir tráfico de video por Vercel.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const limpioId = id.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!limpioId) {
    return new NextResponse("ID de video inválido", { status: 400 });
  }

  try {
    const res = await fetch(`https://bysekoze.com/e/${limpioId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      return new NextResponse("No se pudo cargar el reproductor remoto", { status: res.status });
    }

    const html = await res.text();

    // Inyectamos script en <head> para que el frontend de Bysekoze ejecute sus scripts
    // con base en su CDN y dirija sus consultas de configuración y captcha a nuestro proxy local
    // que adjunta X-Embed-Origin: mundodonghua.com.
    const scriptInyeccion = `
    <base href="https://bysekoze.com/" />
    <script>
      (function() {
        try {
          Object.defineProperty(document, 'referrer', {
            get: function() { return 'https://www.mundodonghua.com/'; },
            configurable: true
          });
        } catch (e) {}

        var origFetch = window.fetch;
        window.fetch = function(url, init) {
          try {
            if (typeof url === 'string' && url.indexOf('/api/videos/') !== -1) {
              var u = new URL(url, 'https://bysekoze.com');
              var proxyUrl = '/api/anime/mundodonghua/byse-api' + u.pathname.replace(/^\\/api\\/videos/, '') + u.search;
              return origFetch.call(this, proxyUrl, init);
            }
          } catch (e) {}
          return origFetch.call(this, url, init);
        };
      })();
    </script>
    `;

    const htmlModificado = html.replace("<head>", `<head>${scriptInyeccion}`);

    return new NextResponse(htmlModificado, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    return new NextResponse(err?.message || "Error al conectar con el servidor", { status: 502 });
  }
}
