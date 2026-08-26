import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/externo/imagen?u=<url> — respaldo para las páginas de MangaDex.
 * Normalmente el navegador las descarga directo de MangaDex@Home; si algo
 * del lado del cliente bloquea ese dominio (extensiones, escudos, DNS),
 * el lector reintenta por acá y la lectura no se corta.
 *
 * Solo acepta hosts oficiales de MangaDex, nunca una URL arbitraria.
 */
const ALLOWED_HOSTS = /(^|\.)(mangadex\.network|mangadex\.org)$/;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  if (!raw) return NextResponse.json({ error: "Falta la url" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Url inválida" }, { status: 400 });
  }

  if (url.protocol !== "https:" || !ALLOWED_HOSTS.test(url.hostname)) {
    return NextResponse.json({ error: "Host no permitido" }, { status: 400 });
  }

  const upstream = await fetch(url, {
    headers: { "User-Agent": "MangaTotal/1.0 (manga-total.vercel.app)" },
    next: { revalidate: 3600 },
  }).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    return NextResponse.json({ error: "No se pudo obtener la imagen" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      // las páginas de un capítulo publicado no cambian
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
