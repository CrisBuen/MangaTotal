import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { db } from "./db";

export interface SessionData {
  userId?: number;
  nickname?: string;
  isAdmin?: boolean;
}

export const SESSION_COOKIE_NAME = "lector_total_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: SESSION_COOKIE_NAME,
  ttl: SESSION_TTL_SECONDS,
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    // uso privado en localhost/LAN, sin HTTPS
    secure: false,
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/** Usuario actual desde la cookie de sesión, o null si no hay sesión válida. */
export async function getSessionUser() {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await db.user.findUnique({ where: { id: session.userId } });
  return user ?? null;
}

/** Igual que getSessionUser pero exige is_admin. */
export async function getSessionAdmin() {
  const user = await getSessionUser();
  if (!user || !user.isAdmin) return null;
  return user;
}

/** Representación segura de un usuario (sin password_hash). */
export function publicUser(user: {
  id: number;
  nickname: string;
  birthdate: Date | null;
  isAdmin: boolean;
  showAdultContent: boolean;
  preferredReadingMode: string;
  avatarPath: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    nickname: user.nickname,
    birthdate: user.birthdate,
    is_admin: user.isAdmin,
    show_adult_content: user.showAdultContent,
    preferred_reading_mode: user.preferredReadingMode,
    avatar_path: user.avatarPath,
    created_at: user.createdAt,
  };
}
