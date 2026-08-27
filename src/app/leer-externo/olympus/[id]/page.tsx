import { notFound, redirect } from "next/navigation";
import { OlympusReader } from "@/components/reader/OlympusReader";
import { getSessionUser } from "@/lib/auth";
import { OLYMPUS_NOMBRE, paginas, urlSerieEnOlympus } from "@/lib/olympus";

export const dynamic = "force-dynamic";

export default async function LeerOlympusPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ slug?: string; tipo?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id: raw } = await props.params;
  const { slug, tipo = "comic" } = await props.searchParams;
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id) || !slug) notFound();

  let capitulo;
  try {
    capitulo = await paginas(id, tipo, slug);
  } catch {
    notFound();
  }

  if (capitulo.pages.length === 0) notFound();

  return (
    <OlympusReader
      chapter={{ id: capitulo.id, name: capitulo.name, urlOriginal: capitulo.url_original }}
      serie={{ slug, tipo, urlOriginal: urlSerieEnOlympus(tipo, slug) }}
      grupo={OLYMPUS_NOMBRE}
      pages={capitulo.pages.map((url, i) => ({ pageNumber: i + 1, url, width: 0, height: 0 }))}
      prevChapter={capitulo.prev}
      nextChapter={capitulo.next}
      initialMode={user.preferredReadingMode === "rtl" ? "rtl" : "cascade"}
    />
  );
}
