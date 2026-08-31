"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function HeaderNavLink({
  href,
  children,
  exact = false,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      // se adelanta a traer la pestaña apenas se ve el enlace: al tocarla
      // ya está lista y el cambio se siente inmediato
      prefetch
      aria-current={active ? "page" : undefined}
      className={`relative inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink ${
        active
          ? "text-accent-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-accent-ink"
          : "text-subtle hover:bg-raised hover:text-ink"
      } ${className}`}
    >
      {children}
    </Link>
  );
}
