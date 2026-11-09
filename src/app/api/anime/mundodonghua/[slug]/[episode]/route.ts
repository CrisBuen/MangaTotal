import { NextRequest, NextResponse } from "next/server";
import { animePublicoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import {
  ErrorMundodonghua,
  reproduccionMundodonghua,
} from "@/lib/mundodonghua";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fuentes de reproducción oficiales de MundoDonghua (VOE, Filemoon, VidHide, StreamWish). */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string; episode: string }> }
) {
  const user = await getSessionUser();
  if (!(await animePublicoPermitido(user))) {
    return NextResponse.json({ error: "La sección animada está desactivada en Android" }, { status: 403 });
  }

  const { slug, episode } = await context.params;
  const source = req.nextUrl.searchParams.get("source")?.slice(0, 80) ?? null;
  try {
    const reproduccion = await reproduccionMundodonghua(slug, episode, source);
    return NextResponse.json({ ...reproduccion, guest: !user }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = error instanceof ErrorMundodonghua ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo cargar el episodio";
    return NextResponse.json({ error: message }, { status });
  }
}
