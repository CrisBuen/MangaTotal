"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isAndroidApp } from "@/lib/appVersion";

const VISITOR_KEY = "mangatotal_analytics_id";
const HEARTBEAT_MS = 45_000;
const HEARTBEAT_ANDROID_MS = 90_000;

type Contexto = {
  section: string;
  source: string | null;
  contentKey: string | null;
};

function visitorId(): string | null {
  try {
    const guardado = localStorage.getItem(VISITOR_KEY);
    if (guardado) return guardado;
    const nuevo = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, nuevo);
    return nuevo;
  } catch {
    return null;
  }
}

function plataforma(): "web" | "android" | "windows" {
  if (/MangaTotalApp\//.test(navigator.userAgent)) return "android";
  const ventana = window as unknown as {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  };
  if (ventana.__TAURI_INTERNALS__ || ventana.__TAURI__) return "windows";
  return "web";
}

function contexto(pathname: string): Contexto | null {
  if (
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/registro"
  ) {
    return null;
  }

  if (pathname.startsWith("/leer/")) {
    return { section: "lectura", source: "mangatotal", contentKey: pathname };
  }

  if (pathname.startsWith("/leer-externo/")) {
    const parte = pathname.split("/").filter(Boolean)[1] ?? "";
    const conocidas: Record<string, string> = {
      catharsis: "catharsis",
      ikigai: "ikigai",
      leercapitulo: "leercapitulo",
      olympus: "olympus",
      tmo: "zonatmo",
    };
    return {
      section: "lectura",
      source: conocidas[parte] ?? "mangadex",
      contentKey: pathname,
    };
  }

  if (
    pathname.startsWith("/anime/jkanime/") ||
    pathname.startsWith("/explorar/jkanime/")
  ) {
    const partes = pathname.split("/").filter(Boolean);
    const esEpisodio =
      (partes[0] === "anime" && partes.length >= 4) ||
      (partes[0] === "explorar" && partes.length >= 4);
    return {
      section: "anime",
      source: esEpisodio ? "jkanime" : null,
      contentKey: esEpisodio ? pathname : null,
    };
  }

  if (pathname === "/") return { section: "inicio", source: null, contentKey: null };
  if (pathname.startsWith("/biblioteca")) {
    return { section: "biblioteca", source: null, contentKey: null };
  }
  if (pathname.startsWith("/explorar") || pathname.startsWith("/externo/")) {
    return { section: "explorar", source: null, contentKey: null };
  }
  if (pathname.startsWith("/anime")) return { section: "anilist", source: null, contentKey: null };
  if (pathname.startsWith("/noticias")) return { section: "noticias", source: null, contentKey: null };
  if (pathname.startsWith("/aleatorio")) return { section: "aleatorio", source: null, contentKey: null };
  if (pathname.startsWith("/estadisticas")) {
    return { section: "estadisticas", source: null, contentKey: null };
  }
  if (pathname.startsWith("/perfil")) return { section: "perfil", source: null, contentKey: null };
  if (pathname.startsWith("/ajustes")) return { section: "ajustes", source: null, contentKey: null };
  if (pathname.startsWith("/mas") || pathname.startsWith("/acerca-de")) {
    return { section: "mas", source: null, contentKey: null };
  }
  return { section: "otros", source: null, contentKey: null };
}

async function enviar(payload: Record<string, unknown>) {
  await fetch("/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
    cache: "no-store",
  }).catch(() => {});
}

/**
 * Telemetría propia, anónima y mínima.
 *
 * El servidor nunca recibe cuenta, apodo, IP desde este componente ni la
 * obra en texto: la ruta solo se usa para deduplicar y se convierte en hash.
 */
export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const id = visitorId();
    const actual = contexto(pathname);
    if (!id || !actual) return;

    const base = {
      visitorId: id,
      section: actual.section,
      source: actual.source,
      platform: plataforma(),
    };

    void enviar({ ...base, contentKey: actual.contentKey });

    // En el teléfono alcanza con un pulso cada 90 s para seguir contando
    // presencia en tiempo real y se reduce a la mitad el trabajo de red.
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") void enviar(base);
    }, isAndroidApp() ? HEARTBEAT_ANDROID_MS : HEARTBEAT_MS);

    const alVolver = () => {
      if (document.visibilityState === "visible") void enviar(base);
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [pathname]);

  return null;
}
