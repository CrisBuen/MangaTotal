import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import { catalogo as catalogoOlympus } from "@/lib/olympus";
import { imagenCw } from "@/lib/catharsis";
import { catalogoCwServidor, normalizarCw } from "@/lib/catharsisServidor";
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

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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

  // Consultar todas las fuentes concurrentemente directamente desde el servidor
  const promesas: Promise<GrupoFuenteMigracion>[] = [
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

    // 2. LeerCapítulo (búsqueda directa contra su endpoint JSON)
    fetch(`https://www.leercapitulo.co/search-autocomplete?term=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json,text/html",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      next: { revalidate: 180 },
    })
      .then(async (res) => {
        if (!res.ok) return { source: "leercapitulo", sourceNombre: "LeerCapítulo", items: [] };
        const items = (await res.json()) as { label?: string; value?: string; link?: string; thumbnail?: string }[];
        if (!Array.isArray(items)) return { source: "leercapitulo", sourceNombre: "LeerCapítulo", items: [] };
        const parsed: ItemResultadoMigracion[] = [];
        for (const item of items) {
          const m = item.link?.match(/^\/manga\/([a-z0-9]+)\/([^/?#]+)\/?$/i);
          const title = (item.label ?? item.value ?? "").trim();
          if (!m || !title) continue;
          const id = m[1];
          const slug = m[2];
          const cover = item.thumbnail
            ? item.thumbnail.startsWith("http")
              ? item.thumbnail
              : `https://www.leercapitulo.co${item.thumbnail}`
            : null;
          parsed.push({
            id: `${id}/${slug}`,
            slug,
            title,
            coverUrl: cover,
            source: "leercapitulo",
            sourceNombre: "LeerCapítulo",
            type: "manga",
          });
        }
        return { source: "leercapitulo", sourceNombre: "LeerCapítulo", items: parsed };
      })
      .catch(() => ({ source: "leercapitulo", sourceNombre: "LeerCapítulo", items: [] })),

    // 3. ZonaTMO (búsqueda directa contra su endpoint de listado)
    fetch(
      `https://zonatmo.net/wp-api/api/listing/?itemsPerPage=24&page=1&title=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          "Accept-Language": "es-ES,es;q=0.9",
          Referer: "https://zonatmo.net/",
        },
        next: { revalidate: 180 },
      }
    )
      .then(async (res) => {
        if (!res.ok) return { source: "tmo", sourceNombre: "ZonaTMO", items: [] };
        const json = (await res.json()) as { data?: { items?: any[] } };
        const rawItems = json?.data?.items ?? [];
        const items: ItemResultadoMigracion[] = rawItems.map((it: any) => {
          const tipo = (it.type || "manga").toLowerCase().replace(/\s+/g, "_");
          return {
            id: `${tipo}/${it.id}/${it.slug}`,
            slug: it.slug ?? null,
            title: it.name ?? "Sin título",
            coverUrl: it.thumbnail ?? null,
            source: "tmo",
            sourceNombre: "ZonaTMO",
            type: tipo,
          };
        });
        return { source: "tmo", sourceNombre: "ZonaTMO", items };
      })
      .catch(() => ({ source: "tmo", sourceNombre: "ZonaTMO", items: [] })),

    // 4. Catharsis World (directo contra la caché en memoria del servidor)
    catalogoCwServidor()
      .then((todas) => {
        const buscado = normalizarCw(query);
        const coincidencias = todas.filter((s) => normalizarCw(s.nombre).includes(buscado)).slice(0, 20);
        return {
          source: "catharsis",
          sourceNombre: "Catharsis World",
          items: coincidencias.map((s): ItemResultadoMigracion => ({
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

    // 5. MangaDex
    mdFetch<{ data: any[] }>(`/manga?title=${encodeURIComponent(query)}&limit=10&includes[]=cover_art`)
      .then((res) => {
        const series = res?.data ?? [];
        return {
          source: "mangadex",
          sourceNombre: "MangaDex",
          items: series.map((m: any): ItemResultadoMigracion => {
            const pub = publicManga(m, 256);
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
              capitulosTexto: s.filecount ? `${s.filecount} págs.` : undefined,
              totalCapitulos: 1,
            })),
          };
        })
        .catch(() => ({ source: "ehentai", sourceNombre: "E-Hentai (+18)", items: [] })),

      catalogoHitomi({ busqueda: query, pagina: 1 })
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
              capitulosTexto: s.filecount ? `${s.filecount} págs.` : undefined,
              totalCapitulos: 1,
            })),
          };
        })
        .catch(() => ({ source: "hitomi", sourceNombre: "Hitomi.la (+18)", items: [] }))
    );
  }

  const fuentes = await Promise.all(promesas);
  return NextResponse.json({ fuentes });
}
