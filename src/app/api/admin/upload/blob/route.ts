import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { MAX_ZIP_BYTES } from "@/lib/ingest";
import { origenPermitido } from "@/lib/requestSecurity";

/**
 * POST /api/admin/upload/blob — emite tokens para que el navegador suba el
 * .zip directo a Vercel Blob, sin pasar por la función (límite de body de
 * ~4.5 MB en Vercel). Solo admin; el zip queda en _uploads/ temporalmente
 * hasta que /api/admin/upload lo procesa y lo borra. Funciona también con
 * STORAGE_PROVIDER="r2": Blob solo hace de buzón temporal de los zips.
 */
export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Subida directa no disponible: falta BLOB_READ_WRITE_TOKEN" },
      { status: 400 }
    );
  }

  const body = (await request.json()) as HandleUploadBody;
  // El callback upload-completed viene firmado y lo verifica handleUpload.
  // La emisión del token sí nace en nuestro navegador y exige mismo origen.
  if (body.type === "blob.generate-client-token" && !origenPermitido(request)) {
    return NextResponse.json({ error: "Origen de solicitud no permitido" }, { status: 403 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const admin = await getSessionAdmin();
        if (!admin) throw new Error("Solo admin");
        if (!pathname.startsWith("_uploads/") || !pathname.toLowerCase().endsWith(".zip")) {
          throw new Error("Solo se aceptan .zip en _uploads/");
        }
        // sin allowedContentTypes: Windows reporta MIME variados para .zip
        // y la extensión ya se validó arriba
        return {
          maximumSizeInBytes: MAX_ZIP_BYTES,
          addRandomSuffix: true,
        };
      },
      // el cliente avisa por su cuenta a /api/admin/upload con la URL
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo autorizar la subida" },
      { status: 400 }
    );
  }
}
