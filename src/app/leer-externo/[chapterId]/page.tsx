import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ExternalReader } from "@/components/reader/ExternalReader";
import { mdFetch, publicChapter, type MdChapter } from "@/lib/mangadex";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AtHome {
  baseUrl: string;
  chapter: { hash: string; data: string[] };
}

export const dynamic = "force-dynamic";

/** Lectura de un capítulo alojado en MangaDex, dentro del lector propio. */
export default async function LeerExternoPage(props: {
  params: Promise<{ chapterId: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { chapterId } = await props.params;
  if (!UUID_RE.test(chapterId)) notFound();

  let chapter;
  let atHome: AtHome;
  let seriesId: string | null = null;

  try {
    const [chapterRes, atHomeRes] = await Promise.all([
      mdFetch<{ data: MdChapter }>(
        `/chapter/${chapterId}?includes[]=scanlation_group&includes[]=manga`,
        300
      ),
      mdFetch<AtHome>(`/at-home/server/${chapterId}`, 60),
    ]);
    chapter = publicChapter(chapterRes.data);
    atHome = atHomeRes;
    seriesId = chapterRes.data.relationships.find((r) => r.type === "manga")?.id ?? null;
  } catch {
    notFound();
  }

  // capítulos que el grupo aloja en su propio sitio no se pueden leer acá
  if (chapter.external_url) redirect(chapter.external_url);

  const pages = atHome.chapter.data.map((file, i) => ({
    pageNumber: i + 1,
    url: `${atHome.baseUrl}/data/${atHome.chapter.hash}/${file}`,
    // MangaDex no expone dimensiones: el lector usa alto automático
    width: 0,
    height: 0,
  }));

  if (pages.length === 0) notFound();

  return (
    <ExternalReader
      chapter={{
        id: chapter.id,
        number: chapter.number,
        title: chapter.title,
        group: chapter.group,
      }}
      seriesId={seriesId}
      pages={pages}
      initialMode={user.preferredReadingMode === "rtl" ? "rtl" : "cascade"}
    />
  );
}
