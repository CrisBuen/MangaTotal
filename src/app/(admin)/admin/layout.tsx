import { redirect } from "next/navigation";
import { AppHeader } from "@/components/ui/AppHeader";
import { getSessionUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/biblioteca");

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader
        mode="admin"
        user={{ nickname: user.nickname, avatarPath: user.avatarPath, isAdmin: user.isAdmin }}
      />
      <main
        className="mx-auto max-w-app px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
        data-od-id="admin-content"
      >
        {children}
      </main>
    </div>
  );
}
