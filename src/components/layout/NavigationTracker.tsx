"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  consumirMarcaReemplazo,
  ejecutarFlushProgresoGlobal,
  esRutaLectorOPlayer,
  estaRestaurandoScroll,
  getRutaActivaMemoria,
  guardarScrollRuta,
  guardarUltimaRutaMundo,
  normalizarClaveRuta,
  registrarVisitaRuta,
  setRutaActivaMemoria,
  suscribirCambioRutaManual,
} from "@/lib/navegacionEstado";

declare global {
  interface Window {
    __mtFlushProgress?: () => void;
  }
}

const RUTAS_EXCLUIDAS_MUNDO = [
  "/",
  "/login",
  "/registro",
  "/verificar-correo",
  "/recuperar-contrasena",
  "/perfil",
  "/ajustes",
  "/mas",
  "/consulta",
  "/acerca-de",
  "/privacidad",
  "/estadisticas",
  "/noticias",
  "/aleatorio",
];

function mundoDeRuta(pathname: string, params: Pick<URLSearchParams, "get">): "lectura" | "anime" | null {
  if (RUTAS_EXCLUIDAS_MUNDO.includes(pathname)) return null;
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/leer/") ||
    pathname.startsWith("/leer-externo/") ||
    pathname.startsWith("/noticias/")
  ) {
    return null;
  }

  if (pathname === "/explorar") {
    return params.get("seccion") === "animada" ? "anime" : "lectura";
  }

  if (/^\/(explorar|anime)\/(jkanime|tioanime|mundodonghua|hentaitv)\/[^/]+$/.test(pathname)) {
    return "anime";
  }

  if (
    pathname === "/lectura" ||
    pathname === "/lectura/descubrir" ||
    pathname === "/biblioteca" ||
    pathname === "/fuentes" ||
    pathname.startsWith("/externo/") ||
    pathname.startsWith("/serie/")
  ) {
    return "lectura";
  }

  return null;
}

function TrackerInterno() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const searchStr = searchParams.toString();

  const rutaActivaRef = useRef<string | null>(null);
  const ultimaPosicionRef = useRef<{ clave: string; y: number } | null>(null);
  const huboPopStateRef = useRef(false);

  // Registro global para flush de progreso (p. ej. Android MainActivity.onPause y app backgrounding)
  // y captura fiable de scroll antes de navegar o salir.
  useEffect(() => {
    window.__mtFlushProgress = ejecutarFlushProgresoGlobal;

    let timerScroll: ReturnType<typeof setTimeout> | null = null;

    const guardarPosicionActual = () => {
      if (estaRestaurandoScroll()) return;
      const claveActual =
        rutaActivaRef.current ??
        getRutaActivaMemoria() ??
        normalizarClaveRuta(window.location.pathname, window.location.search);
      // Solo leemos window.scrollY si window.location sigue correspondiendo a claveActual.
      const claveVentana = normalizarClaveRuta(window.location.pathname, window.location.search);
      if (claveVentana === claveActual) {
        const y = window.scrollY;
        ultimaPosicionRef.current = { clave: claveActual, y };
        guardarScrollRuta(claveActual, y);
      } else if (ultimaPosicionRef.current?.clave === claveActual) {
        guardarScrollRuta(claveActual, ultimaPosicionRef.current.y);
      }
    };

    const alHacerScroll = () => {
      if (estaRestaurandoScroll()) return;
      const claveVentana = normalizarClaveRuta(window.location.pathname, window.location.search);
      const claveActual = rutaActivaRef.current ?? getRutaActivaMemoria() ?? claveVentana;
      if (claveVentana !== claveActual) return;
      ultimaPosicionRef.current = { clave: claveActual, y: window.scrollY };
      if (timerScroll) clearTimeout(timerScroll);
      timerScroll = setTimeout(guardarPosicionActual, 110);
    };

    // En fase capture el clic ocurre ANTES de que Next.js <Link> navegue o reinicie el scroll a 0.
    const alInteractuarNavegacion = () => {
      guardarPosicionActual();
    };

    const alPopState = () => {
      const claveVentana = normalizarClaveRuta(window.location.pathname, window.location.search);
      // Solo marcamos popstate de ruta si cambió pathname+search; un Back de hash
      // (p. ej. #ficha-anime o #etiquetas-hitomi) no debe afectar la siguiente ruta.
      if (claveVentana !== rutaActivaRef.current) {
        huboPopStateRef.current = true;
      }
      if (ultimaPosicionRef.current) {
        guardarScrollRuta(ultimaPosicionRef.current.clave, ultimaPosicionRef.current.y);
        if (esRutaLectorOPlayer(ultimaPosicionRef.current.clave)) {
          ejecutarFlushProgresoGlobal();
        }
      }
    };

    const alOcultar = () => {
      if (document.visibilityState === "hidden") {
        guardarPosicionActual();
        ejecutarFlushProgresoGlobal();
      }
    };

    const alSalir = () => {
      guardarPosicionActual();
      ejecutarFlushProgresoGlobal();
    };

    const desuscribirManual = suscribirCambioRutaManual((nuevaClave, anteriorClave) => {
      if (anteriorClave && ultimaPosicionRef.current?.clave === anteriorClave && !estaRestaurandoScroll()) {
        guardarScrollRuta(anteriorClave, ultimaPosicionRef.current.y);
      }
      rutaActivaRef.current = nuevaClave;
      ultimaPosicionRef.current = { clave: nuevaClave, y: window.scrollY };
    });

    window.addEventListener("scroll", alHacerScroll, { passive: true });
    document.addEventListener("click", alInteractuarNavegacion, true);
    document.addEventListener("submit", alInteractuarNavegacion, true);
    window.addEventListener("popstate", alPopState);
    document.addEventListener("visibilitychange", alOcultar);
    window.addEventListener("pagehide", alSalir);
    window.addEventListener("beforeunload", alSalir);

    return () => {
      desuscribirManual();
      if (timerScroll) clearTimeout(timerScroll);
      window.removeEventListener("scroll", alHacerScroll);
      document.removeEventListener("click", alInteractuarNavegacion, true);
      document.removeEventListener("submit", alInteractuarNavegacion, true);
      window.removeEventListener("popstate", alPopState);
      document.removeEventListener("visibilitychange", alOcultar);
      window.removeEventListener("pagehide", alSalir);
      window.removeEventListener("beforeunload", alSalir);
    };
  }, []);

  // Seguimiento sincronizado con el router de Next.js (Link, router.push/replace y popstate).
  useEffect(() => {
    const claveNueva = normalizarClaveRuta(pathname, searchStr);
    const urlRelativa = searchStr ? `${pathname}?${searchStr}` : pathname;

    if (rutaActivaRef.current === null) {
      rutaActivaRef.current = claveNueva;
      setRutaActivaMemoria(claveNueva);
      registrarVisitaRuta(urlRelativa);
      ultimaPosicionRef.current = { clave: claveNueva, y: window.scrollY };
    } else if (rutaActivaRef.current !== claveNueva) {
      const claveAnterior = rutaActivaRef.current;
      if (ultimaPosicionRef.current?.clave === claveAnterior && !estaRestaurandoScroll()) {
        guardarScrollRuta(claveAnterior, ultimaPosicionRef.current.y);
      }
      const esPop = huboPopStateRef.current;
      huboPopStateRef.current = false;
      const reemplazar = consumirMarcaReemplazo();

      registrarVisitaRuta(urlRelativa, { esPop, reemplazar });
      rutaActivaRef.current = claveNueva;
      setRutaActivaMemoria(claveNueva);
      // Al llegar vía popstate la página suele abrir en y=0 antes de que useRestaurarScroll
      // recupere la posición guardada; no pisar ese valor si el usuario sale antes.
      ultimaPosicionRef.current = esPop ? null : { clave: claveNueva, y: window.scrollY };
    }

    const mundo = mundoDeRuta(pathname, searchParams);
    if (mundo) {
      guardarUltimaRutaMundo(mundo, urlRelativa);
    }
  }, [pathname, searchStr, searchParams]);

  return null;
}

/** Rastreador global de ruta, pila interna, scroll y guardado de progreso. */
export function NavigationTracker() {
  return (
    <Suspense fallback={null}>
      <TrackerInterno />
    </Suspense>
  );
}
