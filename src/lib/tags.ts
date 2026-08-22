import { db } from "./db";
import { slugify } from "./slug";

/** Limpia una lista de nombres de tag: recorta, deduplica por slug, filtra vacíos. */
export function normalizeTagNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const name = item.trim().replace(/\s+/g, " ");
    if (!name || name.length > 40) continue;
    const slug = slugify(name);
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(name);
  }
  return out;
}

/** Reemplaza los tags de una serie (crea los que no existan, borra huérfanos). */
export async function setSeriesTags(seriesId: number, names: string[]): Promise<void> {
  await db.series.update({
    where: { id: seriesId },
    data: {
      tags: {
        set: [],
        connectOrCreate: names.map((name) => ({
          where: { slug: slugify(name) },
          create: { name, slug: slugify(name) },
        })),
      },
    },
  });
  // tags sin ninguna serie ya no aportan nada
  await db.tag.deleteMany({ where: { series: { none: {} } } });
}

export function publicTag(tag: { id: number; name: string; slug: string }) {
  return { id: tag.id, name: tag.name, slug: tag.slug };
}
