import { NextRequest, NextResponse } from "next/server";
import { animeAnimadoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import { catalogoTioanime, ErrorTioanime } from "@/lib/tioanime";

export const runtime = "nodejs";

/** Catalogo autorizado de TioAnime con sus filtros publicos. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesion" }, { status: 401 });
  if (!(await animeAnimadoPermitido(user.animeEnabled, user.animeTermsAcceptedAt))) {
    return NextResponse.json({ error: "La seccion animada esta desactivada en Android" }, { status: 403 });
  }

  const p = req.nextUrl.searchParams;
  try {
    const catalogo = await catalogoTioanime(
      {
        q: p.get("q") || undefined,
        page: Number(p.get("page")) || 1,
        types: p.getAll("type"),
        genres: p.getAll("genre"),
        yearFrom: p.get("year_from") || undefined,
        yearTo: p.get("year_to") || undefined,
        status: p.get("status") || undefined,
        sort: p.get("sort") || undefined,
      },
      p.get("fresh") === "1"
    );
    return NextResponse.json(catalogo);
  } catch (error) {
    const status = error instanceof ErrorTioanime ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo cargar TioAnime";
    return NextResponse.json({ error: message }, { status });
  }
}
