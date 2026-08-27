import { NextResponse } from "next/server";

/** Diagnóstico temporal: ¿responde el HTML de Olympus desde Vercel? */
export const dynamic = "force-dynamic";

export async function GET() {
  const url = "https://olympusxyz.com/capitulos?page=1";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MangaTotal/1.0)" },
      cache: "no-store",
    });
    const texto = await res.text();
    return NextResponse.json({
      region: process.env.VERCEL_REGION ?? "local",
      status: res.status,
      contentType: res.headers.get("content-type"),
      bytes: texto.length,
      tieneNuxt: texto.includes("__NUXT_DATA__"),
      muestra: texto.slice(0, 200),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) });
  }
}
