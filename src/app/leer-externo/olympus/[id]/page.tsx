import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OlympusReader } from "@/components/reader/OlympusReader";
import { getSessionUser } from "@/lib/auth";
import { OLYMPUS_NOMBRE, paginas, urlSerieEnOlympus } from "@/lib/olympus";

export const dynamic = "force-dynamic";

export default async function LeerOlympusPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ slug?: string; tipo?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id: raw } = await props.params;
  const { slug, tipo = "comic" } = await props.searchParams;
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id) || !slug) notFound();

  let capitulo;
  try {
    capitulo = await paginas(id, tipo, slug);
  } catch {
    notFound();
  }

  // acceso anticipado: se respeta el modelo de Olympus y se enlaza a su sitio
  if (capitulo.protegido) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-black uppercase leading-tight tracking-[-0.04em] text-ink">
          Capítulo con acceso anticipado
        </h1>
        <p className="mt-4 text-sm leading-6 text-subtle">
          {OLYMPUS_NOMBRE} reserva este capítulo para quienes apoyan su trabajo. Podés leerlo en
          su sitio.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={capitulo.url_original}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-accent bg-accent px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bg)]"
          >
            Leer en {OLYMPUS_NOMBRE} ↗
          </a>
          <Link
            href={`/externo/olympus/${slug}`}
            className="rounded-xl border border-line px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink"
          >
            Ver capítulos
          </Link>
        </div>
      </div>
    );
  }

  if (capitulo.pages.length === 0) notFound();

  return (
    <OlympusReader
      chapter={{ id: capitulo.id, name: capitulo.name, urlOriginal: capitulo.url_original }}
      serie={{ slug, tipo, urlOriginal: urlSerieEnOlympus(tipo, slug) }}
      grupo={OLYMPUS_NOMBRE}
      pages={capitulo.pages.map((url, i) => ({ pageNumber: i + 1, url, width: 0, height: 0 }))}
      prevChapter={capitulo.prev}
      nextChapter={capitulo.next}
      initialMode={user.preferredReadingMode === "rtl" ? "rtl" : "cascade"}
    />
  );
}
