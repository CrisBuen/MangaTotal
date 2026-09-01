import { NextResponse } from "next/server";
import { animeAnimadoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import { ErrorHentaitv, reproduccionHentaitv } from "@/lib/hentaitv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Metadatos y pagina oficial del episodio; el iframe remoto usa SAMEORIGIN. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; episode: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesion" }, { status: 401 });
  if (!(await animeAnimadoPermitido(user.animeEnabled, user.animeTermsAcceptedAt))) {
    return NextResponse.json({ error: "La seccion animada esta desactivada en Android" }, { status: 403 });
  }
  if (!(await contenidoAdultoPermitido(user))) {
    return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
  }

  const { slug, episode } = await ctx.params;
  try {
    const reproduccion = await reproduccionHentaitv(slug, episode);
    return NextResponse.json(reproduccion, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = error instanceof ErrorHentaitv ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo cargar el episodio";
    return NextResponse.json({ error: message }, { status });
  }
}
