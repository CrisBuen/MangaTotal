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
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/admin" className="text-lg font-bold text-violet-400">
            Lector Total <span className="text-xs font-normal text-zinc-500">admin</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/biblioteca"
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
            >
              Ir a la biblioteca
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
