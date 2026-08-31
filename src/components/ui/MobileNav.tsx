"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Barra de navegación inferior para teléfonos. En pantallas altas (S26
 * Ultra y similares) los enlaces de arriba quedan lejos del pulgar, así que
 * en móvil la navegación principal vive abajo, como en cualquier app.
 * Respeta la barra de gestos del sistema con safe-area.
 */

const ITEMS = [
  {
    href: "/",
    label: "Inicio",
    exact: true,
    icon: "M12 3 2 12h3v8h6v-5h2v5h6v-8h3z",
  },
  {
    href: "/biblioteca",
    label: "Biblioteca",
    icon: "M4 4h6v16H4zM12 4h3v16h-3zM17 4h3v16h-3z",
  },
  {
    href: "/explorar",
    label: "Explorar",
    icon: "M11 3a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 11 3zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z",
  },
  {
    href: "/anime",
    label: "Anime",
    icon: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm5 3v8l7-4z",
  },
  {
    // en el teléfono la barra solo da para cinco: Perfil, Ajustes,
    // Noticias y Aleatorio viven dentro de Más
    href: "/mas",
    label: "Más",
    icon: "M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-panel md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegación principal"
      data-od-id="mobile-nav"
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                // las cinco pestañas se traen por adelantado: son pocas y
                // es lo que hace que la barra de abajo responda al toque
                prefetch
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 transition-colors ${
                  active ? "text-accent-ink" : "text-faint"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d={item.icon} />
                </svg>
                <span className="text-[11px] font-medium">
                  {item.label}
                </span>
                {active && (
                  <span className="absolute top-0 h-0.5 w-10 bg-accent-ink" aria-hidden="true" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
