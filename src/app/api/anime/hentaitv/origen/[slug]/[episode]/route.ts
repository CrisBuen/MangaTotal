import { NextResponse } from "next/server";
import { ErrorHentaitv, reproduccionHentaitv } from "@/lib/hentaitv";
import { verificarPuenteHentaitv } from "@/lib/hentaitvPuente";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/** Reproduce solo el episodio firmado por la API autenticada de MangaTotal. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string; episode: string }> },
) {
  const { slug, episode } = await ctx.params;
  const userId = Number(req.headers.get("x-mangatotal-user"));
  const expires = Number(req.headers.get("x-mangatotal-expires"));
  const signature = req.headers.get("x-mangatotal-signature") ?? "";
  const recurso = `${slug}/${episode}`;
  if (!(await verificarPuenteHentaitv(recurso, userId, expires, signature))) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }

  try {
    const reproduccion = await reproduccionHentaitv(slug, episode);
    return NextResponse.json(reproduccion, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = error instanceof ErrorHentaitv ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo consultar HentaiTV";
    return NextResponse.json({ error: message }, { status });
  }
}
