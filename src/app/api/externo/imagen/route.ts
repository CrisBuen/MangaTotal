import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import { resolverImagenVisorEhentai } from "@/lib/ehentai";
import { reconstruirUrlPaginaHitomi } from "@/lib/hitomi";

/**
 * GET /api/externo/imagen?u=<url> — respaldo y descarga directa para las páginas
 * de fuentes de lectura integradas (MangaDex, Olympus, ZonaTMO, LeerCapítulo,
 * Catharsis, Ikigai, E-Hentai y Hitomi).
 *
 * Retransmite los bytes de la imagen original sin comprimir ni almacenar en R2/Vercel.
 */
const ALLOWED_HOSTS =
  /(^|\.)(mangadex\.network|mangadex\.org|hath\.network|ehgt\.org|e-hentai\.org|exhentai\.org|gold-usergeneratedcontent\.net|hitomi\.la|olympusxyz\.com|olympusbiblioteca\.com|olympusscans\.com|olympusv2\.gg|olympusscanlation\.com|imagesolymp\.xyz|swordflake\.com|zonatmo\.(com|net|to|org)|visortmo\.com|tumangaonline\.(site|me)|leercapitulo\.(com|co|site|net)|catharsisfood\.com|catharsisworks\.com|dig-it\.info|ikigaimangas\.cloud|ikigaivs\.org|ikigaimangas\.com|storage\.googleapis\.com)$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

const ADULT_HOSTS =
  /(^|\.)(hath\.network|ehgt\.org|e-hentai\.org|exhentai\.org|gold-usergeneratedcontent\.net|hitomi\.la)$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  if (!raw) return NextResponse.json({ error: "Falta la url" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Url inválida" }, { status: 400 });
  }

  if ((url.protocol !== "https:" && url.protocol !== "http:") || !ALLOWED_HOSTS.test(url.hostname)) {
    return NextResponse.json({ error: "Host no permitido" }, { status: 400 });
  }

  // Protección para contenido +18: la edición de Google Play nunca recibe estas imágenes
  if (ADULT_HOSTS.test(url.hostname)) {
    const user = await getSessionUser();
    const permitido = await contenidoAdultoPermitido(user);
    if (!permitido && Boolean(user)) {
      return NextResponse.json({ error: "Contenido no permitido en esta edición" }, { status: 403 });
    }
  }

  // Si la URL es una página de visor de E-Hentai (/s/{token}/{gid}-{page}), resolvemos su imagen directa primero
  if (/(^|\.)(e-hentai\.org|exhentai\.org)$/i.test(url.hostname) && url.pathname.startsWith("/s/")) {
    const directa = await resolverImagenVisorEhentai(url.toString());
    if (!directa) {
      return NextResponse.json({ error: "No se pudo resolver la página de E-Hentai" }, { status: 502 });
    }
    try {
      url = new URL(directa);
    } catch {
      return NextResponse.json({ error: "Imagen resuelta inválida" }, { status: 502 });
    }
  }

  const upstreamHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };

  if (/hath\.network|e-hentai\.org|exhentai\.org|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname)) {
    upstreamHeaders["Cookie"] = "nw=1";
    upstreamHeaders["Referer"] = "https://e-hentai.org/";
  } else if (/gold-usergeneratedcontent\.net|hitomi\.la/.test(url.hostname)) {
    upstreamHeaders["Referer"] = "https://hitomi.la/";
  } else if (/leercapitulo/.test(url.hostname)) {
    upstreamHeaders["Referer"] = "https://www.leercapitulo.co/";
  } else if (/zonatmo|visortmo|tumangaonline/.test(url.hostname)) {
    upstreamHeaders["Referer"] = "https://visortmo.com/";
  } else if (/ikigai/.test(url.hostname)) {
    upstreamHeaders["Referer"] = "https://visorikigai.gettocaboca.com/";
    upstreamHeaders["Sec-Fetch-Mode"] = "cors";
  } else if (/imagesolymp|swordflake|olympus/.test(url.hostname)) {
    upstreamHeaders["Referer"] = "https://olympusxyz.com/";
  }

  let upstream = await fetch(url, {
    headers: upstreamHeaders,
    next: { revalidate: 3600 },
  }).catch(() => null);

  if (
    (!upstream?.ok || !upstream.body) &&
    /gold-usergeneratedcontent\.net|hitomi\.la/.test(url.hostname) &&
    !url.pathname.includes("bigtn")
  ) {
    const matchHash = url.pathname.match(/\/([0-9a-f]{64})\.(webp|avif)$/i);
    if (matchHash) {
      const freshUrl = await reconstruirUrlPaginaHitomi(matchHash[1], "webp").catch(() => null);
      if (freshUrl) {
        upstream = await fetch(freshUrl, {
          headers: upstreamHeaders,
          cache: "no-store",
        }).catch(() => null);
      }
    }
  }

  if (!upstream?.ok || !upstream.body) {
    return NextResponse.json({ error: "No se pudo obtener la imagen" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      // las páginas de un capítulo publicado no cambian
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
