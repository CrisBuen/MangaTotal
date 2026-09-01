import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { origenPermitido } from "@/lib/requestSecurity";

export const runtime = "nodejs";

const MAX_ARCHIVO_BYTES = 8 * 1024 * 1024;
const EXTENSIONES = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".pdf",
  ".txt",
  ".log",
  ".csv",
  ".doc",
  ".docx",
]);

function extension(pathname: string): string {
  const nombre = pathname.toLowerCase().split("/").pop() ?? "";
  const punto = nombre.lastIndexOf(".");
  return punto >= 0 ? nombre.slice(punto) : "";
}

/**
 * Emite un token corto para subir adjuntos directo al almacenamiento privado.
 * El archivo nunca pasa por el body de una función de Vercel y, al enviarse
 * el correo, /api/soporte lo elimina.
 */
export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "La subida de adjuntos no está configurada" },
      { status: 503 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;
  if (body.type === "blob.generate-client-token" && !origenPermitido(request)) {
    return NextResponse.json({ error: "Origen de solicitud no permitido" }, { status: 403 });
  }

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getSessionUser();
        if (!user) throw new Error("Iniciá sesión para adjuntar archivos");

        const prefijo = `_support/${user.id}/`;
        if (!pathname.startsWith(prefijo) || pathname.includes("..")) {
          throw new Error("Ruta de adjunto inválida");
        }
        if (!EXTENSIONES.has(extension(pathname))) {
          throw new Error("Ese tipo de archivo no está permitido");
        }

        return {
          maximumSizeInBytes: MAX_ARCHIVO_BYTES,
          allowedContentTypes: [
            "image/*",
            "application/pdf",
            "text/*",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/octet-stream",
          ],
          addRandomSuffix: true,
          tokenPayload: String(user.id),
        };
      },
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo autorizar la subida" },
      { status: 400 },
    );
  }
}

/** Limpia adjuntos privados si una subida intermedia falla antes de enviar. */
export async function DELETE(request: NextRequest) {
  if (!origenPermitido(request)) {
    return NextResponse.json({ error: "Origen de solicitud no permitido" }, { status: 403 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let body: { pathnames?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const pathnames = Array.isArray(body.pathnames) ? body.pathnames.slice(0, 5) : [];
  const prefijo = `_support/${user.id}/`;
  if (pathnames.some((pathname) => !pathname.startsWith(prefijo) || pathname.includes(".."))) {
    return NextResponse.json({ error: "Ruta de adjunto inválida" }, { status: 400 });
  }
  await Promise.all(pathnames.map((pathname) => del(pathname).catch(() => undefined)));
  return new NextResponse(null, { status: 204 });
}
