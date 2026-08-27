import { AppHeader } from "@/components/ui/AppHeader";
import { MobileNav } from "@/components/ui/MobileNav";
import { getSessionUser } from "@/lib/auth";

export default async function ReaderLayout({ children }: { children: React.ReactNode }) {
  // La biblioteca sigue siendo pública; la sesión solo modifica las acciones disponibles.
  const user = await getSessionUser();

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader
        user={
          user
            ? { nickname: user.nickname, avatarPath: user.avatarPath, isAdmin: user.isAdmin }
            : null
        }
      />
      <main
        className="mx-auto max-w-app px-4 pb-28 pt-8 sm:px-6 sm:pt-12 lg:px-10 lg:pb-20"
        data-od-id="page-content"
      >
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
