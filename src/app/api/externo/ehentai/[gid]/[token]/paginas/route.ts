import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import { paginasEhentai } from "@/lib/ehentai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ gid: string; token: string }> }
) {
  const user = await getSessionUser();
  const permitido = await contenidoAdultoPermitido(user);
  if (!permitido) {
    return NextResponse.json({ error: "Contenido no permitido en esta edición" }, { status: 403 });
  }

  const { gid, token } = await props.params;
  if (!gid || !token) {
    return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
  }

  try {
    const paginas = await paginasEhentai(gid, token);
    return NextResponse.json({ paginas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al obtener páginas de E-Hentai";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
