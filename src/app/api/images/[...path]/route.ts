import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { contentTypeFor, resolveStoragePath } from "@/lib/storage";

/**
 * GET /api/images/:...path — stream directo del archivo original.
 * Sin recompresión: los bytes que llegan al navegador son exactamente
 * los que se extrajeron del .zip (docs/06 §6.6).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  // pública dentro de la red: las portadas se ven en la biblioteca de visitante
  const { path: parts } = await ctx.params;
  const relative = parts.map((p) => decodeURIComponent(p)).join("/");

  const abs = resolveStoragePath(relative);
  if (!abs) return NextResponse.json({ error: "Ruta inválida" }, { status: 404 });

  const contentType = contentTypeFor(abs);
  if (!contentType) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  let data: Buffer;
  try {
    data = await fs.readFile(abs);
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      // el archivo nunca cambia una vez subido (docs/07 §7.4)
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
