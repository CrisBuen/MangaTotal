"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SectionHeading, Surface } from "@/components/ui/Surface";
import { enAppInstalada, installedVersionCode } from "@/lib/appVersion";

/** Las fuentes integradas, cada una con permiso por escrito de su sitio. */
const FUENTES = [
  { nombre: "MangaDex", web: "https://mangadex.org" },
  { nombre: "Olympus Scanlation", web: "https://olympusxyz.com" },
  { nombre: "ZonaTMO", web: "https://zonatmo.net" },
  { nombre: "Ikigai Mangas", web: "https://visorikigai.gettocaboca.com" },
  { nombre: "Catharsis World", web: "https://newcatharsis.dig-it.info" },
];

export default function AcercaDePage() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!enAppInstalada()) return;
    // la app se identifica con su número de versión en el user agent
    setVersion(String(installedVersionCode()));
  }, []);

  return (
    <div className="space-y-10" data-od-id="about-page">
      <SectionHeading
        eyebrow="MangaTotal"
        title="Acerca de"
        description="Qué es esto y de dónde sale lo que leés."
      />

      <Surface className="space-y-4 p-6 sm:p-8">
        <p className="text-sm leading-7 text-subtle">
          MangaTotal reúne en un solo lugar tu biblioteca, tu progreso y las series que seguís, sin
          importar de dónde vengan. Todo queda atado a tu cuenta: si cambiás de teléfono o abrís la
          web, seguís donde ibas.
        </p>
        {version && (
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
            Versión instalada · {version}
          </p>
        )}
      </Surface>

      <section>
        <h2 className="mb-5 font-display text-3xl font-black uppercase leading-none text-ink">
          Las fuentes
        </h2>
        <p className="mb-5 text-sm leading-7 text-subtle">
          Cada una está integrada con permiso por escrito de su sitio, y lo que leés se carga desde
          sus propios servidores: acá no se aloja nada. Si una serie te gusta, pasá por la página de
          quien la publica.
        </p>
        <Surface className="divide-y divide-line p-0">
          {FUENTES.map((f) => (
            <a
              key={f.nombre}
              href={f.web}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-[var(--surface-raised)]"
            >
              <span className="text-sm font-bold text-ink">{f.nombre}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
                Visitar ↗
              </span>
            </a>
          ))}
        </Surface>
      </section>

      <section>
        <h2 className="mb-5 font-display text-3xl font-black uppercase leading-none text-ink">
          Tu cuenta
        </h2>
        <Surface className="space-y-4 p-6 sm:p-8">
          <p className="text-sm leading-7 text-subtle">
            Se guarda tu correo, tu apodo, tu biblioteca y por dónde vas leyendo. Nada más, y nada
            se comparte con nadie.
          </p>
          <Link href="/perfil" className="inline-block text-sm text-accent hover:underline">
            Ver tu perfil →
          </Link>
        </Surface>
      </section>
    </div>
  );
}
