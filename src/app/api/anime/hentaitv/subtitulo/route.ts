import { NextRequest, NextResponse } from "next/server";
import { animeAnimadoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy seguro para subtitulos VTT de HentaiTV.
 * Evita bloqueos de CORS o problemas de sincronizacion en Android WebView y navegadores.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesion" }, { status: 401 });
  if (!(await animeAnimadoPermitido(user.animeEnabled, user.animeTermsAcceptedAt))) {
    return NextResponse.json({ error: "La seccion animada esta desactivada en Android" }, { status: 403 });
  }
  if (!(await contenidoAdultoPermitido(user))) {
    return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
  }

  const urlParam = req.nextUrl.searchParams.get("url");
  if (!urlParam) {
    return NextResponse.json({ error: "Falta el parametro url" }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(urlParam);
  } catch {
    return NextResponse.json({ error: "URL invalida" }, { status: 400 });
  }

  if (
    targetUrl.protocol !== "https:" ||
    targetUrl.hostname !== "octopusmanifest.org" ||
    !targetUrl.pathname.toLowerCase().endsWith(".vtt")
  ) {
    return NextResponse.json({ error: "URL de subtitulo no permitida" }, { status: 400 });
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: "https://hentaila.tv/",
      },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Error del servidor de subtitulos: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const vttContent = await upstream.text();
    return new NextResponse(vttContent, {
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al descargar subtitulos";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
