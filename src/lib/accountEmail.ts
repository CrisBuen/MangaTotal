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
  opciones: {
    text?: string;
    replyTo?: string | null;
    attachments?: AdjuntoCorreo[];
  } = {},
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
      ...(opciones.text ? { text: opciones.text } : {}),
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

function botonCorreo(href: string, etiqueta: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0">
    <tr><td bgcolor="#7137ad" style="border-radius:8px">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;line-height:20px">${escapeHtml(etiqueta)}</a>
    </td></tr>
  </table>`;
}

function plantillaCorreo(opciones: {
  preheader: string;
  etiqueta: string;
  titulo: string;
  contenido: string;
  pie?: string;
}): string {
  const logo = `${publicUrl()}/icons/mangatotal-logo-transparent.png`;
  const inicio = publicUrl();

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(opciones.titulo)}</title>
</head>
<body bgcolor="#060608" style="margin:0;padding:0;background:#060608;color:#f3eee8;font-family:Arial,Helvetica,sans-serif">
  <div lang="es" style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(opciones.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#060608" style="width:100%;background:#060608">
    <tr><td align="center" style="padding:28px 14px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f0f12" style="width:100%;max-width:620px;background:#0f0f12;border:1px solid #2b2b31;border-radius:14px">
        <tr><td style="padding:26px 28px 20px;border-bottom:1px solid #2b2b31">
          <a href="${escapeHtml(inicio)}" style="display:inline-block;color:#f3eee8;text-decoration:none">
            <img src="${escapeHtml(logo)}" width="52" height="52" alt="MangaTotal" style="display:block;width:52px;height:52px;border:0;object-fit:contain">
          </a>
          <div style="margin-top:18px;color:#a9a29a;font-family:'Courier New',monospace;font-size:11px;line-height:16px;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(opciones.etiqueta)}</div>
          <h1 style="margin:8px 0 0;color:#f3eee8;font-size:28px;line-height:34px;font-weight:700">${escapeHtml(opciones.titulo)}</h1>
        </td></tr>
        <tr><td style="padding:26px 28px;color:#d8d0c7;font-size:16px;line-height:25px">${opciones.contenido}</td></tr>
        <tr><td style="padding:18px 28px 24px;border-top:1px solid #2b2b31;color:#817b75;font-size:12px;line-height:18px">${escapeHtml(opciones.pie ?? "Este correo fue enviado por MangaTotal.")}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function resumirPlataforma(userAgent: string): string {
  if (!userAgent.trim()) return "No informada";
  const partes: string[] = [];
  const app = userAgent.match(/MangaTotalApp\/([\w.-]+)/i);
  if (app) partes.push(`App MangaTotal ${app[1]}`);

  const android = userAgent.match(/Android\s+([\d.]+)/i);
  const ios = userAgent.match(/(?:iPhone OS|CPU OS)\s+([\d_]+)/i);
  const mac = userAgent.match(/Mac OS X\s+([\d_]+)/i);
  if (android) partes.push(`Android ${android[1]}`);
  else if (/Windows NT 10\.0/i.test(userAgent)) partes.push("Windows 10/11");
  else if (ios) partes.push(`iOS ${ios[1].replace(/_/g, ".")}`);
  else if (mac) partes.push(`macOS ${mac[1].replace(/_/g, ".")}`);
  else if (/Linux/i.test(userAgent)) partes.push("Linux");

  const edge = userAgent.match(/Edg(?:A|iOS)?\/([\d.]+)/i);
  const chrome = userAgent.match(/(?:Chrome|CriOS)\/([\d.]+)/i);
  const firefox = userAgent.match(/(?:Firefox|FxiOS)\/([\d.]+)/i);
  const safari = userAgent.match(/Version\/([\d.]+).*Safari/i);
  if (edge) partes.push(`Edge ${edge[1]}`);
  else if (chrome) partes.push(`Chrome ${chrome[1]}`);
  else if (firefox) partes.push(`Firefox ${firefox[1]}`);
  else if (safari) partes.push(`Safari ${safari[1]}`);

  return partes.length ? partes.join(" · ") : "Navegador o aplicación no identificados";
}

function filaDato(etiqueta: string, valorHtml: string): string {
  return `<tr>
    <td valign="top" style="width:150px;padding:7px 12px 7px 0;color:#8f8881;font-size:13px;line-height:19px">${escapeHtml(etiqueta)}</td>
    <td valign="top" style="padding:7px 0;color:#f3eee8;font-size:14px;line-height:20px;word-break:break-word">${valorHtml}</td>
  </tr>`;
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
  const mensaje = escapeHtml(consulta.mensaje).replace(/\r?\n/g, "<br>");
  const plataformaCompleta = consulta.plataforma || "No informada";
  const plataformaResumen = resumirPlataforma(plataformaCompleta);
  const correoRespuesta = consulta.replyTo
    ? `<a href="mailto:${escapeHtml(consulta.replyTo)}" style="color:#bd7cff;text-decoration:none">${escapeHtml(consulta.replyTo)}</a>`
    : '<span style="color:#a9a29a">No informado</span>';
  const archivos = consulta.attachments.length
    ? consulta.attachments
        .map((adjunto) => `<li style="margin:4px 0">${escapeHtml(adjunto.filename)}</li>`)
        .join("")
    : '<li style="margin:4px 0;color:#8f8881">Sin archivos adjuntos</li>';

  const contenido = `
    <div style="display:inline-block;padding:5px 9px;border:1px solid #7137ad;border-radius:999px;color:#bd7cff;font-family:'Courier New',monospace;font-size:11px;line-height:15px;text-transform:uppercase;letter-spacing:1px">${escapeHtml(consulta.categoria)}</div>
    <h2 style="margin:16px 0 20px;color:#f3eee8;font-size:21px;line-height:28px">${escapeHtml(consulta.asunto)}</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px">
      ${filaDato("Usuario", `${escapeHtml(consulta.nickname)} <span style="color:#8f8881">(ID ${consulta.userId})</span>`)}
      ${filaDato("Correo para responder", correoRespuesta)}
      ${filaDato("Plataforma", escapeHtml(plataformaResumen))}
      ${filaDato("Adjuntos", String(consulta.attachments.length))}
    </table>
    <div style="margin:0 0 9px;color:#8f8881;font-family:'Courier New',monospace;font-size:11px;line-height:16px;letter-spacing:1px;text-transform:uppercase">Mensaje del usuario</div>
    <div style="padding:18px;background:#08080a;border:1px solid #2b2b31;border-radius:9px;color:#eee7df;font-size:15px;line-height:24px;word-break:break-word">${mensaje}</div>
    <div style="margin:22px 0 9px;color:#8f8881;font-family:'Courier New',monospace;font-size:11px;line-height:16px;letter-spacing:1px;text-transform:uppercase">Archivos recibidos</div>
    <ul style="margin:0;padding-left:20px;color:#d8d0c7;font-size:13px;line-height:20px">${archivos}</ul>
    <div style="margin:22px 0 9px;color:#8f8881;font-family:'Courier New',monospace;font-size:11px;line-height:16px;letter-spacing:1px;text-transform:uppercase">Contexto técnico</div>
    <div style="padding:13px;background:#08080a;border:1px solid #222228;border-radius:8px;color:#817b75;font-family:'Courier New',monospace;font-size:11px;line-height:17px;word-break:break-all">${escapeHtml(plataformaCompleta)}</div>
    ${consulta.replyTo ? botonCorreo(`mailto:${consulta.replyTo}?subject=${encodeURIComponent(`Re: ${consulta.asunto}`)}`, "Responder al usuario") : ""}
  `;

  const textoAdjuntos = consulta.attachments.length
    ? consulta.attachments.map((adjunto) => adjunto.filename).join(", ")
    : "Sin archivos adjuntos";
  const texto = `Nuevo mensaje de soporte de MangaTotal

Tipo: ${consulta.categoria}
Asunto: ${consulta.asunto}
Usuario: ${consulta.nickname} (ID ${consulta.userId})
Correo para responder: ${consulta.replyTo ?? "No informado"}
Plataforma: ${plataformaResumen}
Adjuntos: ${textoAdjuntos}

Mensaje:
${consulta.mensaje}

Contexto técnico:
${plataformaCompleta}`;

  return enviarCorreo(
    destino,
    `[MangaTotal · ${consulta.categoria}] ${consulta.asunto} — ${consulta.nickname} #${consulta.userId}`,
    plantillaCorreo({
      preheader: `${consulta.categoria}: ${consulta.asunto}`,
      etiqueta: "Soporte",
      titulo: "Nuevo mensaje de soporte",
      contenido,
      pie: "Mensaje generado desde el formulario de Consulta y errores de MangaTotal.",
    }),
    { text: texto, replyTo: consulta.replyTo, attachments: consulta.attachments },
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
  const contenido = `
    <p style="margin:0 0 15px">Hola <strong style="color:#f3eee8">${escapeHtml(user.nickname)}</strong>.</p>
    <p style="margin:0">Confirmá que este correo pertenece a tu cuenta de MangaTotal. Al hacerlo, podrás usarlo para recuperar el acceso cuando lo necesites.</p>
    ${botonCorreo(link, "Verificar mi correo")}
    <p style="margin:0 0 10px;color:#a9a29a;font-size:13px;line-height:20px">El enlace vence en 24 horas y solo se puede usar una vez.</p>
    <p style="margin:0;color:#817b75;font-size:12px;line-height:18px">Si el botón no abre, copiá esta dirección en tu navegador:<br><a href="${escapeHtml(link)}" style="color:#bd7cff;word-break:break-all">${escapeHtml(link)}</a></p>
  `;
  return enviarCorreo(
    user.email,
    "Verificá tu correo de MangaTotal",
    plantillaCorreo({
      preheader: "Confirmá tu dirección de correo para proteger tu cuenta de MangaTotal.",
      etiqueta: "Seguridad de la cuenta",
      titulo: "Verificá tu correo",
      contenido,
      pie: "Si no solicitaste esta verificación, podés ignorar el mensaje con seguridad.",
    }),
    {
      text: `Hola ${user.nickname}.

Confirmá que este correo pertenece a tu cuenta de MangaTotal:
${link}

El enlace vence en 24 horas y solo se puede usar una vez. Si no lo pediste, podés ignorarlo.`,
    },
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
  const contenido = `
    <p style="margin:0 0 15px">Hola <strong style="color:#f3eee8">${escapeHtml(user.nickname)}</strong>.</p>
    <p style="margin:0">Recibimos una solicitud para crear una contraseña nueva para tu cuenta de MangaTotal.</p>
    ${botonCorreo(link, "Crear una contraseña nueva")}
    <p style="margin:0 0 10px;color:#a9a29a;font-size:13px;line-height:20px">El enlace vence en 30 minutos y solo se puede usar una vez.</p>
    <p style="margin:0;color:#817b75;font-size:12px;line-height:18px">Si el botón no abre, copiá esta dirección en tu navegador:<br><a href="${escapeHtml(link)}" style="color:#bd7cff;word-break:break-all">${escapeHtml(link)}</a></p>
  `;
  return enviarCorreo(
    user.email,
    "Restablecé tu contraseña de MangaTotal",
    plantillaCorreo({
      preheader: "Usá este enlace para crear una contraseña nueva en MangaTotal.",
      etiqueta: "Seguridad de la cuenta",
      titulo: "Restablecé tu contraseña",
      contenido,
      pie: "Si no solicitaste este cambio, no abras el enlace y tu contraseña seguirá igual.",
    }),
    {
      text: `Hola ${user.nickname}.

Recibimos una solicitud para cambiar tu contraseña de MangaTotal:
${link}

El enlace vence en 30 minutos y solo se puede usar una vez. Si no lo pediste, no hagas nada.`,
    },
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
