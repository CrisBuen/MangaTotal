import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  LANG_GROUPS,
  allowedRatings,
  mdFetch,
  publicManga,
  type MdManga,
} from "@/lib/mangadex";

/**
 * GET /api/externo/series?lang=es&q=&tag=&offset=0
 * Catálogo de MangaDex filtrado por idioma disponible. Sin q ordena por
 * último capítulo subido (novedades); con q busca por relevancia.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  const seeAdult = Boolean(user?.showAdultContent || user?.isAdmin);

  const params = req.nextUrl.searchParams;
  const lang = params.get("lang") ?? "es";
  const q = params.get("q")?.trim();
  const offset = Math.min(parseInt(params.get("offset") ?? "0", 10) || 0, 9500);
  const limit = 24;

  const langs = LANG_GROUPS[lang] ?? LANG_GROUPS.es;

  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));
  qs.append("includes[]", "cover_art");
  for (const l of langs) qs.append("availableTranslatedLanguage[]", l);
  for (const r of allowedRatings(seeAdult)) qs.append("contentRating[]", r);
  if (q) {
    qs.set("title", q);
  } else {
    qs.set("order[latestUploadedChapter]", "desc");
    qs.set("hasAvailableChapters", "true");
  }

  try {
    const data = await mdFetch<{ data: MdManga[]; total: number }>(
      `/manga?${qs.toString()}`,
      q ? 30 : 300
    );
    return NextResponse.json({
      series: data.data.map(publicManga),
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
