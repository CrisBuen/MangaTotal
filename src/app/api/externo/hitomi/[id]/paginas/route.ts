import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import { paginasHitomi } from "@/lib/hitomi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  const permitido = await contenidoAdultoPermitido(user);
  if (!permitido) {
    return NextResponse.json({ error: "Contenido no permitido en esta edición" }, { status: 403 });
  }

  const { id } = await props.params;
  if (!id) {
    return NextResponse.json({ error: "Falta el identificador de la galería" }, { status: 400 });
  }

  try {
    const paginas = await paginasHitomi(id);
    return NextResponse.json({ paginas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al obtener páginas de Hitomi.la";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
