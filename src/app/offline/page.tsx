import Link from "next/link";

export const metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-center">
      <div className="max-w-md">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
          MangaTotal
        </p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-[-0.04em] text-ink">
          Sin conexión
        </h1>
        <p className="mt-4 text-sm leading-6 text-subtle">
          No hay internet en este momento. Los capítulos que ya leíste siguen disponibles; el
          resto vuelve apenas se recupere la conexión.
        </p>
        <Link
          href="/biblioteca"
          className="mt-8 inline-flex min-h-11 items-center rounded-xl border border-accent bg-accent px-6 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bg)]"
        >
          Reintentar
        </Link>
      </div>
    </div>
  );
}
