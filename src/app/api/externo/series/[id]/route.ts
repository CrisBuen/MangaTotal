import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  LANG_GROUPS,
  groupChaptersByNumber,
  mdFetch,
  publicChapter,
  publicManga,
  type MdChapter,
  type MdManga,
} from "@/lib/mangadex";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/externo/series/:id?lang=es — ficha de una serie de MangaDex con
 * su lista de capítulos en el idioma pedido (orden por número).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  const seeAdult = Boolean(user?.showAdultContent || user?.isAdmin);

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  }

  const lang = req.nextUrl.searchParams.get("lang") ?? "es";
  const langs = LANG_GROUPS[lang] ?? LANG_GROUPS.es;

  try {
    const mangaRes = await mdFetch<{ data: MdManga }>(
      `/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`,
      300
    );
    const series = publicManga(mangaRes.data);

    if (series.is_adult && !seeAdult) {
      return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
    }

    // Los capítulos vienen paginados de a 100 y se recorren todos: una serie
    // larga tiene que llegar hasta su último capítulo, no cortarse por la
    // mitad. El total lo dice la propia respuesta.
    const chapters: MdChapter[] = [];
    let totalCapitulos = Infinity;
    for (let offset = 0; offset < totalCapitulos; offset += 100) {
      const qs = new URLSearchParams();
      qs.set("limit", "100");
      qs.set("offset", String(offset));
      qs.set("manga", id);
      qs.set("order[chapter]", "asc");
      qs.append("includes[]", "scanlation_group");
      for (const l of langs) qs.append("translatedLanguage[]", l);
      for (const r of ["safe", "suggestive", "erotica", "pornographic"]) {
        qs.append("contentRating[]", r);
      }

      const page = await mdFetch<{ data: MdChapter[]; total: number }>(
        `/chapter?${qs.toString()}`,
        120
      );
      totalCapitulos = page.total;
      chapters.push(...page.data);
      // si deja de mandar datos, no hay más que traer
      if (page.data.length === 0) break;
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
