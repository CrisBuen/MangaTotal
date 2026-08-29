import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
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
  if (!user.animeEnabled) {
    return NextResponse.json({ error: "La sección Anime está desactivada" }, { status: 403 });
  }

  const { slug, episode } = await context.params;
  const source = req.nextUrl.searchParams.get("source")?.slice(0, 80) ?? null;
  try {
    if (!(user.showAdultContent || user.isAdmin) && (await esAdultoJkanime(slug))) {
      return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
    }
    const reproduccion = await reproduccionJkanime(slug, episode, source);
    return NextResponse.json(reproduccion, {
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
