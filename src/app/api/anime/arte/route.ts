import { NextRequest, NextResponse } from "next/server";
import { elegirArteAnime, type ArtworkCandidate } from "@/lib/animeArtwork";

// Solo metadatos públicos no adultos. Nunca recibe URLs ni consulta bibliotecas.
export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("q")?.trim();
  if (!title || title.length > 180) return NextResponse.json({ error: "Título inválido" }, { status: 400 });
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: `query($search:String!){Page(perPage:5){media(type:ANIME,search:$search,isAdult:false){id isAdult title{romaji english native} synonyms coverImage{extraLarge} bannerImage}}}`, variables: { search: title } }),
      signal: AbortSignal.timeout(6000), next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error("Metadatos no disponibles");
    const data = await res.json() as { data?: { Page: { media: ArtworkCandidate[] } } };
    if (!Array.isArray(data.data?.Page.media)) throw new Error("Metadatos incompletos");
    return NextResponse.json(elegirArteAnime(title, data.data.Page.media), { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
  } catch {
    // La obra sigue disponible aun si falla este enriquecimiento opcional.
    return NextResponse.json({ cover: null, banner: null, credit: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
