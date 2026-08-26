import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { mdFetch, publicChapter, type MdChapter } from "@/lib/mangadex";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AtHome {
  baseUrl: string;
  chapter: { hash: string; data: string[]; dataSaver: string[] };
}

/**
 * GET /api/externo/capitulos/:id — páginas de un capítulo de MangaDex.
 * Las URLs apuntan al nodo MangaDex@Home asignado: las imágenes viajan
 * directo de sus servidores al navegador, sin pasar por Vercel.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  }

  try {
    const [chapterRes, atHome] = await Promise.all([
      mdFetch<{ data: MdChapter }>(
        `/chapter/${id}?includes[]=scanlation_group&includes[]=manga`,
        300
      ),
      // el nodo asignado caduca: caché corta
      mdFetch<AtHome>(`/at-home/server/${id}`, 60),
    ]);

    const chapter = publicChapter(chapterRes.data);
    if (chapter.external_url) {
      return NextResponse.json(
        { error: "Este capítulo se lee en el sitio del grupo", external_url: chapter.external_url },
        { status: 409 }
      );
    }

    const mangaRel = chapterRes.data.relationships.find((r) => r.type === "manga");
    const pages = atHome.chapter.data.map((file, i) => ({
      pageNumber: i + 1,
      url: `${atHome.baseUrl}/data/${atHome.chapter.hash}/${file}`,
    }));

    return NextResponse.json({
      chapter,
      series_id: mangaRel?.id ?? null,
      pages,
    });
  } catch (err) {
    console.error("[externo] capítulo", err);
    return NextResponse.json({ error: "No se pudo cargar el capítulo" }, { status: 502 });
  }
}
