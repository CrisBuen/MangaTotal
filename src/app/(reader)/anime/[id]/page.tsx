import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackerPanel } from "@/components/anime/TrackerPanel";
import { getSessionUser } from "@/lib/auth";
import {
  MEDIA_CARD_FIELDS,
  aniFetch,
  publicAnimeDetail,
  type AniMedia,
} from "@/lib/anilist";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";

export const dynamic = "force-dynamic";

const QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${MEDIA_CARD_FIELDS}
      description(asHtml: false)
      duration
      bannerImage
      studios(isMain: true) { nodes { name } }
      externalLinks { site url type language }
      trailer { id site }
      nextAiringEpisode { episode airingAt }
      relations {
        edges {
          relationType
          node { ${MEDIA_CARD_FIELDS} }
        }
      }
    }
  }
`;

const RELATION_ES: Record<string, string> = {
  SEQUEL: "Secuela",
  PREQUEL: "Precuela",
  SIDE_STORY: "Historia paralela",
  ALTERNATIVE: "Versión alternativa",
};

export default async function AnimeDetailPage(props: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  const { id: raw } = await props.params;
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let anime;
  try {
    const data = await aniFetch<{ Media: AniMedia }>(QUERY, { id }, 600);
    if (!data.Media) notFound();
    if (data.Media.isAdult && !(await contenidoAdultoPermitido(user))) notFound();
    anime = publicAnimeDetail(data.Media);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-10">
      <Link
        href="/anime"
        className="inline-block font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink"
      >
        ← Anime
      </Link>

      {anime.banner_url && (
        <div className="relative -mt-4 h-48 overflow-hidden rounded-[10px] border border-line sm:h-64">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={anime.banner_url}
            alt=""
            className="h-full w-full object-cover opacity-60"
            referrerPolicy="no-referrer"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(0deg, var(--bg) 0%, color-mix(in oklch, var(--bg) 40%, transparent) 70%, transparent 100%)",
            }}
          />
        </div>
      )}

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="w-full shrink-0 space-y-5 sm:w-56">
          <div className="overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)]">
            <div className="aspect-[2/3]">
              {anime.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={anime.cover_url}
                  alt={anime.title}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-5xl text-subtle">🎬</div>
              )}
            </div>
          </div>

          <TrackerPanel
            anilistId={anime.id}
            title={anime.title}
            coverUrl={anime.cover_url}
            totalEpisodes={anime.episodes}
            loggedIn={Boolean(user)}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          <div>
            <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.04em] text-ink sm:text-5xl">
              {anime.title}
            </h1>
            {anime.native_title && anime.native_title !== anime.title && (
              <p className="mt-2 text-sm text-subtle">{anime.native_title}</p>
            )}
            <p className="mt-3 font-mono text-[11px] tracking-[0.06em] text-subtle">
              {[
                anime.format,
                anime.status,
                anime.episodes ? `${anime.episodes} episodios` : null,
                anime.duration ? `${anime.duration} min` : null,
                anime.season,
                anime.score !== null ? `${anime.score}% de valoración` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          {anime.next_episode && (
            <div className="rounded-[10px] border border-accent bg-[var(--accent-soft)] px-5 py-3">
              <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-accent-ink">
                Próximo episodio {anime.next_episode.episode} ·{" "}
                {new Date(anime.next_episode.airing_at * 1000).toLocaleString("es-AR", {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}

          {anime.all_genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {anime.all_genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-line bg-[var(--surface-raised)] px-3 py-1 text-[13px] text-subtle"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {anime.description && (
            <p className="max-w-3xl whitespace-pre-line text-sm leading-6 text-subtle">
              {anime.description}
            </p>
          )}

          {anime.studios.length > 0 && (
            <p className="font-mono text-[11px] tracking-[0.06em] text-subtle">
              Estudio: <span className="text-ink">{anime.studios.join(", ")}</span>
            </p>
          )}

          <section>
            <h2 className="mb-3 font-display text-2xl font-bold tracking-[-0.03em] text-ink">
              Dónde verlo
            </h2>
            {anime.streaming.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {anime.streaming.map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-line bg-panel px-4 py-2.5 text-sm text-ink transition hover:border-line-strong hover:text-accent-ink"
                    >
                      {s.site} ↗
                    </a>
                  ))}
                </div>
                <p className="mt-3 font-mono text-[11px] tracking-[0.06em] text-subtle">
                  Plataformas oficiales · la disponibilidad puede variar según el país
                </p>
              </>
            ) : (
              <p className="rounded-[10px] border border-dashed border-line p-5 text-sm text-subtle">
                Todavía no hay plataformas oficiales registradas para este título.
              </p>
            )}
            {anime.trailer && (
              <a
                href={anime.trailer}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block font-mono text-[11px] font-bold tracking-[0.06em] text-accent-ink hover:underline"
              >
                Ver tráiler ↗
              </a>
            )}
          </section>

          {anime.relations.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-2xl font-bold tracking-[-0.03em] text-ink">
                Relacionados
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {anime.relations.slice(0, 8).map((r) => (
                  <Link key={r.id} href={`/anime/${r.id}`} className="group block">
                    <div className="aspect-[2/3] overflow-hidden rounded-md border border-line bg-[var(--surface-raised)] transition-colors group-hover:border-line-strong">
                      {r.cover_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.cover_url}
                          alt={r.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                    <p className="mt-2 font-mono text-[11px] tracking-[0.1em] text-accent-ink">
                      {RELATION_ES[r.relation] ?? r.relation}
                    </p>
                    <p className="line-clamp-2 text-sm font-semibold text-ink group-hover:text-accent-ink">
                      {r.title}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <p className="border-t border-line pt-6 text-center font-mono text-[11px] tracking-[0.06em] text-subtle">
        Información de AniList · MangaTotal no aloja ni reproduce video
      </p>
    </div>
  );
}
