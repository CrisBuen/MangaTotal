import { NextRequest, NextResponse } from "next/server";
import { animeAnimadoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import { ErrorTioanime, fichaTioanime } from "@/lib/tioanime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ficha y episodios de TioAnime, sin incluir enlaces de reproduccion. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesion" }, { status: 401 });
  if (!(await animeAnimadoPermitido(user.animeEnabled))) {
    return NextResponse.json({ error: "La seccion animada esta desactivada en Android" }, { status: 403 });
  }

  const { slug } = await ctx.params;
  try {
    const ficha = await fichaTioanime(slug, Number(req.nextUrl.searchParams.get("page")) || 1);
    if (
      ficha.genres.some((genre) => genre.toLowerCase() === "hentai") &&
      !(user.showAdultContent || user.isAdmin)
    ) {
      return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
    }
    return NextResponse.json(ficha, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = error instanceof ErrorTioanime ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo cargar el anime";
    return NextResponse.json({ error: message }, { status });
  }
}
