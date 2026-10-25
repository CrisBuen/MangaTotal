import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  LANG_GROUPS,
  allowedRatings,
  groupChaptersByNumber,
  mdFetch,
  publicChapter,
  publicManga,
  type MdChapter,
  type MdManga,
} from "@/lib/mangadex";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildChapterQuery(id: string, offset: number, langs: string[], seeAdult: boolean): string {
  const qs = new URLSearchParams();
  qs.set("limit", "100");
  qs.set("offset", String(offset));
  qs.set("manga", id);
  qs.set("order[chapter]", "asc");
  qs.append("includes[]", "scanlation_group");
  for (const l of langs) qs.append("translatedLanguage[]", l);
  for (const r of allowedRatings(seeAdult)) {
    qs.append("contentRating[]", r);
  }
  return qs.toString();
}

/**
 * GET /api/externo/series/:id?lang=es — ficha de una serie de MangaDex con
 * su lista de capítulos en el idioma pedido (orden por número).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  const seeAdult = await contenidoAdultoPermitido(user);

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  }

  const lang = req.nextUrl.searchParams.get("lang") ?? "es";
  const fresco = req.nextUrl.searchParams.get("fresco") === "1";
  const langs = LANG_GROUPS[lang] ?? LANG_GROUPS.es;

  try {
    // Pedir ficha y primera página de capítulos en paralelo ahorra un viaje completo de red.
    const [mangaRes, firstPage] = await Promise.all([
      mdFetch<{ data: MdManga }>(
        `/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`,
        fresco ? 0 : 300
      ),
      mdFetch<{ data: MdChapter[]; total: number }>(
        `/chapter?${buildChapterQuery(id, 0, langs, seeAdult)}`,
        fresco ? 0 : 120
      ),
    ]);

    const series = publicManga(mangaRes.data, 512);

    if (series.is_adult && !seeAdult) {
      return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
    }

    const chapters: MdChapter[] = [...firstPage.data];
    const totalCapitulos = firstPage.total;

    // Si hay más de 100 capítulos, pedir los bloques restantes en lotes paralelos de 4.
    if (totalCapitulos > 100 && firstPage.data.length > 0) {
      const offsets: number[] = [];
      for (let offset = 100; offset < totalCapitulos; offset += 100) {
        offsets.push(offset);
      }
      const BATCH_SIZE = 4;
      for (let i = 0; i < offsets.length; i += BATCH_SIZE) {
        const batch = offsets.slice(i, i + BATCH_SIZE);
        const pages = await Promise.all(
          batch.map((offset) =>
            mdFetch<{ data: MdChapter[]; total: number }>(
              `/chapter?${buildChapterQuery(id, offset, langs, seeAdult)}`,
              fresco ? 0 : 120
            )
          )
        );
        for (const page of pages) {
          chapters.push(...page.data);
        }
      }
    }

    const all = chapters.map(publicChapter);
    return NextResponse.json({
      series,
      // una fila por número, con todas las versiones de cada grupo
      chapters: groupChaptersByNumber(all),
      // capítulos que el grupo aloja en su sitio: se enlazan aparte
      external: all.filter((c) => c.external_url),
    });
  } catch (err) {
    console.error("[externo] ficha", err);
    return NextResponse.json({ error: "No se pudo cargar la serie" }, { status: 502 });
  }
}
