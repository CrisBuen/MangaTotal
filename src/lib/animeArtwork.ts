export interface AnimeArtwork { cover: string | null; banner: string | null; credit: string | null }
export interface ArtworkCandidate {
  id: number; isAdult: boolean; title: { romaji?: string | null; english?: string | null; native?: string | null };
  synonyms?: string[]; coverImage?: { extraLarge?: string | null }; bannerImage?: string | null;
}
const normalizar = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const imagen = (value?: string | null) => {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname === "s4.anilist.co" && !u.username && !u.password && !u.port && u.pathname.startsWith("/file/anilistcdn/media/anime/") ? u.href : null;
  } catch { return null; }
};
/** Nunca adjudicar la portada de una temporada distinta por similitud textual. */
export function elegirArteAnime(title: string, candidates: ArtworkCandidate[]): AnimeArtwork {
  const exactos = candidates.filter(m => !m.isAdult && [...Object.values(m.title), ...(m.synonyms ?? [])].some(t => t && normalizar(t) === normalizar(title)));
  if (exactos.length !== 1) return { cover: null, banner: null, credit: null };
  const m = exactos[0];
  return { cover: imagen(m.coverImage?.extraLarge), banner: imagen(m.bannerImage), credit: `https://anilist.co/anime/${m.id}` };
}
