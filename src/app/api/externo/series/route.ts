import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  LANG_GROUPS,
  allowedRatings,
  mdFetch,
  publicManga,
  type MdManga,
} from "@/lib/mangadex";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";

/**
 * GET /api/externo/series?lang=es&q=&tag=&offset=0
 * Catálogo de MangaDex filtrado por idioma disponible. Sin q ordena por
 * último capítulo subido (novedades); con q busca por relevancia.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  const seeAdult = await contenidoAdultoPermitido(user);

  const params = req.nextUrl.searchParams;
  const lang = params.get("lang") ?? "es";
  const q = params.get("q")?.trim();
  const offset = Math.min(parseInt(params.get("offset") ?? "0", 10) || 0, 9500);
  const limit = 24;
  // se piden de más porque después se descartan las series sin capítulos reales
  const fetchLimit = 48;

  const langs = LANG_GROUPS[lang] ?? LANG_GROUPS.es;

  const qs = new URLSearchParams();
  qs.set("limit", String(fetchLimit));
  qs.set("offset", String(offset));
  qs.append("includes[]", "cover_art");
  for (const l of langs) qs.append("availableTranslatedLanguage[]", l);
  for (const r of allowedRatings(seeAdult)) qs.append("contentRating[]", r);

  // origen: manga (ja), manhwa (ko), manhua (zh + zh-hk)
  for (const origin of params.getAll("origin")) {
    if (origin === "ja") qs.append("originalLanguage[]", "ja");
    else if (origin === "ko") qs.append("originalLanguage[]", "ko");
    else if (origin === "zh") {
      qs.append("originalLanguage[]", "zh");
      qs.append("originalLanguage[]", "zh-hk");
    }
  }

  // estado de publicación (uno o varios)
  for (const s of params.getAll("status")) {
    if (["ongoing", "completed", "hiatus", "cancelled"].includes(s)) {
      qs.append("status[]", s);
    }
  }
  // géneros: ids de tag de MangaDex
  for (const t of params.getAll("tag")) {
    if (/^[0-9a-f-]{36}$/i.test(t)) qs.append("includedTags[]", t);
  }

  const order = params.get("order") ?? "latest";
  if (q) {
    qs.set("title", q);
  } else {
    qs.set("hasAvailableChapters", "true");
  }
  if (!q) {
    if (order === "popular") qs.set("order[followedCount]", "desc");
    else if (order === "rating") qs.set("order[rating]", "desc");
    else if (order === "title") qs.set("order[title]", "asc");
    else qs.set("order[latestUploadedChapter]", "desc");
  }

  try {
    const data = await mdFetch<{ data: MdManga[]; total: number }>(
      `/manga?${qs.toString()}`,
      q ? 30 : 300
    );
    // MangaDex sigue listando series licenciadas cuyos capítulos ya retiró:
    // declaran el idioma pero no hay nada para leer. Se comprueba serie por
    // serie y se descartan las vacías (docs: fichas sin capítulos).
    const withCounts = await withChapterCounts(data.data, langs, seeAdult);
    const readable = withCounts.filter((item) => item.chapter_count !== 0);

    return NextResponse.json({
      series: readable.slice(0, limit),
      total: data.total,
      offset,
      limit,
    });
  } catch (err) {
    console.error("[externo] catálogo", err);
    return NextResponse.json(
      { error: "No se pudo consultar el catálogo externo" },
      { status: 502 }
    );
  }
}

/** Cuántas series se consultan a la vez (la API de MangaDex limita el ritmo). */
const CONCURRENCY = 6;

/**
 * Agrega a cada serie cuántos capítulos hay realmente en el idioma pedido.
 * `chapter_count` queda en null si la consulta falla, y en ese caso la serie
 * se conserva: ante la duda se muestra, nunca se esconde de más.
 */
async function withChapterCounts(
  mangas: MdManga[],
  langs: string[],
  seeAdult: boolean
): Promise<(ReturnType<typeof publicManga> & { chapter_count: number | null })[]> {
  const result: (ReturnType<typeof publicManga> & { chapter_count: number | null })[] = [];

  for (let i = 0; i < mangas.length; i += CONCURRENCY) {
    const lote = mangas.slice(i, i + CONCURRENCY);
    const contados = await Promise.all(
      lote.map(async (m) => {
        const qs = new URLSearchParams();
        qs.set("limit", "1"); // solo interesa el total que devuelve la respuesta
        qs.set("manga", m.id);
        for (const l of langs) qs.append("translatedLanguage[]", l);
        for (const r of allowedRatings(seeAdult)) qs.append("contentRating[]", r);

        let chapterCount: number | null = null;
        try {
          const res = await mdFetch<{ total: number }>(`/chapter?${qs.toString()}`, 3600);
          chapterCount = res.total;
        } catch {
          // rate limit o error puntual: se muestra igual
        }
        return { ...publicManga(m), chapter_count: chapterCount };
      })
    );
    result.push(...contados);
  }

  return result;
}
