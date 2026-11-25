"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogoutButton } from "@/components/ui/LogoutButton";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface AdminUserInfo {
  nickname: string;
  avatarPath: string | null;
}

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  exact?: boolean;
  icon: ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Principal",
    items: [
      {
        href: "/admin",
        label: "Resumen",
        shortLabel: "Resumen",
        exact: true,
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1.5" />
            <rect x="14" y="3" width="7" height="5" rx="1.5" />
            <rect x="14" y="12" width="7" height="9" rx="1.5" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" />
          </svg>
        ),
      },
      {
        href: "/admin/analiticas",
        label: "Analíticas",
        shortLabel: "Analíticas",
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="m7 15 4-4 3 3 6-7" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Catálogo",
    items: [
      {
        href: "/admin/subir",
        label: "Subir capítulo",
        shortLabel: "Subir",
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15V4" />
            <path d="m7 9 5-5 5 5" />
            <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
        ),
      },
      {
        href: "/admin/series",
        label: "Series",
        shortLabel: "Series",
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Comunidad",
    items: [
      {
        href: "/admin/noticias",
        label: "Noticias",
        shortLabel: "Noticias",
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h13a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2V5Z" />
            <path d="M8 9h7" />
            <path d="M8 13h7" />
            <path d="M8 17h4" />
          </svg>
        ),
      },
      {
        href: "/admin/usuarios",
        label: "Usuarios",
        shortLabel: "Usuarios",
        icon: (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function isRouteActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Contenedor unificado del panel de administración.
 *
 * Todos los enlaces usan `prefetch={false}` a propósito: en Next.js 15 el
 * prefetch automático dispara invocaciones serverless de rutas dinámicas al
 * entrar o pasar el ratón, consumiendo cuota de Vercel sin necesidad.
 */
export function AdminShell({
  user,
  children,
}: {
  user: AdminUserInfo;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentItem = ALL_ITEMS.find((item) => isRouteActive(pathname, item)) ?? ALL_ITEMS[0];

  const renderSidebarContent = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
          <Link
            href="/admin"
            prefetch={false}
            onClick={onNavigate}
            className="flex min-w-0 items-center gap-2.5"
            data-od-id="brand-link"
          >
            <Image
              src="/icons/mangatotal-logo-transparent.png"
              alt=""
              width={32}
              height={32}
              priority
              unoptimized
              className="h-8 w-8 shrink-0 object-contain"
            />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display text-lg font-bold tracking-[-0.025em] text-ink">
                MangaTotal
              </span>
              <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-ink">
                Panel Admin
              </span>
            </span>
          </Link>
        </div>

        <nav
          className="space-y-6 px-3 py-5"
          aria-label="Navegación de administración"
          data-od-id="admin-navigation"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
                {group.title}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = isRouteActive(pathname, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        prefetch={false}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          active
                            ? "bg-[var(--accent-soft)] font-semibold text-ink"
                            : "text-subtle hover:bg-[var(--surface-raised)] hover:text-ink"
                        }`}
                      >
                        {active && (
                          <span
                            className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-accent"
                            aria-hidden="true"
                          />
                        )}
                        <span className={active ? "text-accent-ink" : "text-faint group-hover:text-subtle"}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="space-y-3 border-t border-line p-4">
        <div className="flex items-center gap-3 rounded-lg border border-line bg-[var(--surface-soft)] px-3 py-2.5">
          <UserAvatar
            nickname={user.nickname}
            avatarPath={user.avatarPath}
            className="h-9 w-9 shrink-0 rounded-full border border-line-strong bg-raised"
            fallbackClassName="font-display text-base font-semibold text-ink"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{user.nickname}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent-ink">
              Administrador
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            prefetch={false}
            onClick={onNavigate}
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-[var(--surface-raised)] px-3 text-xs font-semibold text-subtle transition-colors hover:border-line-strong hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Ver sitio
          </Link>
          <LogoutButton />
        </div>
      </div>
    </div>
  );

  return (
    <div className="od-shell flex min-h-screen bg-canvas text-ink">
      {/* Barra lateral fija en escritorio */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-panel lg:block">
        {renderSidebarContent()}
      </aside>

      {/* Cajón móvil */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú del panel">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-panel shadow-2xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Cerrar menú"
              className="absolute right-3 top-3.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-[var(--surface-raised)] text-subtle hover:text-ink"
            >
              ×
            </button>
            {renderSidebarContent(() => setDrawerOpen(false))}
          </aside>
        </div>
      )}

      {/* Columna principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur-sm"
          data-od-id="admin-header"
          style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px))" }}
        >
          <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Abrir menú del panel"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-[var(--surface-raised)] text-subtle hover:text-ink lg:hidden"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>

              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-faint sm:inline">
                  Panel
                </span>
                <span className="hidden text-faint sm:inline">/</span>
                <span className="truncate font-display text-base font-bold text-ink">
                  {currentItem.label}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2" data-od-id="account-actions">
              <Link
                href="/admin/subir"
                prefetch={false}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-accent bg-accent px-3 text-xs font-bold text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="hidden sm:inline">Subir .zip</span>
                <span className="sm:hidden">Subir</span>
              </Link>
              <Link
                href="/"
                prefetch={false}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-[var(--surface-raised)] px-3 text-xs font-semibold text-subtle transition-colors hover:border-line-strong hover:text-ink lg:hidden"
              >
                Sitio
              </Link>
            </div>
          </div>

          {/* Barra rápida horizontal solo en móvil/tablet */}
          <nav
            className="flex items-center gap-1 overflow-x-auto border-t border-line/70 px-3 py-1.5 lg:hidden"
            aria-label="Accesos rápidos de administración"
          >
            {ALL_ITEMS.map((item) => {
              const active = isRouteActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-[var(--accent-soft)] text-accent-ink"
                      : "text-subtle hover:bg-[var(--surface-raised)] hover:text-ink"
                  }`}
                >
                  {item.shortLabel}
                </Link>
              );
            })}
          </nav>
        </header>

        <main
          className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
          data-od-id="admin-content"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
