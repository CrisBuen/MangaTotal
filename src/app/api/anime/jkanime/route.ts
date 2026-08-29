import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { catalogoJkanime, ErrorJkanime } from "@/lib/jkanime";

export const runtime = "nodejs";

/** Catálogo autorizado de JKAnime. La activación se comprueba también acá. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!user.animeEnabled) {
    return NextResponse.json({ error: "La sección Anime está desactivada" }, { status: 403 });
  }

  const p = req.nextUrl.searchParams;
  const genre = p.get("genre") || undefined;
  if (genre === "hentai" && !(user.showAdultContent || user.isAdmin)) {
    return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
  }

  try {
    const catalogo = await catalogoJkanime(
      {
        q: p.get("q") || undefined,
        page: Number(p.get("page")) || 1,
        sort: p.get("sort") || undefined,
        genre,
        letter: p.get("letter") || undefined,
        demographic: p.get("demographic") || undefined,
        category: p.get("category") || undefined,
        type: p.get("type") || undefined,
        status: p.get("status") || undefined,
        year: p.get("year") || undefined,
        season: p.get("season") || undefined,
        order: p.get("order") || undefined,
      },
      p.get("fresh") === "1"
    );
    return NextResponse.json({
      ...catalogo,
      adult_enabled: Boolean(user.showAdultContent || user.isAdmin),
    });
  } catch (error) {
    const status = error instanceof ErrorJkanime ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo cargar JKAnime";
    return NextResponse.json({ error: message }, { status });
  }
}
