"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { navegarAtrasInteligente } from "@/lib/navegacionEstado";

/**
 * "Volver" del lector.
 *
 * Devuelve a la pantalla anterior real usando navegarAtrasInteligente para evitar
 * bucles hacia otros capítulos o lectores si se encadenaron sustituciones.
 */
export function BotonVolver({
  href,
  className,
  children = "← Volver",
}: {
  /** A dónde ir cuando no hay pantalla anterior válida. */
  href: string;
  className?: string;
  children?: ReactNode;
}) {
  const router = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    navegarAtrasInteligente(router, href, { evitarLector: true });
  };

  return (
    <Link href={href} prefetch={false} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
