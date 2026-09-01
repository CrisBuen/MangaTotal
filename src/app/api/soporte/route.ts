import { del, get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { enviarConsultaSoporte, normalizarEmail } from "@/lib/accountEmail";
import { getSessionUser } from "@/lib/auth";
import { consumirLimite, respuestaLimite } from "@/lib/authRateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_ARCHIVOS = 5;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const REGLA_SOPORTE = {
  maxIntentos: 5,
  ventanaMs: 60 * 60_000,
  bloqueoMs: 60 * 60_000,
};
const CATEGORIAS = new Set(["Error o bug", "Ayuda", "Consulta", "Otro"]);
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

interface AdjuntoRecibido {
  pathname?: string;
  name?: string;
  size?: number;
}

function nombreSeguro(value: string): string {
  const limpio = value.replace(/[\\\\/:*?"<>|\\u0000-\\u001f]/g, "_").trim();
  return limpio.slice(0, 120) || "adjunto";
}

function extension(value: string): string {
  const punto = value.lastIndexOf(".");
  return punto >= 0 ? value.slice(punto).toLowerCase() : "";
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Iniciá sesión para enviar una consulta" }, { status: 401 });
  }

  const limite = await consumirLimite("soporte-usuario", String(user.id), REGLA_SOPORTE);
  if (!limite.permitido) return respuestaLimite(limite);

  let body: {
    categoria?: string;
    asunto?: string;
    mensaje?: string;
    reply_to?: string | null;
    plataforma?: string;
    attachments?: AdjuntoRecibido[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const categoria = String(body.categoria ?? "").trim();
  const asunto = String(body.asunto ?? "").trim();
  const mensaje = String(body.mensaje ?? "").trim();
  const plataforma = String(body.plataforma ?? "").trim().slice(0, 500);
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const prefijo = `_support/${user.id}/`;
  const paraBorrar: string[] = [];

  if (!CATEGORIAS.has(categoria)) {
    return NextResponse.json({ error: "Elegí un tipo de consulta válido" }, { status: 400 });
  }
  if (asunto.length < 5 || asunto.length > 120) {
    return NextResponse.json({ error: "El asunto debe tener entre 5 y 120 caracteres" }, { status: 400 });
  }
  if (mensaje.length < 20 || mensaje.length > 5_000) {
    return NextResponse.json({ error: "El mensaje debe tener entre 20 y 5.000 caracteres" }, { status: 400 });
  }
  if (attachments.length > MAX_ARCHIVOS) {
    return NextResponse.json({ error: `Podés adjuntar hasta ${MAX_ARCHIVOS} archivos` }, { status: 400 });
  }

  let replyTo: string | null = null;
  try {
    replyTo = normalizarEmail(body.reply_to);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Correo inválido" },
      { status: 400 },
    );
  }

  try {
    const adjuntosCorreo: { filename: string; content: string }[] = [];
    let total = 0;

    for (const entrada of attachments) {
      const pathname = String(entrada.pathname ?? "");
      const filename = nombreSeguro(String(entrada.name ?? ""));
      if (!pathname.startsWith(prefijo) || pathname.includes("..")) {
        throw new Error("Uno de los adjuntos no pertenece a esta cuenta");
      }
      paraBorrar.push(pathname);
      if (!EXTENSIONES.has(extension(filename))) {
        throw new Error(`El archivo ${filename} no tiene un formato permitido`);
      }

      const resultado = await get(pathname, { access: "private", useCache: false });
      if (!resultado || resultado.statusCode !== 200) {
        throw new Error(`No se pudo leer el archivo ${filename}`);
      }
      total += resultado.blob.size;
      if (total > MAX_TOTAL_BYTES) {
        throw new Error("Los adjuntos superan el máximo total de 15 MB");
      }
      const contenido = Buffer.from(await new Response(resultado.stream).arrayBuffer());
      adjuntosCorreo.push({ filename, content: contenido.toString("base64") });
    }

    const enviado = await enviarConsultaSoporte({
      nickname: user.nickname,
      userId: user.id,
      replyTo,
      categoria,
      asunto,
      mensaje,
      plataforma,
      attachments: adjuntosCorreo,
    }).catch(() => false);

    if (!enviado) {
      return NextResponse.json(
        { error: "No se pudo enviar el correo. El servicio de correo no está configurado o no respondió." },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo preparar la consulta" },
      { status: 400 },
    );
  } finally {
    await Promise.all(paraBorrar.map((pathname) => del(pathname).catch(() => undefined)));
  }
}
