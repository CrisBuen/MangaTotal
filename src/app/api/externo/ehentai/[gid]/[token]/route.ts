import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import { fichaEhentai } from "@/lib/ehentai";

export const dynamic = "force-dynamic";

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
    const ficha = await fichaEhentai(gid, token);
    return NextResponse.json(ficha);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al cargar ficha de E-Hentai";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
