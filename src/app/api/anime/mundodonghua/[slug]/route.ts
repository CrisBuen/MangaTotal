import { NextRequest, NextResponse } from "next/server";
import { animePublicoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import { ErrorMundodonghua, fichaMundodonghua } from "@/lib/mundodonghua";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ficha y episodios de MundoDonghua. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!(await animePublicoPermitido(user))) {
    return NextResponse.json({ error: "La sección animada está desactivada en Android" }, { status: 403 });
  }

  const { slug } = await ctx.params;
  try {
    const ficha = await fichaMundodonghua(slug, Number(req.nextUrl.searchParams.get("page")) || 1);
    return NextResponse.json(ficha, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = error instanceof ErrorMundodonghua ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo cargar el donghua";
    return NextResponse.json({ error: message }, { status });
  }
}
