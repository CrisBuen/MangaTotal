import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getSession, publicUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  let body: { nickname?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const nickname = body.nickname?.trim() ?? "";
  const password = body.password ?? "";
  if (!nickname || !password) {
    return NextResponse.json({ error: "Faltan apodo o contraseña" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { nickname } });
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) {
    return NextResponse.json({ error: "Apodo o contraseña incorrectos" }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.nickname = user.nickname;
  session.isAdmin = user.isAdmin;
  await session.save();

  return NextResponse.json({ user: publicUser(user) });
}
