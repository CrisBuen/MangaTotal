"use client";

import Link from "next/link";

interface BotonMigrarProps {
  fuente: string;
  externalId: string;
  slug?: string | null;
  titulo: string;
  className?: string;
  variante?: "boton" | "icono" | "compacto";
}

export function BotonMigrar({
  fuente,
  externalId,
  slug,
  titulo,
  className = "",
  variante = "boton",
}: BotonMigrarProps) {
  const params = new URLSearchParams({
    fuente,
    id: externalId,
    titulo,
  });
  if (slug) params.set("slug", slug);

  const href = `/migrar?${params.toString()}`;

  if (variante === "icono") {
    return (
      <Link
        href={href}
        title={`Migrar «${titulo}» a otra fuente`}
        aria-label={`Migrar «${titulo}» a otra fuente`}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-[var(--surface-raised)] text-subtle transition-all hover:border-accent hover:text-accent-ink hover:scale-105 active:scale-95 ${className}`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      </Link>
    );
  }

  if (variante === "compacto") {
    return (
      <Link
        href={href}
        title={`Migrar «${titulo}» a otra fuente`}
        className={`inline-flex items-center gap-1.5 rounded-md border border-line bg-[var(--surface-raised)] px-2.5 py-1 text-xs font-semibold text-subtle transition-all hover:border-accent hover:text-accent-ink active:scale-95 ${className}`}
      >
        <svg className="h-3.5 w-3.5 text-accent-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        <span>Migrar</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      title={`Migrar «${titulo}» a otra fuente`}
      className={`inline-flex items-center gap-2 rounded-md border border-line bg-[var(--surface-raised)] px-4 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition-all hover:border-accent hover:text-ink active:scale-95 ${className}`}
    >
      <svg className="h-3.5 w-3.5 text-accent-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
      <span>Migrar obra</span>
    </Link>
  );
}
