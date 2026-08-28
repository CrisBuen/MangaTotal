import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { catalogoCwServidor } from "@/lib/catharsisServidor";
import { db } from "@/lib/db";
import { allowedRatings, coverUrl, mdFetch, pickText, type MdManga } from "@/lib/mangadex";
import { TMO_TIPOS, textoTmo } from "@/lib/zonatmo";

/**
 * Una serie al azar, de cualquiera de las fuentes.
 *
 * La gracia es descubrir algo que no ibas a buscar, así que sale de todo lo
 * que hay y no solo del catálogo propio. Se elige la fuente al azar y después
 * la serie: si una fuente falla —les pasa— se prueba con la siguiente, para
 * que la ruleta nunca quede trabada.
 *
 * Quedan afuera Ikigai y LeerCapítulo: la primera bloquea a los servidores y
 * la segunda no publica un listado que se pueda recorrer, así que desde acá
 * no se les puede pedir una serie cualquiera.
 */

export interface SerieAlAzar {
  fuente: string;
  fuenteNombre: string;
  titulo: string;
  portada: string | null;
  href: string;
  /** Un dato suelto para la tarjeta: cantidad de capítulos, tipo, lo que haya. */
  nota: string | null;
}

const TMO_WEB = "https://zonatmo.net";
const TMO_API = `${TMO_WEB}/wp-api/api`;
const TMO_SUBIDAS = `${TMO_WEB}/wp-content/uploads`;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const alAzar = <T,>(lista: T[]): T => lista[Math.floor(Math.random() * lista.length)];

// ── una por fuente ────────────────────────────────────────────────────────

async function delCatalogoPropio(verAdulto: boolean): Promise<SerieAlAzar | null> {
  const where = verAdulto ? {} : { type: "normal" };
  const cuantas = await db.series.count({ where });
  if (cuantas === 0) return null;

  const [serie] = await db.series.findMany({
    where,
    skip: Math.floor(Math.random() * cuantas),
    take: 1,
    select: { title: true, slug: true, type: true, coverImagePath: true },
  });
  if (!serie) return null;

  return {
    fuente: "propio",
    fuenteNombre: "MangaTotal",
    titulo: serie.title,
    portada: serie.coverImagePath ? `/api/images/${serie.coverImagePath}` : null,
    href: `/serie/${serie.slug}`,
    nota: serie.type === "adult" ? "+18" : null,
  };
}

async function deCatharsis(): Promise<SerieAlAzar | null> {
  const series = await catalogoCwServidor();
  if (series.length === 0) return null;

  const s = alAzar(series);
  return {
    fuente: "catharsis",
    fuenteNombre: "Catharsis World",
    titulo: s.nombre,
    portada: s.portada
      ? `https://direct-new-catha.catharsisfood.com/assets/${s.portada}?width=400&quality=75&format=webp`
      : null,
    href: `/externo/catharsis/${s.id}`,
    nota: `${s.capitulos} capítulos`,
  };
}

async function deMangadex(verAdulto: boolean): Promise<SerieAlAzar | null> {
  const qs = new URLSearchParams({ limit: "1", "includes[]": "cover_art" });
  // su catálogo es enorme: cae en cualquier punto de las primeras 10.000
  qs.set("offset", String(Math.floor(Math.random() * 10000)));
  for (const r of allowedRatings(verAdulto)) qs.append("contentRating[]", r);

  const data = await mdFetch<{ data: MdManga[] }>(`/manga?${qs.toString()}`, 0);
  const m = data.data?.[0];
  if (!m) return null;

  return {
    fuente: "mangadex",
    fuenteNombre: "MangaDex",
    titulo: pickText(m.attributes.title) ?? "Sin título",
    portada: coverUrl(m, 512),
    href: `/externo/${m.id}`,
    nota: m.attributes.status ?? null,
  };
}

interface ItemTmo {
  _id: number;
  title: string;
  slug: string;
  cover: string | null;
  types: number[] | null;
  total_chapters: number | null;
}

/** Su API envuelve todo en `data`, así que hay que bajar un piso. */
async function listadoTmo(pagina: number, revalidar: number) {
  const res = await fetch(`${TMO_API}/listing/manga?page=${pagina}&postsPerPage=24&order=desc`, {
    headers: { "User-Agent": UA, Accept: "application/json", Referer: `${TMO_WEB}/` },
    next: { revalidate: revalidar },
  });
  if (!res.ok) return null;

  const cuerpo = (await res.json()) as {
    data?: { items?: ItemTmo[]; pagination?: { total_pages?: number } };
  };
  return cuerpo.data ?? null;
}

async function deZonatmo(): Promise<SerieAlAzar | null> {
  // primero cuántas páginas hay de verdad: inventar un número da vacío
  const primera = await listadoTmo(1, 3600);
  const paginas = primera?.pagination?.total_pages ?? 1;

  const pagina = 1 + Math.floor(Math.random() * paginas);
  const listado = pagina === 1 ? primera : await listadoTmo(pagina, 600);

  const items = listado?.items ?? [];
  if (items.length === 0) return null;

  const s = alAzar(items);
  const portada = s.cover
    ? s.cover.startsWith("http")
      ? s.cover
      : `${TMO_SUBIDAS}/${s.cover.replace(/^\/+/, "")}`
    : null;

  // el tipo viaja en la URL de la ficha; sin él el enlace lleva a un 404.
  // Sus identificadores no siguen ningún orden (87 es Manhwa, 31 Manhua), así
  // que se lee de la misma tabla que usa el resto de la fuente.
  const nombreTipo = TMO_TIPOS.find((t) => t.id === String(s.types?.[0]))?.name ?? "Manga";
  const tipo = nombreTipo.toLowerCase().replace(/\s+/g, "-");

  return {
    fuente: "tmo",
    fuenteNombre: "ZonaTMO",
    titulo: textoTmo(s.title) || "Sin título",
    portada,
    href: `/externo/tmo/${tipo}/${s._id}/${s.slug}`,
    nota: s.total_chapters ? `${s.total_chapters} capítulos` : null,
  };
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  const verAdulto = Boolean(user?.showAdultContent);

  // la que acaba de salir, para no repetirla dos veces seguidas
  const evitar = req.nextUrl.searchParams.get("evitar") ?? "";

  const fuentes: (() => Promise<SerieAlAzar | null>)[] = [
    () => delCatalogoPropio(verAdulto),
    () => deCatharsis(),
    () => deMangadex(verAdulto),
    () => deZonatmo(),
  ];

  // se barajan y se prueban en ese orden: si una fuente está caída, la
  // siguiente responde y la ruleta sigue girando
  const orden = [...fuentes].sort(() => Math.random() - 0.5);

  for (const traer of orden) {
    try {
      const serie = await traer();
      if (serie && serie.href !== evitar) {
        return NextResponse.json(serie, { headers: { "Cache-Control": "no-store" } });
      }
    } catch {
      // esta fuente no contestó: se prueba con la que sigue
    }
  }

  return NextResponse.json({ error: "Ninguna fuente respondió" }, { status: 502 });
}
