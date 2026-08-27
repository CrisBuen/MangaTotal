import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/tags?tipo=normal|adult — tags en uso, con cuántas series
 * visibles tiene cada uno.
 *
 * Quien no tenga +18 activado nunca ve tags que solo usan series adultas.
 * Además `tipo` acota la lista a la pestaña que se está mirando: en
 * "Normal" no tienen por qué aparecer las categorías del +18.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  const verAdulto = Boolean(user?.showAdultContent || user?.isAdmin);

  const tipo = req.nextUrl.searchParams.get("tipo");
  const soloDeEsteTipo = tipo === "normal" || tipo === "adult";

  // el filtro de la pestaña manda; si no hay, se cae al permiso del usuario
  const donde = soloDeEsteTipo
    ? { where: { type: tipo } }
    : verAdulto
      ? true
      : { where: { type: "normal" } };

  // sin +18 no se pueden pedir las categorías del +18
  if (tipo === "adult" && !verAdulto) return NextResponse.json([]);

  const tags = await db.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { series: donde } } },
  });

  return NextResponse.json(
    tags
      .filter((t) => t._count.series > 0)
      .map((t) => ({ id: t.id, name: t.name, slug: t.slug, series_count: t._count.series }))
  );
}
