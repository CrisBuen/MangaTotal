import { NextRequest, NextResponse } from "next/server";
import { animePublicoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import { catalogoMundodonghua, ErrorMundodonghua } from "@/lib/mundodonghua";

export const runtime = "nodejs";

/** Catálogo de MundoDonghua con búsqueda y filtros. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!(await animePublicoPermitido(user))) {
    return NextResponse.json({ error: "La sección animada está desactivada en Android" }, { status: 403 });
  }

  const p = req.nextUrl.searchParams;
  try {
    const catalogo = await catalogoMundodonghua(
      {
        q: p.get("q") || undefined,
        page: Number(p.get("page")) || 1,
        status: p.get("status") || undefined,
        genero: p.get("genre") || p.get("genero") || undefined,
      },
      p.get("fresh") === "1"
    );
    return NextResponse.json(catalogo);
  } catch (error) {
    const status = error instanceof ErrorMundodonghua ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo cargar MundoDonghua";
    return NextResponse.json({ error: message }, { status });
  }
}
