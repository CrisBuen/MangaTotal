import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** POST /api/auth/password { current_password, new_password } */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let body: { current_password?: string; new_password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const current = body.current_password ?? "";
  const next = body.new_password ?? "";

  if (!(await bcrypt.compare(current, user.passwordHash))) {
    return NextResponse.json({ error: "La contraseña actual es incorrecta" }, { status: 401 });
  }
  if (next.length < 8) {
    return NextResponse.json(
      { error: "La contraseña nueva debe tener al menos 8 caracteres" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(next, 10);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
