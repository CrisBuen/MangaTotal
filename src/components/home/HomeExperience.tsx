"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DownloadSection } from "@/components/pwa/DownloadSection";
import { TopSemanal } from "@/components/home/TopSemanal";
import { ContinueReading } from "@/components/home/ContinueReading";
import { HeroCarousel } from "@/components/discover/HeroCarousel";

interface Noticia {
  titulo: string; enlace: string; fecha: string | null; autor: string | null;
  categoria: string | null; imagen: string | null; resumen: string;
}
interface Me { nickname?: string; show_adult_content?: boolean }

/** Cuántas noticias entran en la rotación. Más que esto nadie las ve. */
const CUANTAS = 6;

export function HomeExperience() {
  const [noticias, setNoticias] = useState<Noticia[] | null>(null);
  const [me, setMe] = useState<Me>({});
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { signal: controller.signal })
      .then(r => r.ok ? r.json() : {}).then(data => setMe(data ?? {})).catch(() => {});
    fetch("/api/noticias/externas", { signal: controller.signal })
      .then(r => r.ok ? r.json() : { noticias: [] })
      .then(data => setNoticias(Array.isArray(data.noticias) ? data.noticias.slice(0, CUANTAS) : []))
      .catch(() => { if (!controller.signal.aborted) setNoticias([]); });
    return () => controller.abort();
  }, []);

  return <div className="od-home" data-od-id="home-page">
    <div className="od-fullbleed" data-od-id="home-hero">
      {/* La rotación se frena al leer o enfocar el héroe: no cambiar la noticia
          justo cuando alguien va a tocar el botón. HeroCarousel conserva esa regla. */}
      {noticias === null ? <div className="od-hero-skeleton" role="status">Cargando noticias…</div> : <HeroCarousel items={noticias.length ? noticias.map(noticia => ({
        id: noticia.enlace, title: noticia.titulo, image: noticia.imagen,
        description: noticia.resumen, meta: ["Noticias", noticia.categoria, noticia.autor || "Somos Kudasai"].filter(Boolean).join(" · "),
        href: noticia.enlace, action: "Abrir noticia", extra: <Link className="od-outline" href="/noticias">Ver todas</Link>,
      })) : [{ id: "biblioteca", title: "Todas tus historias. Una experiencia total.", image: null, description: "Las noticias no están disponibles en este momento. Podés seguir explorando tus fuentes y tu biblioteca.", href: "/biblioteca?f=normal", action: "Abrir biblioteca" }]} />}
    </div>
    <ContinueReading />
    <TopSemanal />
    <section className="od-home-access" data-od-id="home-library-access">
      <LibraryAccessCard eyebrow="Tu colección" title="Biblioteca de lectura" description="Manga, manhwa y manhua. Tus favoritos, novedades y progreso en un lugar." href="/biblioteca?f=normal" />
      <LibraryAccessCard eyebrow="Descubrir" title="Explorá tus fuentes" description="Encontrá tu próxima historia entre todos los catálogos integrados." href="/lectura/descubrir" />
      <LibraryAccessCard eyebrow="Favoritos" title="Las historias que elegís" description="Volvé a tus series favoritas y actualizá solamente esa selección." href="/biblioteca?f=favoritos" />
      {me.show_adult_content ? <LibraryAccessCard eyebrow="Preferencia activa" title="Contenido +18" description="Acceso según la configuración de tu perfil y plataforma." href="/biblioteca?f=adult" />
        : <LibraryAccessCard eyebrow="Cuenta" title={me.nickname ? "Tu experiencia" : "Guardá tu progreso"} description="Preferencias de contenido, lectura y seguridad de tu cuenta." href={me.nickname ? "/perfil" : "/login"} />}
    </section>
    <DownloadSection />
  </div>;
}

function LibraryAccessCard({ eyebrow, title, description, href }: { eyebrow: string; title: string; description: string; href: string }) {
  return <Link href={href} className="od-access-card"><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p><span className="od-access-arrow" aria-hidden="true">→</span></Link>;
}
