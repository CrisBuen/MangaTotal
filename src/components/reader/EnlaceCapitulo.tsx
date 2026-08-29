"use client";

import { useRouter } from "next/navigation";

/**
 * Enlace de un capítulo al siguiente o al anterior.
 *
 * REEMPLAZA la entrada del historial en vez de apilar otra, y esa es toda la
 * gracia. Con un enlace normal, leer del capítulo 1 al 6 deja seis entradas:
 * el botón de atrás —o el gesto de Android— devuelve al capítulo 5 en vez de
 * volver a donde estabas, y de paso guarda ese capítulo como tu progreso, así
 * que perdés por dónde ibas.
 *
 * Reemplazando, el historial conserva solo lo de antes de entrar a leer. Así
 * "atrás" hace lo que se espera:
 *
 *   Biblioteca → capítulo → (leés varios) → atrás → Biblioteca
 *   Explorar → ficha → capítulo → (leés varios) → atrás → ficha → Explorar
 *
 * Solo para ir de un capítulo a otro. Entrar al lector desde una ficha o una
 * lista sí tiene que apilar, o "atrás" no tendría a dónde volver.
 */
export function EnlaceCapitulo({
  href,
  className,
  children,
  onNavegar,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  /** Por si hay que anotar algo antes de cambiar de capítulo. */
  onNavegar?: () => void;
}) {
  const router = useRouter();

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        // se respeta abrir en otra pestaña: ctrl/cmd, botón del medio, etc.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onNavegar?.();
        router.replace(href);
      }}
    >
      {children}
    </a>
  );
}
