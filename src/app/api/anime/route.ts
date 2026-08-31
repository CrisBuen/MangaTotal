import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  MEDIA_CARD_FIELDS,
  aniFetch,
  currentSeason,
  publicAnimeCard,
  type AniPage,
} from "@/lib/anilist";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";

const SORTS: Record<string, string> = {
  popular: "POPULARITY_DESC",
  score: "SCORE_DESC",
  trending: "TRENDING_DESC",
  newest: "START_DATE_DESC",
  title: "TITLE_ROMAJI",
};

const FORMATS = new Set(["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA"]);
const STATUSES = new Set(["FINISHED", "RELEASING", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"]);
const SEASONS = new Set(["WINTER", "SPRING", "SUMMER", "FALL"]);

const QUERY = `
  query (
    $page: Int, $perPage: Int, $search: String, $sort: [MediaSort],
    $genres: [String], $format: MediaFormat, $status: MediaStatus,
    $season: MediaSeason, $seasonYear: Int, $isAdult: Boolean
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage }
      media(
        type: ANIME, search: $search, sort: $sort, genre_in: $genres,
        format: $format, status: $status, season: $season,
        seasonYear: $seasonYear, isAdult: $isAdult
      ) {
        ${MEDIA_CARD_FIELDS}
      }
    }
  }
`;

/**
 * GET /api/anime — catálogo de anime desde AniList.
 * Parámetros: q, sort, genre (repetible), format, status, season, year, page.
 * `season=actual` resuelve la temporada en emisión.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const verAdulto = await contenidoAdultoPermitido(user);

  const search = params.get("q")?.trim() || undefined;
  const sortKey = params.get("sort") ?? "popular";
  const page = Math.min(Math.max(parseInt(params.get("page") ?? "1", 10) || 1, 1), 100);

  const format = params.get("format");
  const status = params.get("status");
  const genres = params.getAll("genre").filter(Boolean);

  let season = params.get("season") ?? undefined;
  let year = params.get("year") ? parseInt(params.get("year") as string, 10) : undefined;
  if (season === "actual") {
    const now = currentSeason();
    season = now.season;
    year = now.year;
  }

  const variables: Record<string, unknown> = {
    page,
    perPage: 24,
    search,
    // al buscar por texto manda la relevancia; si no, el orden elegido
    sort: search ? ["SEARCH_MATCH"] : [SORTS[sortKey] ?? SORTS.popular],
    genres: genres.length > 0 ? genres : undefined,
    format: format && FORMATS.has(format) ? format : undefined,
    status: status && STATUSES.has(status) ? status : undefined,
    season: season && SEASONS.has(season) ? season : undefined,
    seasonYear: Number.isFinite(year) ? year : undefined,
    // el contenido adulto solo si el perfil lo permite
    isAdult: verAdulto ? undefined : false,
  };

  try {
    const data = await aniFetch<{ Page: AniPage }>(QUERY, variables, search ? 60 : 600);
    return NextResponse.json({
      anime: data.Page.media.map(publicAnimeCard),
      page: data.Page.pageInfo.currentPage,
      last_page: Math.min(data.Page.pageInfo.lastPage, 100),
      total: data.Page.pageInfo.total,
    });
  } catch (err) {
    console.error("[anime] catálogo", err);
    return NextResponse.json({ error: "No se pudo cargar el catálogo de anime" }, { status: 502 });
  }
}
