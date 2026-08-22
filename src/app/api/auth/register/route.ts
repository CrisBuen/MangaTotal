import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getSession, publicUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  let body: { nickname?: string; password?: string; birthdate?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const nickname = body.nickname?.trim() ?? "";
  const password = body.password ?? "";
  const birthdateRaw = body.birthdate?.trim();

  if (!/^[a-zA-Z0-9_.-]{2,30}$/.test(nickname)) {
    return NextResponse.json(
      { error: "El apodo debe tener 2-30 caracteres, sin espacios (letras, números, _ . -)" },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres" },
      { status: 400 }
    );
  }

  let birthdate: Date | null = null;
  if (birthdateRaw) {
    const parsed = new Date(birthdateRaw + "T00:00:00");
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Fecha de nacimiento inválida" }, { status: 400 });
    }
    birthdate = parsed;
  }

  const existing = await db.user.findUnique({ where: { nickname } });
  if (existing) {
    return NextResponse.json({ error: "Ese apodo ya está en uso" }, { status: 409 });
  }

  // Primer usuario registrado = admin automáticamente (docs/07 §7.1)
  const userCount = await db.user.count();
  const isAdmin = userCount === 0;

  // Precarga de la preferencia +18 según edad (dato personal, no gate legal)
  let showAdultContent = false;
  if (birthdate) {
    const age = (Date.now() - birthdate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    showAdultContent = age >= 18;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: { nickname, passwordHash, birthdate, isAdmin, showAdultContent },
  });

  const session = await getSession();
  session.userId = user.id;
  session.nickname = user.nickname;
  session.isAdmin = user.isAdmin;
  await session.save();

  return NextResponse.json({ user: publicUser(user) }, { status: 201 });
}
