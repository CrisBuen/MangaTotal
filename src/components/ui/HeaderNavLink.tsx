"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function HeaderNavLink({
  href,
  children,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative inline-flex min-h-11 shrink-0 items-center rounded-lg px-1 text-[11px] font-bold uppercase tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-2 ${
        active
          ? "bg-[var(--accent-soft)] text-accent shadow-[var(--glow)] after:absolute after:inset-x-2 after:bottom-0 after:h-px after:bg-accent"
          : "text-subtle hover:bg-[var(--surface-raised)] hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
