"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/ui/AppHeader";
import { MobileNav } from "@/components/ui/MobileNav";
import { ReadingNavigation } from "./ReadingNavigation";
import { readingTab } from "@/lib/readingNavigation";

export type ExperienceMode = "lectura" | "anime";
export interface ExperienceUser { nickname: string; avatarPath: string | null; isAdmin: boolean; animeEnabled: boolean }
const ExperienceContext = createContext<{ mode: ExperienceMode; user: ExperienceUser | null; animeEnabled: boolean }>({ mode: "lectura", user: null, animeEnabled: false });
export const useExperience = () => useContext(ExperienceContext);

export function ExperienceShell({ user, animeEnabled, children }: { user: ExperienceUser | null; animeEnabled: boolean; children: ReactNode }) {
  const path = usePathname();
  const params = useSearchParams();
  const [previous, setPrevious] = useState<ExperienceMode>("lectura");
  const animeRoute = /^\/(explorar|anime)\/(jkanime|tioanime|hentaitv)(\/|$)/.test(path) || (path === "/explorar" && params.get("seccion") === "animada");
  const readingRoute = readingTab(path, params) !== null;
  const mode = animeRoute ? "anime" : readingRoute ? "lectura" : previous;
  useEffect(() => {
    if (animeRoute || readingRoute) {
      const value = animeRoute ? "anime" : "lectura";
      setPrevious(value);
      try { sessionStorage.setItem("mangatotal:experiencia", value); } catch { /* Modo privado: la URL alcanza. */ }
    } else {
      try { setPrevious(sessionStorage.getItem("mangatotal:experiencia") === "anime" ? "anime" : "lectura"); } catch { /* Sin persistencia. */ }
    }
  }, [animeRoute, readingRoute, path]);
  const entry = path === "/";
  return <ExperienceContext.Provider value={{ mode, user, animeEnabled }}>
    <div className="od-shell min-h-screen bg-canvas" data-experience={entry ? "entrada" : mode}>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[100] focus:bg-accent focus:p-3">Saltar al contenido</a>
      {!entry && <AppHeader user={user} />}
      {/* Se conserva la red contra desbordamiento; los lectores viven fuera
          del layout y mantienen su geometría propia de tiras largas. */}
      <main id="contenido" className={entry ? "od-entry-main" : "mx-auto max-w-app overflow-x-hidden px-4 pb-28 pt-8 sm:px-6 md:pb-20 md:pt-10 lg:px-10"} data-od-id={entry ? "entry-content" : "page-content"}>
        {!entry && mode === "lectura" && <ReadingNavigation />}
        {children}
      </main>
      {!entry && mode === "anime" && <MobileNav />}
    </div>
  </ExperienceContext.Provider>;
}
