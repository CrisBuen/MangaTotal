import { NextResponse } from "next/server";
import { ErrorHentaitv, fichaHentaitv } from "@/lib/hentaitv";
import { verificarPuenteHentaitv } from "@/lib/hentaitvPuente";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * HentaiTV bloquea algunas IP de funciones Node, pero su HTML responde desde
 * el borde. Este puente solo admite solicitudes HMAC efímeras emitidas por la
 * API autenticada; no recibe una URL y por lo tanto no puede usarse como proxy.
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const userId = Number(req.headers.get("x-mangatotal-user"));
  const expires = Number(req.headers.get("x-mangatotal-expires"));
  const signature = req.headers.get("x-mangatotal-signature") ?? "";
  if (!(await verificarPuenteHentaitv(slug, userId, expires, signature))) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }

  try {
    const ficha = await fichaHentaitv(slug, true);
    return NextResponse.json(ficha, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = error instanceof ErrorHentaitv ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo consultar HentaiTV";
    return NextResponse.json({ error: message }, { status });
  }
}
