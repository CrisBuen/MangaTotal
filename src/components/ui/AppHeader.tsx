import Image from "next/image";
import Link from "next/link";
import { buttonStyles } from "./Button";
import { HeaderNavLink } from "./HeaderNavLink";
import { LogoutButton } from "./LogoutButton";
import { RandomSeriesButton } from "./RandomSeriesButton";
import { UserAvatar } from "./UserAvatar";

interface HeaderUser {
  nickname: string;
  avatarPath: string | null;
  isAdmin: boolean;
}

const adminLinks = [
  { href: "/admin", label: "Resumen", exact: true },
  { href: "/admin/analiticas", label: "Analíticas" },
  { href: "/admin/subir", label: "Subir capítulo" },
  { href: "/admin/series", label: "Series" },
  { href: "/admin/noticias", label: "Noticias" },
  { href: "/admin/usuarios", label: "Usuarios" },
];

export function AppHeader({
  user,
  mode = "reader",
}: {
  user: HeaderUser | null;
  mode?: "reader" | "admin";
}) {
  const links =
    mode === "admin"
      ? adminLinks
      : [
          { href: "/", label: "Inicio", exact: true },
          { href: "/biblioteca", label: "Biblioteca", exact: true },
          { href: "/explorar", label: "Explorar" },
          { href: "/anime", label: "AniList" },
          { href: "/noticias", label: "Noticias" },
        ];

  return (
    <header
      className="sticky top-0 z-40 border-b border-line bg-panel"
      data-od-id={mode === "admin" ? "admin-header" : "site-header"}
    >
      <div className="mx-auto flex min-h-16 max-w-app items-center gap-x-3 px-4 sm:px-6 lg:gap-x-5 lg:px-10"
        style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <Link
          href={mode === "admin" ? "/admin" : "/"}
          className="group flex min-h-11 shrink-0 items-center gap-2 pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
          data-od-id="brand-link"
          aria-label={mode === "admin" ? "MangaTotal, administración" : "MangaTotal, biblioteca"}
        >
          <Image
            src="/icons/mangatotal-logo-transparent.png"
            alt=""
            width={34}
            height={34}
            priority
            unoptimized
            className="h-[34px] w-[34px] shrink-0 object-contain"
          />
          <span className="leading-none">
            <span className="block font-display text-lg font-bold tracking-[-0.025em] text-ink lg:text-xl">
              MangaTotal
            </span>
            {mode === "admin" && (
              <span className="mt-0.5 hidden font-mono text-[11px] font-medium tracking-[0.08em] text-faint sm:block">
                Administración
              </span>
            )}
          </span>
        </Link>

        <nav
          className={`min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap ${mode === "admin" ? "flex" : "hidden md:flex"}`}
          data-od-id={mode === "admin" ? "admin-navigation" : "primary-navigation"}
          aria-label={mode === "admin" ? "Navegación de administración" : "Navegación principal"}
        >
          {links.map((link) => (
            <HeaderNavLink
              key={link.href}
              href={link.href}
              exact={link.exact}
              className={mode !== "admin" && link.href === "/noticias" ? "hidden xl:inline-flex" : ""}
            >
              {link.label}
            </HeaderNavLink>
          ))}
          {mode !== "admin" && <RandomSeriesButton />}
        </nav>

        <div className="ml-auto flex min-h-11 items-center gap-1.5" data-od-id="account-actions">
          {mode !== "admin" && (
            <Link
              href="/mas"
              className={buttonStyles({
                variant: "secondary",
                size: "sm",
                className: "hidden xl:inline-flex",
              })}
              data-od-id="more-link"
            >
              Más
            </Link>
          )}
          {mode === "admin" && (
            <Link href="/" className={buttonStyles({ variant: "ghost", size: "sm" })}>
              <span className="sm:hidden">Sitio</span>
              <span className="hidden sm:inline">Ver MangaTotal</span>
            </Link>
          )}

          {user ? (
            <>
              {mode !== "admin" && (
                <Link
                  href="/perfil"
                  className="flex min-h-11 items-center gap-2 rounded-md px-1 text-sm text-subtle transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
                  aria-label={`Abrir perfil de ${user.nickname}`}
                >
                  <span className="hidden max-w-28 truncate xl:block">{user.nickname}</span>
                  <UserAvatar
                    nickname={user.nickname}
                    avatarPath={user.avatarPath}
                    className="h-8 w-8 rounded-full border border-line-strong bg-raised"
                    fallbackClassName="font-display text-lg font-semibold text-ink"
                  />
                </Link>
              )}
              {mode !== "admin" && user.isAdmin && (
                <Link href="/admin/subir" className={buttonStyles({ variant: "secondary", size: "sm", className: "hidden sm:inline-flex" })}>
                  Subir
                </Link>
              )}
              {mode === "admin" && (
                <span className="hidden max-w-28 truncate px-2 text-sm text-subtle lg:block">
                  {user.nickname}
                </span>
              )}
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={buttonStyles({ variant: "ghost", size: "sm" })}
                data-od-id="login-link"
              >
                <span className="hidden sm:inline">Entrar</span>
                <span className="sm:hidden">Login</span>
              </Link>
              <Link
                href="/registro"
                className={buttonStyles({ variant: "primary", size: "sm", className: "hidden sm:inline-flex" })}
                data-od-id="register-link"
              >
                Registrarse
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
