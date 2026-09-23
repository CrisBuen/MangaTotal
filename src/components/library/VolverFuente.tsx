"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { regresoFuente } from "@/lib/fuentesBiblioteca";

type Props = { href: string; className?: string; children: ReactNode };
function Enlace(props: Props) {
  const params = useSearchParams();
  const regreso = regresoFuente(params.get("bibliotecaFuente"));
  return <Link {...props} href={regreso ?? props.href} replace={Boolean(regreso)}>
    {regreso ? "← Series de esta fuente" : props.children}
  </Link>;
}

/** Solo altera el regreso cuando la ficha se abrió desde Más → Fuentes. */
export function VolverFuente(props: Props) {
  return <Suspense fallback={<Link {...props} />}><Enlace {...props} /></Suspense>;
}
