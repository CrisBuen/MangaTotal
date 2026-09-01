import { NextResponse } from "next/server";
import { animeAnimadoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import { ErrorHentaitv, fichaHentaitv } from "@/lib/hentaitv";
import { firmarPuenteHentaitv, origenPuenteHentaitv } from "@/lib/hentaitvPuente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ficha y enlaces de episodios; no extrae ni persiste direcciones de video. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesion" }, { status: 401 });
  if (!(await animeAnimadoPermitido(user.animeEnabled, user.animeTermsAcceptedAt))) {
    return NextResponse.json({ error: "La seccion animada esta desactivada en Android" }, { status: 403 });
  }
  if (!(await contenidoAdultoPermitido(user))) {
    return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
  }

  const { slug } = await ctx.params;
  try {
    let ficha;
    try {
      ficha = await fichaHentaitv(slug);
    } catch (error) {
      if (!(error instanceof ErrorHentaitv) || error.status !== 502) throw error;

      // La firma conserva el control +18 en esta ruta Node y permite que el
      // borde lea solamente la ficha exacta que ya pidio el usuario.
      const puente = await firmarPuenteHentaitv(slug, user.id);
      const origen = new URL(
        `/api/anime/hentaitv/origen/${encodeURIComponent(slug)}`,
        origenPuenteHentaitv(req.url),
      );
      const respuesta = await fetch(origen, {
        cache: "no-store",
        headers: {
          "X-MangaTotal-User": String(user.id),
          "X-MangaTotal-Expires": String(puente.expires),
          "X-MangaTotal-Signature": puente.signature,
          Cookie: req.headers.get("cookie") ?? "",
        },
      });
      if (!respuesta.ok) throw error;
      ficha = await respuesta.json();
    }
    return NextResponse.json(ficha, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = error instanceof ErrorHentaitv ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo cargar el anime";
    return NextResponse.json({ error: message }, { status });
  }
}
