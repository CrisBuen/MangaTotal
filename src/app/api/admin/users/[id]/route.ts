import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin, publicUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** PATCH /api/admin/users/:id { is_admin? } — promover/degradar cuentas. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { id: raw } = await ctx.params;
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  let body: { is_admin?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (typeof body.is_admin !== "boolean") {
    return NextResponse.json({ error: "Falta is_admin" }, { status: 400 });
  }

  if (id === admin.id && body.is_admin === false) {
    return NextResponse.json(
      { error: "No podés quitarte el rol de admin a vos mismo" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const updated = await db.user.update({ where: { id }, data: { isAdmin: body.is_admin } });
  return NextResponse.json({ user: publicUser(updated) });
}

/** DELETE /api/admin/users/:id */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { id: raw } = await ctx.params;
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  if (id === admin.id) {
    return NextResponse.json({ error: "No podés borrar tu propia cuenta" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  await db.user.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
