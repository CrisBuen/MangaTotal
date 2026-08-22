import { NextResponse } from "next/server";
import { getSessionAdmin, publicUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/admin/users — lista de usuarios sin password_hash. */
export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(users.map(publicUser));
}
