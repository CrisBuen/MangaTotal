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
      {/*
        overflow-x-hidden es una red, no el arreglo.
        Si alguna sección vuelve a ser más ancha que la pantalla, se recorta
        acá en vez de correr la página entera y despegar el encabezado. Ya
        pasó dos veces y cuesta de encontrar porque solo se nota en pantallas
        angostas. Lo de adentro igual hay que arreglarlo.
        Se puede poner sin miedo porque nada de estas páginas usa position
        sticky: los lectores viven fuera de este layout y el encabezado es
        hermano de main, no hijo.
      */}
      <main
        className="mx-auto max-w-app overflow-x-hidden px-4 pb-28 pt-8 sm:px-6 sm:pt-12 lg:px-10 lg:pb-20"
        data-od-id="page-content"
      >
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
