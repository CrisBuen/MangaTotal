import { NextResponse } from "next/server";

/**
 * Noticias de Somos Kudasai (integradas con su permiso).
 *
 * Publican un feed por categoría; el de /noticias/ trae todo junto. De ahí
 * salen titular, imagen, fecha, autor y un resumen corto.
 *
 * A propósito NO se reproduce la nota completa: se muestra el titular con un
 * resumen breve y el enlace a su sitio, que es donde se lee. Además de ser lo
 * correcto con quien la escribió, es lo que hace que la integración les sume
 * visitas en vez de quitárselas.
 */
const FEED = "https://somoskudasai.com/noticias/feed/";

/** Cuánto dura la copia antes de volver a pedirla. */
const VIDA_SEGUNDOS = 900;

/** Largo del resumen. Lo justo para saber de qué va, no para reemplazar la nota. */
const LARGO_RESUMEN = 200;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface NoticiaExterna {
  titulo: string;
  enlace: string;
  fecha: string | null;
  autor: string | null;
  categoria: string | null;
  imagen: string | null;
  resumen: string;
}

/** Saca el CDATA y las entidades más comunes de un texto del feed. */
function texto(valor: string): string {
  return valor
    .replace(/^\s*<!\[CDATA\[/, "")
    .replace(/\]\]>\s*$/, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** El contenido de una etiqueta dentro de un item. */
function etiqueta(item: string, nombre: string): string {
  const escapado = nombre.replace(":", "\\:");
  const m = item.match(new RegExp(`<${escapado}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapado}>`));
  return m ? texto(m[1]) : "";
}

/** Corta el resumen en el último espacio, para no partir una palabra. */
function acortar(valor: string): string {
  if (valor.length <= LARGO_RESUMEN) return valor;
  const corte = valor.slice(0, LARGO_RESUMEN);
  const espacio = corte.lastIndexOf(" ");
  return (espacio > 80 ? corte.slice(0, espacio) : corte).trimEnd() + "…";
}

export async function GET() {
  try {
    const res = await fetch(FEED, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml" },
      next: { revalidate: VIDA_SEGUNDOS },
    });
    if (!res.ok) {
      return NextResponse.json({ noticias: [], error: "Su sitio no respondió" }, { status: 502 });
    }

    const xml = await res.text();
    const noticias: NoticiaExterna[] = [];

    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const item = m[1];
      const enlace = etiqueta(item, "link");
      const titulo = etiqueta(item, "title");
      if (!enlace || !titulo) continue;

      const fecha = etiqueta(item, "pubDate");
      const imagen = item.match(/<media:content[^>]*\surl="([^"]+)"/)?.[1] ?? null;

      noticias.push({
        titulo,
        enlace,
        fecha: fecha ? new Date(fecha).toISOString() : null,
        autor: etiqueta(item, "dc:creator") || null,
        categoria: etiqueta(item, "category") || null,
        imagen,
        resumen: acortar(etiqueta(item, "description")),
      });
    }

    return NextResponse.json({ noticias });
  } catch {
    return NextResponse.json(
      { noticias: [], error: "No se pudo contactar con Somos Kudasai" },
      { status: 502 }
    );
  }
}
