import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { catalogoCwServidor } from "@/lib/catharsisServidor";
import { db } from "@/lib/db";
import { allowedRatings, coverUrl, mdFetch, pickText, type MdManga } from "@/lib/mangadex";
import { TMO_TIPOS, textoTmo } from "@/lib/zonatmo";

/**
 * El top de la semana: series destacadas de todas las fuentes.
 *
 * "Top" y no "las más nuevas": de cada fuente se pide lo que ella considera
 * destacado —lo más seguido en MangaDex, lo mejor puntuado en ZonaTMO, lo
 * más largo en Catharsis— y después se mezcla.
 *
 * La mezcla NO es al azar en cada carga: se siembra con el número de semana,
 * así que la lista se mantiene igual durante toda la semana y cambia sola el
 * lunes. Un top que cambia cada vez que recargás no es un top, y uno que no
 * cambia nunca termina mostrando siempre lo mismo.
 */

export interface SerieDelTop {
  fuente: string;
  fuenteNombre: string;
  titulo: string;
  portada: string | null;
  href: string;
  nota: string | null;
}

const CUANTAS = 18;

/** Cuántas trae cada fuente antes de mezclar. */
const POR_FUENTE = 8;

const TMO_WEB = "https://zonatmo.net";
const TMO_SUBIDAS = `${TMO_WEB}/wp-content/uploads`;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Año y número de semana: el mismo valor durante siete días. */
function semanaDelAno(fecha = new Date()): number {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  // el jueves de esa semana define a qué año pertenece
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const enero = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d.getTime() - enero.getTime()) / 86400000 + 1) / 7);
  return d.getUTCFullYear() * 100 + semana;
}

/** Números pseudoaleatorios repetibles: la misma semilla da la misma serie. */
function azarConSemilla(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Baraja sin sorpresas: con la misma semilla sale siempre igual. */
function barajar<T>(lista: T[], azar: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// ── una por fuente ────────────────────────────────────────────────────────

async function delCatalogoPropio(verAdulto: boolean): Promise<SerieDelTop[]> {
  const series = await db.series.findMany({
    where: verAdulto ? {} : { type: "normal" },
    orderBy: { updatedAt: "desc" },
    take: POR_FUENTE,
    select: { title: true, slug: true, coverImagePath: true, _count: { select: { chapters: true } } },
  });

  return series.map((s) => ({
    fuente: "propio",
    fuenteNombre: "MangaTotal",
    titulo: s.title,
    portada: s.coverImagePath ? `/api/images/${s.coverImagePath}` : null,
    href: `/serie/${s.slug}`,
    nota: s._count.chapters > 0 ? `${s._count.chapters} capítulos` : null,
  }));
}

async function deCatharsis(): Promise<SerieDelTop[]> {
  const series = await catalogoCwServidor();
  // las más largas: en Catharsis es la mejor señal de una serie establecida.
  // Se dejan fuera las novelas de texto: tienen capítulos, así que pasan el
  // filtro del catálogo, pero no se leen como manga y desentonan en un top.
  return [...series]
    .filter((s) => !/novela/i.test(s.nombre))
    .sort((a, b) => b.capitulos - a.capitulos)
    .slice(0, POR_FUENTE * 3)
    .map((s) => ({
      fuente: "catharsis",
      fuenteNombre: "Catharsis World",
      titulo: s.nombre,
      portada: s.portada
        ? `https://direct-new-catha.catharsisfood.com/assets/${s.portada}?width=400&quality=75&format=webp`
        : null,
      href: `/externo/catharsis/${s.id}`,
      nota: `${s.capitulos} capítulos`,
    }));
}

async function deMangadex(verAdulto: boolean): Promise<SerieDelTop[]> {
  const qs = new URLSearchParams({ limit: String(POR_FUENTE * 2), "includes[]": "cover_art" });
  qs.set("order[followedCount]", "desc");
  for (const r of allowedRatings(verAdulto)) qs.append("contentRating[]", r);

  const data = await mdFetch<{ data: MdManga[] }>(`/manga?${qs.toString()}`, 3600);
  return (data.data ?? []).map((m) => ({
    fuente: "mangadex",
    fuenteNombre: "MangaDex",
    titulo: pickText(m.attributes.title) ?? "Sin título",
    portada: coverUrl(m, 512),
    href: `/externo/${m.id}`,
    nota: m.attributes.status ?? null,
  }));
}

interface ItemTmo {
  _id: number;
  title: string;
  slug: string;
  cover: string | null;
  types: number[] | null;
  total_chapters: number | null;
}

async function deZonatmo(): Promise<SerieDelTop[]> {
  const res = await fetch(
    `${TMO_WEB}/wp-api/api/listing/manga?page=1&postsPerPage=${POR_FUENTE * 2}&order=desc&orderBy=vote_count`,
    {
      headers: { "User-Agent": UA, Accept: "application/json", Referer: `${TMO_WEB}/` },
      next: { revalidate: 3600 },
    }
  );
  if (!res.ok) return [];

  const cuerpo = (await res.json()) as { data?: { items?: ItemTmo[] } };
  return (cuerpo.data?.items ?? []).map((s) => {
    const nombreTipo = TMO_TIPOS.find((t) => t.id === String(s.types?.[0]))?.name ?? "Manga";
    return {
      fuente: "tmo",
      fuenteNombre: "ZonaTMO",
      titulo: textoTmo(s.title) || "Sin título",
      portada: s.cover
        ? s.cover.startsWith("http")
          ? s.cover
          : `${TMO_SUBIDAS}/${s.cover.replace(/^\/+/, "")}`
        : null,
      href: `/externo/tmo/${nombreTipo.toLowerCase().replace(/\s+/g, "-")}/${s._id}/${s.slug}`,
      nota: s.total_chapters ? `${s.total_chapters} capítulos` : null,
    };
  });
}

export async function GET() {
  const user = await getSessionUser();
  const verAdulto = Boolean(user?.showAdultContent);

  // si una fuente está caída, el top sale igual con las demás
  const porFuente = await Promise.all(
    [
      delCatalogoPropio(verAdulto),
      deCatharsis(),
      deMangadex(verAdulto),
      deZonatmo(),
    ].map((p) => p.catch(() => [] as SerieDelTop[]))
  );

  const azar = azarConSemilla(semanaDelAno());

  // de cada fuente se toma una tajada al azar de entre sus destacadas, y
  // después se mezcla todo: así conviven las cuatro en vez de quedar
  // agrupadas por fuente
  const candidatas = porFuente.flatMap((lista) => barajar(lista, azar).slice(0, POR_FUENTE));

  const vistas = new Set<string>();
  const series = barajar(candidatas, azar)
    .filter((s) => {
      const clave = s.fuente + ":" + s.href;
      if (vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    })
    .slice(0, CUANTAS);

  return NextResponse.json({ series, semana: semanaDelAno() });
}
