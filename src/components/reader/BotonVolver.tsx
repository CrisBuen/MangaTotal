"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * "Volver" del lector.
 *
 * Devuelve a la pantalla anterior de verdad: si entraste desde Biblioteca,
 * vuelve a Biblioteca; si entraste desde la ficha, vuelve a la ficha. Solo
 * cuando no hay nada atrás (un enlace abierto directo) va a la ficha.
 */
export function BotonVolver({
  href,
  className,
  children = "← Volver",
}: {
  /** A dónde ir cuando no hay pantalla anterior. */
  href: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [hayAtras, setHayAtras] = useState(false);

  useEffect(() => {
    // history.length es 1 cuando la pestaña se abrió directamente acá
    setHayAtras(window.history.length > 1);
  }, []);

  if (!hayAtras) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => router.back()} className={className}>
      {children}
    </button>
  );
}
