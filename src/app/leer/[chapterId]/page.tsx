import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Reader } from "@/components/reader/Reader";

export default async function LeerPage(props: {
  params: Promise<{ chapterId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { chapterId: raw } = await props.params;
  const { page } = await props.searchParams;

  const chapterId = parseInt(raw, 10);
  if (!Number.isInteger(chapterId)) notFound();

  const chapter = await db.chapter.findUnique({
    where: { id: chapterId },
    include: {
      series: true,
      pages: { orderBy: { pageNumber: "asc" } },
    },
  });
  if (!chapter) notFound();
  if (chapter.series.type === "adult" && !user.showAdultContent && !user.isAdmin) notFound();

  const [prev, next] = await Promise.all([
    db.chapter.findFirst({
      where: { seriesId: chapter.seriesId, number: { lt: chapter.number } },
      orderBy: { number: "desc" },
      select: { id: true, number: true },
    }),
    db.chapter.findFirst({
      where: { seriesId: chapter.seriesId, number: { gt: chapter.number } },
      orderBy: { number: "asc" },
      select: { id: true, number: true },
    }),
  ]);

  const requestedPage = page ? parseInt(page, 10) : NaN;
  const initialPage =
    Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= chapter.pageCount
      ? requestedPage
      : 1;

  const initialMode = user.preferredReadingMode === "rtl" ? "rtl" : "cascade";

  return (
    <Reader
      chapter={{
        id: chapter.id,
        number: chapter.number,
        title: chapter.title,
        pageCount: chapter.pageCount,
      }}
      series={{ title: chapter.series.title, slug: chapter.series.slug }}
      pages={chapter.pages.map((p) => ({
        pageNumber: p.pageNumber,
        url: `/api/images/${p.filePath}`,
        width: p.width,
        height: p.height,
      }))}
      prevChapter={prev}
      nextChapter={next}
      initialPage={initialPage}
      initialMode={initialMode}
    />
  );
}
