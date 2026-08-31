"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AjustesFuentes } from "@/components/fuentes/AjustesFuentes";
import { Badge, EmptyState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { SectionHeading, Surface } from "@/components/ui/Surface";
import { isAndroidApp, isPlayStoreApp } from "@/lib/appVersion";

interface Me {
  nickname?: string;
  show_adult_content?: boolean;
  anime_enabled?: boolean;
  play_store_app?: boolean;
}

/**
 * Ajustes de la app.
 *
 * Separado de Perfil a propósito: Perfil es quién sos (apodo, foto,
 * contraseña) y esto es cómo se comporta la app. El contenido +18 vive acá,
 * en Seguridad y privacidad, y viene apagado.
 */
export default function AjustesPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [enAndroid, setEnAndroid] = useState(false);
  const [enPlay, setEnPlay] = useState(false);
  const [terminosAnime, setTerminosAnime] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnAndroid(isAndroidApp());
    setEnPlay(isPlayStoreApp());
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setMe(d ?? {});
        if (d?.play_store_app) setEnPlay(true);
      })
      .catch(() => setMe({}));
  }, []);

  async function cambiarAdulto(valor: boolean) {
    setError(null);
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_adult_content: valor }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "No se pudo guardar el ajuste");
      return;
    }
    const data = await res.json();
    setMe((m) => (m ? { ...m, show_adult_content: data.user.show_adult_content } : m));
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1500);
  }

  async function cambiarAnime(valor: boolean, aceptoTerminos = false) {
    if (enPlay && valor && !aceptoTerminos) {
      setTerminosAnime(true);
      return;
    }
    setError(null);
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anime_enabled: valor,
        accept_anime_terms: aceptoTerminos || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "No se pudo guardar el ajuste");
      return;
    }
    const data = await res.json();
    setMe((m) => (m ? { ...m, anime_enabled: data.user.anime_enabled } : m));
    setGuardado(true);
    setTerminosAnime(false);
    setTimeout(() => setGuardado(false), 1500);
  }

  const conSesion = Boolean(me?.nickname);

  return (
    <div className="space-y-10" data-od-id="settings-page">
      <SectionHeading
        eyebrow="Configuración"
        title="Ajustes"
        description="Cómo se comporta la app. Lo tuyo —apodo, foto y contraseña— está en Perfil."
      />

      <section>
        <h2 className="mb-5 font-display text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-tight tracking-[-0.035em] text-ink">
          Seguridad y privacidad
        </h2>

        {me === null ? null : !conSesion ? (
          <EmptyState
            title="Necesitás una cuenta"
            description="Estos ajustes se guardan en tu cuenta."
            action={
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-md border border-accent bg-accent px-5 font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)]"
              >
                Iniciar sesión
              </Link>
            }
          />
        ) : (
          <Surface className="divide-y divide-line p-0">
            {enPlay ? (
              <div className="p-5">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
                  Edición Google Play
                </p>
                <p className="mt-2 text-base font-semibold text-ink">
                  Disponible en la versión local
                </p>
                <p className="mt-1 max-w-2xl text-[13px] leading-5 text-subtle">
                  Algunas preferencias de contenido solo están disponibles en MangaTotal Local,
                  que se descarga desde el sitio oficial.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-6 p-5">
                <div>
                  <p className="text-sm font-bold text-ink">Mostrar contenido +18</p>
                  <p className="mt-1 text-[13px] leading-5 text-subtle">
                    Viene apagado. Al encenderlo aparece la sección +18 en Biblioteca y deja de
                    filtrarse ese contenido en el resto de la app.
                  </p>
                </div>
                <button
                  onClick={() => cambiarAdulto(!me?.show_adult_content)}
                  className={`min-h-11 w-16 shrink-0 rounded-full border border-line-strong p-1 transition-colors ${
                    me?.show_adult_content ? "bg-accent" : "bg-panel"
                  }`}
                  aria-pressed={Boolean(me?.show_adult_content)}
                  aria-label="Mostrar contenido +18"
                >
                  <span
                    className={`block h-7 w-7 rounded-full border border-line bg-ink transition-transform ${
                      me?.show_adult_content ? "translate-x-6" : ""
                    }`}
                  />
                </button>
              </div>
            )}
            {enAndroid && (
              <div className="flex items-center justify-between gap-6 p-5">
                <div>
                  <p className="text-sm font-bold text-ink">Activar sección animada</p>
                  <p className="mt-1 text-[13px] leading-5 text-subtle">
                    Viene apagada en Android. Al encenderla aparecen JKAnime y TioAnime dentro de Explorar y
                    la biblioteca de anime animado. AniList permanece disponible siempre.
                  </p>
                </div>
                <button
                  onClick={() => cambiarAnime(!me?.anime_enabled)}
                  className={`min-h-11 w-16 shrink-0 rounded-full border border-line-strong p-1 transition-colors ${
                    me?.anime_enabled ? "bg-accent" : "bg-panel"
                  }`}
                  aria-pressed={Boolean(me?.anime_enabled)}
                  aria-label="Activar sección animada"
                >
                  <span
                    className={`block h-7 w-7 rounded-full border border-line bg-ink transition-transform ${
                      me?.anime_enabled ? "translate-x-6" : ""
                    }`}
                  />
                </button>
              </div>
            )}
            {error && (
              <p role="alert" className="p-5 text-sm text-[var(--danger-fg)]">
                {error}
              </p>
            )}
            {guardado && <div className="p-5"><Badge tone="success">Guardado</Badge></div>}
          </Surface>
        )}
      </section>

      {terminosAnime && (
        <>
          <button
            className="fixed inset-0 z-[80] bg-black/70"
            onClick={() => setTerminosAnime(false)}
            aria-label="Cerrar condiciones"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="anime-terms-title"
            className="fixed inset-x-4 bottom-4 z-[81] mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-[10px] border border-line-strong bg-panel p-6 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
          >
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
              Antes de activar
            </p>
            <h2 id="anime-terms-title" className="mt-2 font-display text-3xl font-bold text-ink">
              Condiciones de la sección animada
            </h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-subtle">
              <p>
                La sección animada muestra catálogos y reproductores proporcionados por fuentes
                externas autorizadas. MangaTotal no aloja los videos.
              </p>
              <p>
                Al continuar confirmás que usarás la sección respetando las normas aplicables,
                las condiciones de cada fuente y los derechos de sus titulares.
              </p>
              <p>
                Podés desactivarla en cualquier momento. La edición de Google Play mantiene
                bloqueado todo contenido +18 aunque aceptes estas condiciones.
              </p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                onClick={() => setTerminosAnime(false)}
                variant="secondary"
              >
                Rechazar
              </Button>
              <Button
                onClick={() => cambiarAnime(true, true)}
                variant="primary"
              >
                Aceptar y activar
              </Button>
            </div>
          </section>
        </>
      )}

      <section>
        <h2 className="mb-5 font-display text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-tight tracking-[-0.035em] text-ink">
          Avanzado
        </h2>
        <AjustesFuentes />
        <p className="mt-4 text-[13px] leading-5 text-subtle">
          Estos ajustes solo aparecen dentro de la app de Android o de Windows, que es donde las
          fuentes se leen desde tu propia conexión.
        </p>
      </section>
    </div>
  );
}
