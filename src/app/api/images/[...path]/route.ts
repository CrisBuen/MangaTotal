import { NextRequest, NextResponse } from "next/server";
import { getObjectStorage } from "@/lib/object-storage";
import { contentTypeFor } from "@/lib/storage";

/**
 * GET /api/images/:...path — sirve el archivo original.
 * Sin recompresión: los bytes que llegan al navegador son exactamente
 * los que se extrajeron del .zip (docs/06 §6.6).
 *
 * Con STORAGE_PROVIDER="blob" redirige a la CDN del blob; en local hace
 * stream directo desde storage/.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  // pública dentro de la red: las portadas se ven en la biblioteca de visitante
  const { path: parts } = await ctx.params;
  const relative = parts.map((p) => decodeURIComponent(p)).join("/");

  if (relative.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 404 });
  }

  const contentType = contentTypeFor(relative);
  if (!contentType) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const storage = getObjectStorage();

  const publicUrl = await storage.getPublicUrl(relative);
  if (publicUrl) {
    return NextResponse.redirect(publicUrl, {
      status: 302,
      headers: {
        // el archivo nunca cambia una vez subido (docs/07 §7.4)
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  }

  const data = await storage.readObject(relative);
  if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      // el archivo nunca cambia una vez subido (docs/07 §7.4)
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
