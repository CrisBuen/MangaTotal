import { NextRequest, NextResponse } from "next/server";
import { animeAnimadoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import {
  ErrorJkanime,
  esAdultoJkanime,
  reproduccionJkanime,
} from "@/lib/jkanime";

/**
 * Datos efímeros del reproductor nativo. Esta respuesta nunca se cachea:
 * los manifiestos HLS de JKAnime incluyen una firma con vencimiento.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string; episode: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!(await animeAnimadoPermitido(user.animeEnabled, user.animeTermsAcceptedAt))) {
    return NextResponse.json({ error: "La sección animada está desactivada en Android" }, { status: 403 });
  }

  const { slug, episode } = await context.params;
  const source = req.nextUrl.searchParams.get("source")?.slice(0, 80) ?? null;
  const pideManifest = req.nextUrl.searchParams.get("format") === "manifest";
  try {
    if (!(await contenidoAdultoPermitido(user)) && (await esAdultoJkanime(slug))) {
      return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
    }
    const reproduccion = await reproduccionJkanime(slug, episode, source);
    if (pideManifest) {
      if (reproduccion.playback.kind !== "hls") {
        return NextResponse.json(
          { error: "Esta fuente no entrega video HLS" },
          { status: 409 }
        );
      }
      return new NextResponse(reproduccion.playback.manifest, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const respuesta =
      reproduccion.playback.kind === "hls"
        ? {
            ...reproduccion,
            playback: {
              kind: "hls" as const,
              url: `${req.nextUrl.pathname}?${new URLSearchParams({
                source: reproduccion.selected_source,
                format: "manifest",
              })}`,
            },
          }
        : reproduccion;
    return NextResponse.json(respuesta, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    const status = error instanceof ErrorJkanime ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo cargar el episodio";
    return NextResponse.json({ error: message }, { status });
  }
}
