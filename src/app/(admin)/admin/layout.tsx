import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/ui/LogoutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/biblioteca");

  const links = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/subir", label: "Subir capítulo" },
    { href: "/admin/series", label: "Series" },
    { href: "/admin/noticias", label: "Noticias" },
    { href: "/admin/usuarios", label: "Usuarios" },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <Link href="/admin" className="whitespace-nowrap text-lg font-bold text-violet-400">
            Lector Total <span className="text-xs font-normal text-zinc-500">admin</span>
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:order-last">
            <Link
              href="/biblioteca"
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
            >
              Biblioteca
            </Link>
            <LogoutButton />
          </div>
          <nav className="-mx-1 flex w-full items-center gap-1 overflow-x-auto text-sm sm:w-auto">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
