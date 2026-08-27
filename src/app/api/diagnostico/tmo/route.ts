import { NextResponse } from "next/server";

/** Diagnóstico temporal: ¿responde ZonaTMO desde los servidores de Vercel? */
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const PRUEBAS = [
  "https://zonatmo.org/biblioteca",
  "https://zonatmo.org/library/manga/1682/gachiakuta",
  "https://zonatmo.org/view_uploads/1016454",
  "https://storage2.zonatmo.org/chapters/1016454/1.webp",
];

export async function GET() {
  const resultados = [];

  for (const url of PRUEBAS) {
    const inicio = Date.now();
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,image/webp,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9",
        },
        cache: "no-store",
      });
      const esImagen = (res.headers.get("content-type") ?? "").startsWith("image");
      const cuerpo = esImagen ? "" : await res.text();
      resultados.push({
        url,
        status: res.status,
        ms: Date.now() - inicio,
        contentType: res.headers.get("content-type"),
        bytes: esImagen ? Number(res.headers.get("content-length") ?? 0) : cuerpo.length,
        pistas: esImagen
          ? null
          : {
              series: (cuerpo.match(/\/library\/[a-z]+\/\d+\//g) ?? []).length,
              capitulos: (cuerpo.match(/view_uploads\/\d+/g) ?? []).length,
              paginas: (cuerpo.match(/reader-img-wrap/g) ?? []).length,
              esDesafio: /challenge|jschl|turnstile|cf-browser/i.test(cuerpo.slice(0, 3000)),
            },
      });
    } catch (err) {
      resultados.push({ url, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ region: process.env.VERCEL_REGION ?? "local", resultados });
}
