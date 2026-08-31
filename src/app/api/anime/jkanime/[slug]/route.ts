import { NextRequest, NextResponse } from "next/server";
import { animeAnimadoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import { ErrorJkanime, fichaJkanime } from "@/lib/jkanime";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ficha y una página de episodios, sin incluir enlaces de servidores de video. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!(await animeAnimadoPermitido(user.animeEnabled, user.animeTermsAcceptedAt))) {
    return NextResponse.json({ error: "La sección animada está desactivada en Android" }, { status: 403 });
  }

  const { slug } = await ctx.params;
  try {
    const ficha = await fichaJkanime(slug, Number(req.nextUrl.searchParams.get("page")) || 1);
    if (
      ficha.genres.some((genre) => genre.toLowerCase() === "hentai") &&
      !(await contenidoAdultoPermitido(user))
    ) {
      return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
    }
    const respuesta = NextResponse.json(ficha);
    respuesta.headers.set("Cache-Control", "no-store");
    return respuesta;
  } catch (error) {
    const status = error instanceof ErrorJkanime ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo cargar el anime";
    return NextResponse.json({ error: message }, { status });
  }
}
