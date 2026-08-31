import { NextRequest, NextResponse } from "next/server";
import { animeAnimadoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import {
  ErrorTioanime,
  esAdultoTioanime,
  reproduccionTioanime,
} from "@/lib/tioanime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fuentes efimeras de un episodio: YourUpload, Mega y VOE. */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string; episode: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesion" }, { status: 401 });
  if (!(await animeAnimadoPermitido(user.animeEnabled))) {
    return NextResponse.json({ error: "La seccion animada esta desactivada en Android" }, { status: 403 });
  }

  const { slug, episode } = await context.params;
  const source = req.nextUrl.searchParams.get("source")?.slice(0, 80) ?? null;
  try {
    if (!(user.showAdultContent || user.isAdmin) && (await esAdultoTioanime(slug))) {
      return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
    }
    const reproduccion = await reproduccionTioanime(slug, episode, source);
    return NextResponse.json(reproduccion, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = error instanceof ErrorTioanime ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo cargar el episodio";
    return NextResponse.json({ error: message }, { status });
  }
}
