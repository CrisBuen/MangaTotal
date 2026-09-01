"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SectionHeading, Surface } from "@/components/ui/Surface";
import { isAndroidApp } from "@/lib/appVersion";

/**
 * "Más": lo que no entra en la barra de abajo.
 *
 * En Android la barra solo da para cinco pestañas, así que Noticias y
 * Aleatorio viven acá. En la web y Windows esos dos accesos ya están en el
 * encabezado y no se repiten.
 */
const SECCIONES: {
  titulo: string;
  entradas: {
    href: string;
    label: string;
    descripcion: string;
    icono: string;
    soloAndroid?: boolean;
  }[];
}[] = [
  {
    titulo: "Descubrir",
    entradas: [
      {
        href: "/aleatorio",
        label: "Aleatorio",
        descripcion: "Una serie al azar de cualquiera de las fuentes",
        icono: "M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6zm0 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 6c1.7 0 3 1.3 3 3H9c0-1.7 1.3-3 3-3z",
        soloAndroid: true,
      },
      {
        href: "/noticias",
        label: "Noticias",
        descripcion: "Anuncios y novedades de MangaTotal",
        icono: "M4 4h16v16H4zm2 3v2h12V7zm0 4v2h12v-2zm0 4v2h8v-2z",
        soloAndroid: true,
      },
      {
        href: "/estadisticas",
        label: "Estadísticas",
        descripcion: "Lo que llevás leído y guardado",
        icono: "M4 20V10h3v10zm6.5 0V4h3v16zM17 20v-6h3v6z",
      },
    ],
  },
  {
    titulo: "Tu cuenta",
    entradas: [
      {
        href: "/perfil",
        label: "Perfil",
        descripcion: "Apodo, foto y contraseña",
        icono: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z",
      },
      {
        href: "/ajustes",
        label: "Ajustes",
        descripcion: "Seguridad y privacidad, opciones avanzadas",
        icono: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 4-2-1.2.3-2.3-2.2-1.3-1.8 1.5-2.1-.9L12 5.6l-1.2 2.2-2.1.9L6.9 7.2 4.7 8.5 5 10.8 3 12l2 1.2-.3 2.3 2.2 1.3 1.8-1.5 2.1.9L12 18.4l1.2-2.2 2.1-.9 1.8 1.5 2.2-1.3-.3-2.3z",
      },
      {
        href: "/acerca-de",
        label: "Acerca de",
        descripcion: "Qué es esto y de dónde sale lo que leés",
        icono: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z",
      },
    ],
  },
  {
    titulo: "Ayuda y comunidad",
    entradas: [
      {
        href: "/consulta",
        label: "Consulta y errores",
        descripcion: "Reportá un problema, pedí ayuda o enviá una consulta",
        icono: "M4 4h16v13H7l-3 3zm3 4h10V6H7zm0 4h7v-2H7z",
      },
      {
        href: "https://www.patreon.com/cw/Nycks",
        label: "Apóyanos",
        descripcion: "Ayudá a que MangaTotal siga creciendo en Patreon",
        icono: "M4 3h4v18H4zm10 0a7 7 0 1 1 0 14 7 7 0 0 1 0-14z",
      },
    ],
  },
];

export default function MasPage() {
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    setAndroid(isAndroidApp());
  }, []);

  return (
    <div className="space-y-10" data-od-id="more-page">
      <SectionHeading eyebrow="MangaTotal" title="Más" description="Todo lo demás, en un solo lugar." />

      {SECCIONES.map((seccion) => (
        <section key={seccion.titulo}>
          <h2 className="mb-4 font-mono text-[11px] font-bold tracking-[0.16em] text-subtle">
            {seccion.titulo}
          </h2>
          <Surface className="divide-y divide-line p-0">
            {seccion.entradas
              .filter((entrada) => android || !entrada.soloAndroid)
              .map((e) => (
              <Link
                key={e.href}
                href={e.href}
                target={e.href.startsWith("https://") ? "_blank" : undefined}
                rel={e.href.startsWith("https://") ? "noopener noreferrer" : undefined}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--surface-raised)]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0 fill-current text-accent-ink"
                  aria-hidden="true"
                >
                  <path d={e.icono} />
                </svg>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{e.label}</span>
                  <span className="mt-0.5 block text-[13px] leading-5 text-subtle">{e.descripcion}</span>
                </span>
                <span className="shrink-0 text-subtle" aria-hidden="true">
                  {e.href.startsWith("https://") ? "↗" : "›"}
                </span>
              </Link>
              ))}
          </Surface>
        </section>
      ))}
    </div>
  );
}
