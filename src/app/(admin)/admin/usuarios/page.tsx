import { redirect } from "next/navigation";
import { AdminUsersClient } from "@/components/admin/AdminUsersClient";
import type { AdminUser } from "@/components/admin/UserSettingsDialog";
import { getSessionAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/login");

  // Carga inicial directa en SSR: evita disparar dos funciones extra (/api/auth/me + /api/admin/users) al abrir.
  const rows = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      nickname: true,
      isAdmin: true,
      showAdultContent: true,
      email: true,
      emailVerifiedAt: true,
      createdAt: true,
    },
  });

  const initialUsers: AdminUser[] = rows.map((u) => ({
    id: u.id,
    nickname: u.nickname,
    is_admin: u.isAdmin,
    show_adult_content: u.showAdultContent,
    email: u.email,
    email_verified: Boolean(u.emailVerifiedAt),
    created_at: u.createdAt.toISOString(),
  }));

  return <AdminUsersClient initialUsers={initialUsers} currentUserId={admin.id} />;
}
