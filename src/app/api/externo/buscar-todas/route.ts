import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import { catalogo as catalogoOlympus } from "@/lib/olympus";
import { catalogoIkigai } from "@/lib/ikigai";
import { catalogoLc } from "@/lib/leercapitulo";
import { catalogoTmo } from "@/lib/zonatmo";
import { catalogoCw, imagenCw } from "@/lib/catharsis";
import { mdFetch, coverUrl as coverUrlMd, publicManga } from "@/lib/mangadex";
import { catalogoEhentai } from "@/lib/ehentai";
import { catalogoHitomi } from "@/lib/hitomi";

export const dynamic = "force-dynamic";

export interface ItemResultadoMigracion {
  id: string;
  slug?: string | null;
  title: string;
  coverUrl?: string | null;
  source: string;
  sourceNombre: string;
  type?: string | null;
  capitulosTexto?: string | null;
  totalCapitulos?: number | null;
}

export interface GrupoFuenteMigracion {
  source: string;
  sourceNombre: string;
  items: ItemResultadoMigracion[];
}

/**
 * GET /api/externo/buscar-todas?q=<query>
 *
 * Busca en todas las fuentes de lectura integradas en paralelo para permitir
 * la migración fluida de obras entre fuentes.
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query || query.length < 2) {
    return NextResponse.json({ fuentes: [] });
  }

  const user = await getSessionUser();
  const adultoPermitido = await contenidoAdultoPermitido(user);

  // Consultar todas las fuentes concurrentemente
  const promesas = [
    // 1. Olympus
    catalogoOlympus(1, { q: query })
      .then((res) => {
        const series = res?.series ?? [];
        return {
          source: "olympus",
          sourceNombre: "Olympus Scanlation",
          items: series.map((s): ItemResultadoMigracion => ({
            id: s.slug || String(s.id),
            slug: s.slug ?? null,
            title: s.title ?? "Sin título",
            coverUrl: s.cover_url ?? null,
            source: "olympus",
            sourceNombre: "Olympus Scanlation",
            type: s.type ?? "comic",
            capitulosTexto: s.chapter_count ? `${s.chapter_count} caps.` : undefined,
            totalCapitulos: s.chapter_count ?? null,
          })),
        };
      })
      .catch(() => ({ source: "olympus", sourceNombre: "Olympus Scanlation", items: [] })),

    // 2. Ikigai
    catalogoIkigai(1, { q: query })
      .then((res) => {
        const series = res?.series ?? [];
        return {
          source: "ikigai",
          sourceNombre: "Ikigai Mangas",
          items: series.map((s: any): ItemResultadoMigracion => ({
            id: s.slug || String(s.id),
            slug: s.slug ?? null,
            title: s.title ?? "Sin título",
            coverUrl: s.cover_url ?? s.image ?? null,
            source: "ikigai",
            sourceNombre: "Ikigai Mangas",
            type: "manga",
            capitulosTexto: s.chapters_count ? `${s.chapters_count} caps.` : undefined,
            totalCapitulos: s.chapters_count ?? null,
          })),
        };
      })
      .catch(() => ({ source: "ikigai", sourceNombre: "Ikigai Mangas", items: [] })),

    // 3. LeerCapítulo
    catalogoLc(1, { q: query })
      .then((res) => {
        const series = res?.series ?? [];
        return {
          source: "leercapitulo",
          sourceNombre: "LeerCapítulo",
          items: series.map((s: any): ItemResultadoMigracion => ({
            id: `${s.id}/${s.slug}`,
            slug: s.slug ?? null,
            title: s.title ?? "Sin título",
            coverUrl: s.cover_url ?? s.cover ?? null,
            source: "leercapitulo",
            sourceNombre: "LeerCapítulo",
            type: "manga",
            capitulosTexto: s.chapters_count ? `${s.chapters_count} caps.` : undefined,
            totalCapitulos: s.chapters_count ?? null,
          })),
        };
      })
      .catch(() => ({ source: "leercapitulo", sourceNombre: "LeerCapítulo", items: [] })),

    // 4. ZonaTMO
    catalogoTmo(1, { q: query })
      .then((res) => {
        const series = res?.series ?? [];
        return {
          source: "tmo",
          sourceNombre: "ZonaTMO",
          items: series.map((s): ItemResultadoMigracion => ({
            id: `${s.tipo}/${s.id}/${s.slug}`,
            slug: s.slug ?? null,
            title: s.title ?? "Sin título",
            coverUrl: s.cover_url ?? null,
            source: "tmo",
            sourceNombre: "ZonaTMO",
            type: s.tipo ?? "manga",
          })),
        };
      })
      .catch(() => ({ source: "tmo", sourceNombre: "ZonaTMO", items: [] })),

    // 5. Catharsis
    catalogoCw({ busqueda: query })
      .then((res) => {
        const series = res?.series ?? [];
        return {
          source: "catharsis",
          sourceNombre: "Catharsis World",
          items: series.map((s): ItemResultadoMigracion => ({
            id: s.id,
            slug: null,
            title: s.nombre ?? "Sin título",
            coverUrl: s.portada ? imagenCw(s.portada, 256) : null,
            source: "catharsis",
            sourceNombre: "Catharsis World",
            type: "manga",
            capitulosTexto: s.capitulos ? `${s.capitulos} caps.` : undefined,
            totalCapitulos: s.capitulos ?? null,
          })),
        };
      })
      .catch(() => ({ source: "catharsis", sourceNombre: "Catharsis World", items: [] })),

    // 6. MangaDex
    mdFetch<{ data: any[] }>(`/manga?title=${encodeURIComponent(query)}&limit=10&includes[]=cover_art`)
      .then((res) => {
        const series = res?.data ?? [];
        return {
          source: "mangadex",
          sourceNombre: "MangaDex",
          items: series.map((m: any): ItemResultadoMigracion => {
            const pub = publicManga(m);
            const lastCap = m.attributes?.lastChapter;
            return {
              id: m.id,
              slug: null,
              title: pub.title ?? "Sin título",
              coverUrl: coverUrlMd(m, 256),
              source: "mangadex",
              sourceNombre: "MangaDex",
              type: "manga",
              capitulosTexto: lastCap ? `Cap. ${lastCap}` : undefined,
            };
          }),
        };
      })
      .catch(() => ({ source: "mangadex", sourceNombre: "MangaDex", items: [] })),
  ];

  // Si tiene +18 habilitado, agregar E-Hentai y Hitomi
  if (adultoPermitido) {
    promesas.push(
      catalogoEhentai({ busqueda: query })
        .then((res) => {
          const series = res?.series ?? [];
          return {
            source: "ehentai",
            sourceNombre: "E-Hentai (+18)",
            items: series.map((s): ItemResultadoMigracion => ({
              id: `${s.gid}/${s.token}`,
              slug: `${s.gid}/${s.token}`,
              title: s.title,
              coverUrl: s.thumb,
              source: "ehentai",
              sourceNombre: "E-Hentai (+18)",
              type: "adult",
              capitulosTexto: `${s.filecount} págs.`,
              totalCapitulos: 1,
            })),
          };
        })
        .catch(() => ({ source: "ehentai", sourceNombre: "E-Hentai (+18)", items: [] }))
    );

    promesas.push(
      catalogoHitomi({ busqueda: query })
        .then((res) => {
          const series = res?.series ?? [];
          return {
            source: "hitomi",
            sourceNombre: "Hitomi.la (+18)",
            items: series.map((s): ItemResultadoMigracion => ({
              id: s.id,
              slug: s.id,
              title: s.title,
              coverUrl: s.thumb,
              source: "hitomi",
              sourceNombre: "Hitomi.la (+18)",
              type: "adult",
              capitulosTexto: `${s.filecount} págs.`,
              totalCapitulos: 1,
            })),
          };
        })
        .catch(() => ({ source: "hitomi", sourceNombre: "Hitomi.la (+18)", items: [] }))
    );
  }

  const resultados = await Promise.all(promesas);
  // Retornar solo las fuentes que tuvieron resultados
  const fuentesConResultados = resultados.filter((g) => g.items.length > 0);

  return NextResponse.json({ fuentes: fuentesConResultados });
}
