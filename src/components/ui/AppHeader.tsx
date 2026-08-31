import Image from "next/image";
import Link from "next/link";
import { buttonStyles } from "./Button";
import { HeaderNavLink } from "./HeaderNavLink";
import { LogoutButton } from "./LogoutButton";
import { RandomSeriesButton } from "./RandomSeriesButton";

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
      className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_oklch,var(--bg)_86%,transparent)] shadow-[0_14px_45px_color-mix(in_oklch,var(--bg)_72%,transparent)] backdrop-blur-xl"
      data-od-id={mode === "admin" ? "admin-header" : "site-header"}
    >
      <div className="mx-auto flex min-h-[72px] max-w-app flex-wrap items-center gap-x-6 px-4 sm:px-6 lg:px-10"
        style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <Link
          href={mode === "admin" ? "/admin" : "/"}
          className="group flex min-h-11 shrink-0 items-center gap-3 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-od-id="brand-link"
          aria-label={mode === "admin" ? "MangaTotal, administración" : "MangaTotal, biblioteca"}
        >
          <Image
            src="/icons/mangatotal-logo-v2.png"
            alt=""
            width={40}
            height={40}
            priority
            unoptimized
            className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-[var(--glow)]"
          />
          <span className="leading-none">
            <span className="block font-display text-[1.35rem] font-black uppercase tracking-[-0.045em] text-ink">
              MangaTotal
            </span>
            {mode === "admin" && (
              <span className="mt-1 hidden font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-accent sm:block">
                Administración
              </span>
            )}
          </span>
        </Link>

        <nav
          className={`order-3 w-full items-center gap-3 overflow-x-auto whitespace-nowrap border-t border-line lg:order-none lg:flex lg:w-auto lg:border-0 ${mode === "admin" ? "flex" : "hidden"}`}
          data-od-id={mode === "admin" ? "admin-navigation" : "primary-navigation"}
          aria-label={mode === "admin" ? "Navegación de administración" : "Navegación principal"}
        >
          {links.map((link) => (
            <HeaderNavLink key={link.href} href={link.href} exact={link.exact}>
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
                className: "hidden lg:inline-flex",
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
                  className="flex min-h-11 items-center gap-2 px-1.5 text-sm text-subtle transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label={`Abrir perfil de ${user.nickname}`}
                >
                  <span className="hidden max-w-32 truncate sm:block">{user.nickname}</span>
                  <span className="h-9 w-9 overflow-hidden border border-line bg-panel">
                    {user.avatarPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/images/${user.avatarPath}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-display text-lg font-semibold text-ink">
                        {user.nickname.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
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
