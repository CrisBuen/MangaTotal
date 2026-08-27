import { NextResponse } from "next/server";

/**
 * Diagnóstico temporal: comprueba si la API de Olympus responde desde los
 * servidores de Vercel (IPs de centro de datos), que es donde Cloudflare
 * suele bloquear. Se elimina una vez confirmado.
 */
export const dynamic = "force-dynamic";

const SLUG = "academia-de-la-ascension-20260826-110500580";

const PRUEBAS = [
  "https://olympusxyz.com/api/series?page=1",
  `https://olympusxyz.com/api/series/${SLUG}`,
  `https://panel.olympusxyz.com/api/series/${SLUG}/chapters?page=1`,
  "https://media.imagesolymp.xyz/comics/226/132212/0.webp",
];

export async function GET() {
  const resultados = [];

  for (const url of PRUEBAS) {
    const inicio = Date.now();
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "MangaTotal/1.0 (+https://manga-total.vercel.app)",
          Accept: "application/json",
        },
        cache: "no-store",
      });
      const texto = await res.text();
      let elementos = null;
      try {
        const json = JSON.parse(texto);
        const d = json?.data?.series?.data ?? json?.data;
        elementos = Array.isArray(d) ? d.length : d ? Object.keys(d).length : null;
      } catch {
        // no-JSON: puede ser una imagen o un desafío de Cloudflare
      }
      resultados.push({
        url,
        status: res.status,
        ms: Date.now() - inicio,
        contentType: res.headers.get("content-type"),
        elementos,
        muestra: texto.slice(0, 160),
      });
    } catch (err) {
      resultados.push({
        url,
        error: err instanceof Error ? err.message : String(err),
        ms: Date.now() - inicio,
      });
    }
  }

  return NextResponse.json({ region: process.env.VERCEL_REGION ?? "local", resultados });
}
