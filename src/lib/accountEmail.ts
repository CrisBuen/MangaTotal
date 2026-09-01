import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

const VERIFY_KIND = "verify_email";
const RESET_KIND = "reset_password";

export function normalizarEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Correo electrónico inválido");
  }
  return email;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function kindParaCorreo(prefix: string, email: string): string {
  return `${prefix}:${tokenHash(email)}`;
}

async function crearToken(
  userId: number,
  kind: string,
  ttlMs: number,
  invalidarPrefijo = kind,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.accountToken.deleteMany({
      where: { userId, kind: { startsWith: invalidarPrefijo }, usedAt: null },
    }),
    db.accountToken.create({
      data: {
        userId,
        kind,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    }),
  ]);
  return token;
}

function publicUrl(): string {
  return (process.env.APP_PUBLIC_URL ?? "https://www.mangatotal.com").replace(/\/$/, "");
}

interface AdjuntoCorreo {
  filename: string;
  /** Contenido en base64, como lo espera la API de Resend. */
  content: string;
}

async function enviarCorreo(
  to: string,
  subject: string,
  html: string,
  opciones: { replyTo?: string | null; attachments?: AdjuntoCorreo[] } = {},
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[correo] RESEND_API_KEY o EMAIL_FROM no configurado");
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      ...(opciones.replyTo ? { reply_to: opciones.replyTo } : {}),
      ...(opciones.attachments?.length ? { attachments: opciones.attachments } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[correo] Resend respondió", res.status, await res.text());
    return false;
  }
  return true;
}

export async function enviarConsultaSoporte(consulta: {
  nickname: string;
  userId: number;
  replyTo: string | null;
  categoria: string;
  asunto: string;
  mensaje: string;
  plataforma: string;
  attachments: AdjuntoCorreo[];
}): Promise<boolean> {
  const destino = process.env.SUPPORT_EMAIL ?? "nyckswork@gmail.com";
  const mensaje = escapeHtml(consulta.mensaje).replace(/\\r?\\n/g, "<br>");
  const plataforma = escapeHtml(consulta.plataforma || "No informada");
  const replyTo = consulta.replyTo ? escapeHtml(consulta.replyTo) : "No informado";

  return enviarCorreo(
    destino,
    `[MangaTotal] ${consulta.categoria}: ${consulta.asunto}`,
    `<h2>Consulta desde MangaTotal</h2>
     <p><strong>Tipo:</strong> ${escapeHtml(consulta.categoria)}</p>
     <p><strong>Usuario:</strong> ${escapeHtml(consulta.nickname)} (ID ${consulta.userId})</p>
     <p><strong>Correo para responder:</strong> ${replyTo}</p>
     <p><strong>Plataforma:</strong> ${plataforma}</p>
     <p><strong>Asunto:</strong> ${escapeHtml(consulta.asunto)}</p>
     <hr>
     <p>${mensaje}</p>`,
    { replyTo: consulta.replyTo, attachments: consulta.attachments },
  );
}

export async function enviarVerificacion(
  user: { id: number; nickname: string; email: string },
): Promise<boolean> {
  const token = await crearToken(
    user.id,
    kindParaCorreo(VERIFY_KIND, user.email),
    24 * 60 * 60_000,
    VERIFY_KIND,
  );
  const link = `${publicUrl()}/verificar-correo?token=${encodeURIComponent(token)}`;
  return enviarCorreo(
    user.email,
    "Verificá tu correo de MangaTotal",
    `<p>Hola <strong>${escapeHtml(user.nickname)}</strong>.</p>
     <p>Confirmá que este correo pertenece a tu cuenta de MangaTotal.</p>
     <p><a href="${link}">Verificar mi correo</a></p>
     <p>El enlace vence en 24 horas. Si no lo pediste, podés ignorarlo.</p>`,
  );
}

export async function enviarRecuperacion(
  user: { id: number; nickname: string; email: string },
): Promise<boolean> {
  const token = await crearToken(
    user.id,
    kindParaCorreo(RESET_KIND, user.email),
    30 * 60_000,
    RESET_KIND,
  );
  const link = `${publicUrl()}/restablecer?token=${encodeURIComponent(token)}`;
  return enviarCorreo(
    user.email,
    "Restablecé tu contraseña de MangaTotal",
    `<p>Hola <strong>${escapeHtml(user.nickname)}</strong>.</p>
     <p>Recibimos una solicitud para cambiar tu contraseña.</p>
     <p><a href="${link}">Crear una contraseña nueva</a></p>
     <p>El enlace vence en 30 minutos. Si no lo pediste, no hagas nada.</p>`,
  );
}

export async function verificarTokenCorreo(token: string) {
  const ahora = new Date();
  return db.$transaction(async (tx) => {
    const record = await tx.accountToken.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: true },
    });
    if (
      !record ||
      record.kind !== kindParaCorreo(VERIFY_KIND, record.user.email ?? "") ||
      record.usedAt ||
      record.expiresAt <= ahora ||
      !record.user.email
    ) {
      return null;
    }
    const claimed = await tx.accountToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: ahora } },
      data: { usedAt: ahora },
    });
    if (claimed.count !== 1) return null;
    return tx.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: ahora },
    });
  });
}

export async function usarTokenRecuperacion(
  token: string,
  passwordHash: string,
): Promise<boolean> {
  const ahora = new Date();
  return db.$transaction(async (tx) => {
    const record = await tx.accountToken.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: { select: { email: true } } },
    });
    if (
      !record ||
      !record.user.email ||
      record.kind !== kindParaCorreo(RESET_KIND, record.user.email) ||
      record.usedAt ||
      record.expiresAt <= ahora
    ) {
      return false;
    }
    const claimed = await tx.accountToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: ahora } },
      data: { usedAt: ahora },
    });
    if (claimed.count !== 1) return false;
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    return true;
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}
