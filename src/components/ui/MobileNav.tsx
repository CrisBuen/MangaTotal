"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useExperience } from "@/components/experience/ExperienceShell";

/**
 * Barra de navegación inferior para teléfonos. En pantallas altas (S26
 * Ultra y similares) los enlaces de arriba quedan lejos del pulgar, así que
 * en móvil la navegación principal vive abajo, como en cualquier app.
 * Respeta la barra de gestos del sistema con safe-area.
 */

const LECTURA_ITEMS = [
  {
    href: "/lectura",
    label: "Inicio",
    exact: true,
    icon: "M12 3 2 12h3v8h6v-5h2v5h6v-8h3z",
  },
  {
    href: "/lectura/descubrir",
    label: "Descubrir",
    icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm2.5 5.5l-2 5.5-5.5 2 2-5.5 5.5-2z",
  },
  {
    href: "/biblioteca?f=normal",
    label: "Biblioteca",
    icon: "M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z",
  },
  {
    href: "/explorar",
    label: "Catálogo",
    icon: "M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z",
  },
  {
    href: "/mas",
    label: "Más",
    icon: "M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z",
  },
];

const ANIME_ITEMS = [
  {
    href: "/explorar?seccion=animada",
    label: "Descubrir",
    exact: true,
    icon: "M12 3 2 12h3v8h6v-5h2v5h6v-8h3z",
  },
  {
    href: "/explorar?seccion=animada&vista=catalogo",
    label: "Catálogo",
    icon: "M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z",
  },
  {
    href: "/explorar?seccion=animada&vista=milista",
    label: "Mi lista",
    icon: "M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z",
  },
  {
    href: "/explorar?seccion=animada&vista=catalogo&status=emision",
    label: "En emisión",
    icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z",
  },
  {
    href: "/mas",
    label: "Más",
    icon: "M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z",
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const { mode } = useExperience();

  const isAnime = mode === "anime";
  const animeSource = params.get("anime_fuente");
  const sourceSuffix = animeSource === "tioanime" || animeSource === "jkanime" ? `&anime_fuente=${animeSource}` : "";

  const items = isAnime
    ? ANIME_ITEMS.map(it => it.href.includes("?") ? { ...it, href: it.href + sourceSuffix } : it)
    : LECTURA_ITEMS;

  const currentVista = params.get("vista") || null;
  const currentSeccion = params.get("seccion") || null;
  const currentStatus = params.get("status") || null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[rgba(255,255,255,0.08)] bg-[#090b10]/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Navegación principal"
      data-od-id="mobile-nav"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map((item) => {
          const itemUrl = new URL(item.href, "http://localhost");
          const itemPath = itemUrl.pathname;
          const itemVista = itemUrl.searchParams.get("vista") || null;
          const itemStatus = itemUrl.searchParams.get("status") || null;

          let active = false;
          if (item.href === "/mas") {
            active = pathname === "/mas" || pathname === "/perfil" || pathname === "/ajustes" || pathname === "/noticias" || pathname === "/aleatorio";
          } else if (isAnime) {
            if (itemStatus) {
              active = currentStatus === itemStatus;
            } else if (itemVista) {
              active = currentVista === itemVista && !currentStatus;
            } else if (item.exact) {
              active = pathname === "/explorar" && currentSeccion === "animada" && !currentVista && !currentStatus;
            }
          } else {
            if (item.exact) {
              active = pathname === "/lectura" || pathname === "/";
            } else if (itemPath === "/biblioteca") {
              active = pathname === "/biblioteca" || pathname === "/fuentes";
            } else if (itemPath === "/lectura/descubrir") {
              active = pathname === "/lectura/descubrir";
            } else if (itemPath === "/explorar") {
              active = pathname === "/explorar" && currentSeccion !== "animada";
            } else {
              active = pathname === itemPath;
            }
          }

          return (
            <li key={item.label} className="flex-1">
              <Link
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[3.6rem] flex-col items-center justify-center gap-1 transition-colors ${
                  active ? "text-[var(--accent-fg)] font-bold" : "text-[#8a92a6] hover:text-[#e0e4ef]"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d={item.icon} />
                </svg>
                <span className="text-[10.5px] tracking-tight">
                  {item.label}
                </span>
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[var(--accent-fg)]" aria-hidden="true" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
