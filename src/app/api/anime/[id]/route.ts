import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  MEDIA_CARD_FIELDS,
  aniFetch,
  publicAnimeDetail,
  type AniMedia,
} from "@/lib/anilist";

const QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${MEDIA_CARD_FIELDS}
      description(asHtml: false)
      duration
      bannerImage
      studios(isMain: true) { nodes { name } }
      externalLinks { site url type language }
      trailer { id site }
      nextAiringEpisode { episode airingAt }
      relations {
        edges {
          relationType
          node { ${MEDIA_CARD_FIELDS} }
        }
      }
    }
  }
`;

/** GET /api/anime/:id — ficha completa de un anime. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  const { id: raw } = await ctx.params;
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  }

  try {
    const data = await aniFetch<{ Media: AniMedia }>(QUERY, { id }, 600);
    if (!data.Media) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    if (data.Media.isAdult && !(user?.showAdultContent || user?.isAdmin)) {
      return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
    }

    return NextResponse.json(publicAnimeDetail(data.Media));
  } catch (err) {
    console.error("[anime] ficha", err);
    return NextResponse.json({ error: "No se pudo cargar el anime" }, { status: 502 });
  }
}
