import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { esAdultoJkanime, urlEpisodioJkanime } from "@/lib/jkanime";

export default async function EpisodioJkanimePage(props: {
  params: Promise<{ slug: string; episode: string }>;
}) {
  const { slug, episode } = await props.params;
  const user = await getSessionUser();
  let url: string;
  try {
    url = urlEpisodioJkanime(slug, episode);
    if (!(user?.showAdultContent || user?.isAdmin) && (await esAdultoJkanime(slug))) {
      notFound();
    }
  } catch {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/anime/jkanime/${slug}`}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-accent"
        >
          ← Episodios
        </Link>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent hover:underline"
        >
          Abrir en JKAnime ↗
        </a>
      </div>

      <div className="-mx-4 overflow-hidden border-y border-line bg-black sm:-mx-6 lg:-mx-10">
        <iframe
          src={url}
          title={`JKAnime · episodio ${episode}`}
          className="h-[calc(100dvh-11rem)] min-h-[32rem] w-full"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture; web-share"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>

      <p className="text-center font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
        El reproductor, sus fuentes y el video pertenecen a JKAnime
      </p>
    </div>
  );
}
