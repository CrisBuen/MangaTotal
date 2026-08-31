import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import { ExternalReader } from "@/components/reader/ExternalReader";
import {
  LANG_GROUPS,
  allowedRatings,
  groupChaptersByNumber,
  mdFetch,
  publicChapter,
  type MdChapter,
} from "@/lib/mangadex";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AtHome {
  baseUrl: string;
  chapter: { hash: string; data: string[] };
}

export const dynamic = "force-dynamic";

/** Lectura de un capítulo alojado en MangaDex, dentro del lector propio. */
export default async function LeerExternoPage(props: {
  params: Promise<{ chapterId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { chapterId } = await props.params;
  const { page } = await props.searchParams;
  if (!UUID_RE.test(chapterId)) notFound();

  let chapter;
  let atHome: AtHome;
  let seriesId: string | null = null;
  let contentRating: unknown = null;

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
    const manga = chapterRes.data.relationships.find((r) => r.type === "manga");
    seriesId = manga?.id ?? null;
    contentRating = manga?.attributes?.contentRating;
  } catch {
    notFound();
  }

  const verAdulto = await contenidoAdultoPermitido(user);
  if (!verAdulto && (contentRating === "erotica" || contentRating === "pornographic")) {
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

  // capítulos vecinos: se calculan sobre la lista agrupada por número, así
  // "siguiente" siempre cae en una versión legible (nunca una rota o vacía)
  let prevChapter: { id: string; number: string | null } | null = null;
  let nextChapter: { id: string; number: string | null } | null = null;

  if (seriesId) {
    try {
      const langs = LANG_GROUPS[chapter.lang.startsWith("es") ? "es" : "en"] ?? LANG_GROUPS.es;
      const all: MdChapter[] = [];
      for (let offset = 0; offset < 500; offset += 100) {
        const qs = new URLSearchParams();
        qs.set("limit", "100");
        qs.set("offset", String(offset));
        qs.set("manga", seriesId);
        qs.set("order[chapter]", "asc");
        qs.append("includes[]", "scanlation_group");
        for (const l of langs) qs.append("translatedLanguage[]", l);
        for (const r of allowedRatings(verAdulto)) {
          qs.append("contentRating[]", r);
        }
        const page = await mdFetch<{ data: MdChapter[]; total: number }>(
          `/chapter?${qs.toString()}`,
          120
        );
        all.push(...page.data);
        if (all.length >= page.total) break;
      }

      const entries = groupChaptersByNumber(all.map(publicChapter));
      // el capítulo abierto puede ser una versión alternativa: se ubica por número
      const index = entries.findIndex(
        (e) => e.versions.some((v) => v.id === chapterId) || e.number === chapter.number
      );
      if (index >= 0) {
        const before = entries[index - 1];
        const after = entries[index + 1];
        if (before) prevChapter = { id: before.chosen.id, number: before.number };
        if (after) nextChapter = { id: after.chosen.id, number: after.number };
      }
    } catch {
      // sin vecinos: el lector muestra solo "volver a la serie"
    }
  }

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
      prevChapter={prevChapter}
      nextChapter={nextChapter}
      initialMode={user.preferredReadingMode === "rtl" ? "rtl" : "cascade"}
      initialPage={Number(page) || 1}
    />
  );
}
