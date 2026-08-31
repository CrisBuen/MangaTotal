"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AjustesFuentes } from "@/components/fuentes/AjustesFuentes";
import { Badge, EmptyState } from "@/components/ui/Feedback";
import { SectionHeading, Surface } from "@/components/ui/Surface";
import { isAndroidApp } from "@/lib/appVersion";

interface Me {
  nickname?: string;
  show_adult_content?: boolean;
  anime_enabled?: boolean;
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
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnAndroid(isAndroidApp());
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d ?? {}))
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

  async function cambiarAnime(valor: boolean) {
    setError(null);
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anime_enabled: valor }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "No se pudo guardar el ajuste");
      return;
    }
    const data = await res.json();
    setMe((m) => (m ? { ...m, anime_enabled: data.user.anime_enabled } : m));
    setGuardado(true);
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
        <h2 className="mb-5 font-display text-3xl font-black uppercase leading-none text-ink">
          Seguridad y privacidad
        </h2>

        {me === null ? null : !conSesion ? (
          <EmptyState
            title="Necesitás una cuenta"
            description="Estos ajustes se guardan en tu cuenta."
            action={
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-xl border border-accent bg-accent px-5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bg)]"
              >
                Iniciar sesión
              </Link>
            }
          />
        ) : (
          <Surface className="space-y-6 p-6">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-sm font-bold text-ink">Mostrar contenido +18</p>
                <p className="mt-1 text-xs leading-5 text-subtle">
                  Viene apagado. Al encenderlo aparece la sección +18 en Biblioteca y deja de
                  filtrarse ese contenido en el resto de la app.
                </p>
              </div>
              <button
                onClick={() => cambiarAdulto(!me?.show_adult_content)}
                className={`min-h-11 w-16 shrink-0 rounded-full border border-line p-1 transition ${
                  me?.show_adult_content ? "bg-accent shadow-[var(--glow)]" : "bg-panel"
                }`}
                aria-pressed={Boolean(me?.show_adult_content)}
                aria-label="Mostrar contenido +18"
              >
                <span
                  className={`block h-7 w-7 rounded-full border border-line bg-ink transition ${
                    me?.show_adult_content ? "translate-x-6" : ""
                  }`}
                />
              </button>
            </div>
            {enAndroid && (
              <div className="flex items-center justify-between gap-6 border-t border-line pt-6">
                <div>
                  <p className="text-sm font-bold text-ink">Activar sección animada</p>
                  <p className="mt-1 text-xs leading-5 text-subtle">
                    Viene apagada en Android. Al encenderla aparecen JKAnime y TioAnime dentro de Explorar y
                    la biblioteca de anime animado. AniList permanece disponible siempre.
                  </p>
                </div>
                <button
                  onClick={() => cambiarAnime(!me?.anime_enabled)}
                  className={`min-h-11 w-16 shrink-0 rounded-full border border-line p-1 transition ${
                    me?.anime_enabled ? "bg-accent shadow-[var(--glow)]" : "bg-panel"
                  }`}
                  aria-pressed={Boolean(me?.anime_enabled)}
                  aria-label="Activar sección animada"
                >
                  <span
                    className={`block h-7 w-7 rounded-full border border-line bg-ink transition ${
                      me?.anime_enabled ? "translate-x-6" : ""
                    }`}
                  />
                </button>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}
            {guardado && <Badge tone="success">Guardado</Badge>}
          </Surface>
        )}
      </section>

      <section>
        <h2 className="mb-5 font-display text-3xl font-black uppercase leading-none text-ink">
          Avanzado
        </h2>
        <AjustesFuentes />
        <p className="mt-4 text-xs leading-5 text-subtle">
          Estos ajustes solo aparecen dentro de la app de Android o de Windows, que es donde las
          fuentes se leen desde tu propia conexión.
        </p>
      </section>
    </div>
  );
}
