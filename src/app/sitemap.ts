import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const SITE_URL = "https://www.mangatotal.com";

// El catalogo cambia durante el dia, pero no hace falta consultar Postgres en
// cada visita de un robot. Next vuelve a generar el XML una vez por hora.
export const revalidate = 3600;

const PAGINAS_PUBLICAS: MetadataRoute.Sitemap = [
  { url: SITE_URL, changeFrequency: "daily", priority: 1 },
  { url: SITE_URL + "/biblioteca", changeFrequency: "daily", priority: 0.9 },
  { url: SITE_URL + "/explorar", changeFrequency: "daily", priority: 0.9 },
  { url: SITE_URL + "/noticias", changeFrequency: "daily", priority: 0.7 },
  { url: SITE_URL + "/acerca-de", changeFrequency: "monthly", priority: 0.4 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.startsWith("postgres")) {
    return PAGINAS_PUBLICAS;
  }

  try {
    const series = await db.series.findMany({
      where: { type: "normal", chapters: { some: {} } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    return [
      ...PAGINAS_PUBLICAS,
      ...series.map((serie) => ({
        url: SITE_URL + "/serie/" + encodeURIComponent(serie.slug),
        lastModified: serie.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch (error) {
    // Si Postgres se reinicia, las paginas generales siguen disponibles y las
    // series volveran a entrar en la siguiente regeneracion.
    console.error("[sitemap] No se pudo cargar el catalogo propio", error);
    return PAGINAS_PUBLICAS;
  }
}
