import { NextResponse } from "next/server";
import { mdFetch, pickText } from "@/lib/mangadex";

interface MdTag {
  id: string;
  attributes: { name: Record<string, string>; group: string };
}

/** GET /api/externo/generos — lista de géneros de MangaDex para el filtro. */
export async function GET() {
  try {
    // el catálogo de tags casi no cambia: caché de un día
    const data = await mdFetch<{ data: MdTag[] }>("/manga/tag", 86400);
    const genres = data.data
      .filter((t) => t.attributes.group === "genre")
      .map((t) => ({ id: t.id, name: pickText(t.attributes.name, ["es", "en"]) ?? "" }))
      .filter((t) => t.name)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    return NextResponse.json(genres);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
