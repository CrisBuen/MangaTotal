import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getSessionUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/biblioteca");

  return (
    <AdminShell user={{ nickname: user.nickname, avatarPath: user.avatarPath }}>
      {children}
    </AdminShell>
  );
}
