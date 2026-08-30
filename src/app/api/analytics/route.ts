import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECCIONES = new Set([
  "inicio",
  "biblioteca",
  "explorar",
  "anilist",
  "lectura",
  "anime",
  "noticias",
  "aleatorio",
  "estadisticas",
  "perfil",
  "ajustes",
  "mas",
  "otros",
]);
const FUENTES = new Set([
  "mangatotal",
  "mangadex",
  "olympus",
  "zonatmo",
  "leercapitulo",
  "catharsis",
  "ikigai",
  "jkanime",
]);
const PLATAFORMAS = new Set(["web", "android", "windows"]);

interface Cuerpo {
  visitorId?: unknown;
  section?: unknown;
  source?: unknown;
  platform?: unknown;
  contentKey?: unknown;
}

export const dynamic = "force-dynamic";

/**
 * Latido de presencia y, cuando corresponde, apertura de contenido.
 *
 * La misma instalación solo puede sumar una apertura por contenido cada
 * quince minutos. La ruta se usa para el hash y nunca se guarda en claro.
 */
export async function POST(req: NextRequest) {
  if (Number(req.headers.get("content-length") ?? 0) > 4096) {
    return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  }

  let body: Cuerpo;
  try {
    body = (await req.json()) as Cuerpo;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const id = typeof body.visitorId === "string" ? body.visitorId : "";
  const section = typeof body.section === "string" ? body.section : "";
  const source =
    typeof body.source === "string" && FUENTES.has(body.source) ? body.source : null;
  const platform = typeof body.platform === "string" ? body.platform : "";
  const contentKey = typeof body.contentKey === "string" ? body.contentKey : null;

  if (!UUID_RE.test(id) || !SECCIONES.has(section) || !PLATAFORMAS.has(platform)) {
    return NextResponse.json({ error: "Datos de telemetría inválidos" }, { status: 400 });
  }
  if (body.source !== null && body.source !== undefined && source === null) {
    return NextResponse.json({ error: "Fuente inválida" }, { status: 400 });
  }
  if (contentKey !== null && (contentKey.length < 2 || contentKey.length > 240)) {
    return NextResponse.json({ error: "Contenido inválido" }, { status: 400 });
  }

  const now = new Date();
  await db.analyticsPresence.upsert({
    where: { visitorId: id },
    create: { visitorId: id, section, source, platform, firstSeen: now, lastSeen: now },
    update: { section, source, platform, lastSeen: now },
  });

  if (contentKey && source && (section === "lectura" || section === "anime")) {
    const ventana = Math.floor(now.getTime() / (15 * 60 * 1000));
    const dedupeKey = createHash("sha256")
      .update(`${id}|${section}|${source}|${contentKey}|${ventana}`)
      .digest("hex");

    try {
      await db.analyticsEvent.create({
        data: {
          visitorId: id,
          eventType: "content_open",
          section,
          source,
          platform,
          dedupeKey,
          occurredAt: now,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
    }
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
