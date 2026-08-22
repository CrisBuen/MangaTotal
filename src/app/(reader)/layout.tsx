import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/ui/LogoutButton";

export default async function ReaderLayout({ children }: { children: React.ReactNode }) {
  // visitante sin sesión: puede navegar la biblioteca y desde el menú
  // iniciar sesión o registrarse
  const user = await getSessionUser();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/biblioteca" className="text-lg font-bold text-violet-400">
            Lector Total
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/biblioteca"
              className="rounded-lg px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800"
            >
              Biblioteca
            </Link>
            {user && (
              <Link
                href="/perfil"
                className="rounded-lg px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800"
              >
                Perfil
              </Link>
            )}
            {user?.isAdmin && (
              <Link
                href="/admin"
                className="rounded-lg px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800"
              >
                Admin
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <Link href="/perfil" className="flex items-center gap-2">
                  <span className="hidden text-sm text-zinc-500 sm:inline">{user.nickname}</span>
                  <span className="h-8 w-8 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800">
                    {user.avatarPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/images/${user.avatarPath}`}
                        alt={user.nickname}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-sm font-bold text-violet-400">
                        {user.nickname.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                </Link>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/registro"
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
