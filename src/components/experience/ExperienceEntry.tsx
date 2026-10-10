"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { LogoutButton } from "@/components/ui/LogoutButton";
import { useExperience } from "./ExperienceShell";

/** Una cuenta existente, no perfiles nuevos ni otra identidad de biblioteca. */
export function ExperienceEntry() {
  const { user, animeEnabled } = useExperience();
  const params = useSearchParams();
  const [selected, setSelected] = useState(!user || params.get("elegir") === "1");
  const [entering, setEntering] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const select = () => {
    setEntering(true);
    timer.current = setTimeout(() => { setSelected(true); setEntering(false); requestAnimationFrame(() => title.current?.focus()); }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240);
  };
  const enter = (href: string) => {
    if (entering) return;
    setEntering(true); router.push(href);
  };
  return <div className="od-entry" data-entering={entering}>
    <Link href="/" className="od-entry-brand" aria-label="MangaTotal, entrada"><Image src="/icons/mangatotal-logo-transparent.png" alt="" width={38} height={38} priority unoptimized /><span>MangaTotal</span></Link>
    <section className="od-entry-panel" aria-busy={entering}>
      {!selected && user ? <>
        <p className="od-eyebrow">Tu próxima historia te espera</p>
        <h1>¿Continuamos?</h1>
        <button className="od-profile-choice" onClick={select} disabled={entering} aria-label={`Continuar como ${user.nickname}`}>
          <UserAvatar nickname={user.nickname} avatarPath={user.avatarPath} className="od-entry-avatar" fallbackClassName="text-5xl font-bold" />
          <span>{user.nickname}</span>
        </button>
        <LogoutButton label="Cerrar sesión" />
      </> : <>
        <p className="od-eyebrow">{user ? `Bienvenido, ${user.nickname}` : "Tus historias, a tu manera"}</p>
        <h1 tabIndex={-1} ref={title}>¿Qué te apetece hoy?</h1>
        <p className="od-entry-description">Dos mundos. Una misma colección.</p>
        <div className="od-worlds">
          <button className="od-world reading" onClick={() => enter("/lectura")} disabled={entering}>
            <span className="od-world-art" aria-hidden="true"><svg viewBox="0 0 240 160"><path d="M30 33q45-17 90 9 45-26 90-9v100q-45-17-90 9-45-26-90-9z"/><path d="M120 42v100M49 61q26-8 49 5M49 81q26-8 49 5M49 101q26-8 49 5M142 66q23-13 49-5M142 86q23-13 49-5"/></svg></span>
            <span className="od-eyebrow">Manga · Manhwa · Manhua</span><h2>Lectura</h2><p>Explorá las fuentes, abrí un capítulo y seguí tu historia.</p><span className="od-world-action">Entrar a lectura <span aria-hidden="true">→</span></span>
          </button>
          <button className="od-world watching" onClick={() => enter(animeEnabled ? "/explorar?seccion=animada" : user ? "/ajustes" : "/login")} disabled={entering}>
            <span className="od-world-art" aria-hidden="true"><svg viewBox="0 0 240 160"><rect x="28" y="26" width="184" height="108" rx="10"/><path d="m102 55 44 25-44 25zM78 147h84"/></svg></span>
            <span className="od-eyebrow">Series · Episodios · Mi lista</span><h2>Anime</h2><p>{animeEnabled ? "Descubrí series y volvé al episodio donde te quedaste." : "Activá la sección animada desde los ajustes de tu cuenta."}</p><span className="od-world-action">{animeEnabled ? "Entrar a anime" : "Configurar acceso"} <span aria-hidden="true">→</span></span>
          </button>
        </div>
        {!user ? <p className="od-entry-note">Explorá como invitado. Para guardar y sincronizar, <Link href="/login">iniciá sesión</Link> o <Link href="/registro">creá tu cuenta</Link>.</p> : <div className="od-entry-account"><button onClick={() => setSelected(false)}>← Volver a mi cuenta</button><LogoutButton label="Cerrar sesión" /></div>}
      </>}
      {entering && <p className="od-entry-loading" role="status">Preparando tu experiencia…</p>}
    </section>
    <nav className="od-entry-links" aria-label="Información"><Link href="/mas">Más sobre MangaTotal</Link><Link href="/privacidad">Privacidad</Link></nav>
  </div>;
}
