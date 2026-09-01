import { NextRequest, NextResponse } from "next/server";
import { animeAnimadoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import {
  ErrorHentaitv,
  reproduccionHentaitv,
  type ReproduccionHentaitv,
} from "@/lib/hentaitv";
import { firmarPuenteHentaitv, origenPuenteHentaitv } from "@/lib/hentaitvPuente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function reproduccionConPuente(
  req: NextRequest,
  userId: number,
  slug: string,
  episode: string,
): Promise<ReproduccionHentaitv> {
  try {
    return await reproduccionHentaitv(slug, episode);
  } catch (error) {
    if (!(error instanceof ErrorHentaitv) || error.status !== 502) throw error;

    const recurso = `${slug}/${episode}`;
    const puente = await firmarPuenteHentaitv(recurso, userId);
    const origen = new URL(
      `/api/anime/hentaitv/origen/${encodeURIComponent(slug)}/${encodeURIComponent(episode)}`,
      origenPuenteHentaitv(req.url),
    );
    const respuesta = await fetch(origen, {
      cache: "no-store",
      headers: {
        "X-MangaTotal-User": String(userId),
        "X-MangaTotal-Expires": String(puente.expires),
        "X-MangaTotal-Signature": puente.signature,
        Cookie: req.headers.get("cookie") ?? "",
      },
    });
    const data = await respuesta.json();
    if (!respuesta.ok) {
      throw new ErrorHentaitv(data?.error ?? "No se pudo consultar HentaiTV", respuesta.status);
    }
    return data as ReproduccionHentaitv;
  }
}

/** Manifiesto HLS efimero para el reproductor nativo de MangaTotal. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; episode: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesion" }, { status: 401 });
  if (!(await animeAnimadoPermitido(user.animeEnabled, user.animeTermsAcceptedAt))) {
    return NextResponse.json({ error: "La seccion animada esta desactivada en Android" }, { status: 403 });
  }
  if (!(await contenidoAdultoPermitido(user))) {
    return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
  }

  const { slug, episode } = await ctx.params;
  const pideManifest = req.nextUrl.searchParams.get("format") === "manifest";
  try {
    const reproduccion = await reproduccionConPuente(req, user.id, slug, episode);
    if (pideManifest) {
      return new NextResponse(reproduccion.playback.manifest, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return NextResponse.json({
      ...reproduccion,
      playback: {
        kind: "hls" as const,
        url: `${req.nextUrl.pathname}?format=manifest`,
      },
    }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = error instanceof ErrorHentaitv ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo cargar el episodio";
    return NextResponse.json({ error: message }, { status });
  }
}
