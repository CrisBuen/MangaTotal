import { NextRequest, NextResponse } from "next/server";
import { animeAnimadoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import { catalogoHentaitv, ErrorHentaitv } from "@/lib/hentaitv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Catalogo adulto autorizado. Nunca queda disponible en la edicion Play. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesion" }, { status: 401 });
  if (!(await animeAnimadoPermitido(user.animeEnabled, user.animeTermsAcceptedAt))) {
    return NextResponse.json({ error: "La seccion animada esta desactivada en Android" }, { status: 403 });
  }
  if (!(await contenidoAdultoPermitido(user))) {
    return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
  }

  const p = req.nextUrl.searchParams;
  try {
    const catalogo = await catalogoHentaitv(
      {
        q: p.get("q") || undefined,
        page: Number(p.get("page")) || 1,
        genre: Number(p.get("genre")) || null,
        year: p.get("year"),
        sort: p.get("sort") || undefined,
      },
      p.get("fresh") === "1"
    );
    return NextResponse.json(catalogo, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = error instanceof ErrorHentaitv ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo cargar HentaiTV";
    return NextResponse.json({ error: message }, { status });
  }
}
