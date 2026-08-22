import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/tags — todos los tags en uso, con conteo de series visibles
 * para quien consulta (visitante/usuario sin +18 no ve tags exclusivos
 * de series adultas).
 */
export async function GET() {
  const user = await getSessionUser();
  const seeAdult = Boolean(user?.showAdultContent || user?.isAdmin);

  const tags = await db.tag.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          series: seeAdult ? true : { where: { type: "normal" } },
        },
      },
    },
  });

  return NextResponse.json(
    tags
      .filter((t) => t._count.series > 0)
      .map((t) => ({ id: t.id, name: t.name, slug: t.slug, series_count: t._count.series }))
  );
}
