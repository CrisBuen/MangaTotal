"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { activarPantallaCompleta } from "@/lib/pantalla";

/**
 * La pantalla completa web solo puede pedirse dentro del gesto del usuario.
 * Por eso se solicita antes de navegar; el documento sobrevive al cambio de
 * ruta y el reproductor aparece ya ocupando la pantalla.
 */
export function EpisodeWatchLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  const abrir = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    void activarPantallaCompleta().finally(() => router.push(href));
  };

  return (
    <Link href={href} onClick={abrir} className={className}>
      {children}
    </Link>
  );
}
