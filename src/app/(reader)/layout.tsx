import { Suspense } from "react";
import { ExperienceShell } from "@/components/experience/ExperienceShell";
import { getSessionUser } from "@/lib/auth";
import { animePublicoPermitido } from "@/lib/animeAcceso";

export default async function ReaderLayout({ children }: { children: React.ReactNode }) {
  // La biblioteca sigue siendo pública; la sesión solo modifica las acciones disponibles.
  const user = await getSessionUser();
  const animeEnabled = await animePublicoPermitido(user);

  return (
    <Suspense fallback={<p role="status" className="p-8">Cargando MangaTotal…</p>}><ExperienceShell animeEnabled={animeEnabled}
        user={
          user
            ? {
                nickname: user.nickname,
                avatarPath: user.avatarPath,
                isAdmin: user.isAdmin,
                animeEnabled,
              }
            : null
        }
      >
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
        {children}
      </ExperienceShell></Suspense>
  );
}
