"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ImgHTMLAttributes } from "react";
import { cargarImagenNativa, debeUsarPuenteNativo, esImagenIkigai } from "@/lib/imagenFuenteNativa";
import { cargarPaginaCw, esPaginaCw } from "@/lib/catharsis";

const CW_DIRECTUS_ASSETS_HEREDADO = "https://direct-new-catha.catharsisfood.com/assets/";

function normalizarSrcImagen(
  src: ImgHTMLAttributes<HTMLImageElement>["src"]
): ImgHTMLAttributes<HTMLImageElement>["src"] {
  // Directus cerró /assets con 401 el 25/11/2026; reescribir aquí cura al vuelo las
  // portadas de Catharsis ya guardadas en biblioteca/historial sin tocar la BD.
  if (typeof src === "string" && src.startsWith(CW_DIRECTUS_ASSETS_HEREDADO)) {
    return `https://newcatharsis.dig-it.info/assets/${src.slice(CW_DIRECTUS_ASSETS_HEREDADO.length)}`;
  }
  return src;
}

/** Prioriza el puente nativo en Android y PC para no pasar por Vercel; conserva medidas y eventos del img. */
export const ImagenFuente = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(
  function ImagenFuente({ src: rawSrc, loading, alt, ...props }, forwardedRef) {
    const src = normalizarSrcImagen(rawSrc);
    const elemento = useRef<HTMLImageElement>(null);
    const loadingRef = useRef(loading);
    loadingRef.current = loading;
    useImperativeHandle(forwardedRef, () => elemento.current!);
    const esIkigai = typeof src === "string" && esImagenIkigai(src);
    // Las páginas de Catharsis llegan barajadas: nunca se pueden mostrar tal
    // cual, así que no tienen respaldo "web" y siempre pasan por el descifrado
    const esCw = typeof src === "string" && esPaginaCw(src);
    const sinRespaldo = esIkigai || esCw;
    const [cargada, setCargada] = useState<{
      src: string;
      url?: string;
      error?: string;
      fallbackWeb?: boolean;
    } | null>(null);
    const [intento, setIntento] = useState(0);
    const resultado = cargada?.src === src ? cargada : null;
    const usarNativo =
      typeof src === "string" &&
      !resultado?.fallbackWeb &&
      (sinRespaldo || debeUsarPuenteNativo(src));

    useEffect(() => {
      if (!usarNativo || typeof src !== "string") return;
      let cancelado = false;
      const controlador = new AbortController();
      let objeto: string | undefined;
      let observador: IntersectionObserver | undefined;
      const cargar = async () => {
        try {
          const blob = esCw
            ? await cargarPaginaCw(src, controlador.signal)
            : await cargarImagenNativa(src, {
                signal: controlador.signal,
                prioridad: loadingRef.current === "lazy" ? 0 : 1,
              });
          if (cancelado) return;
          objeto = URL.createObjectURL(blob);
          setCargada({ src, url: objeto });
        } catch (error) {
          if (cancelado) return;
          if (!sinRespaldo) {
            // Respaldo transparente a /api/externo/imagen si el binario nativo aún no está actualizado
            // o si Hitomi acaba de rotar su prefijo gg.b.
            setCargada({ src, fallbackWeb: true });
          } else {
            setCargada({
              src,
              error: error instanceof Error ? error.message : "No se pudo cargar la imagen",
            });
          }
        }
      };
      if (loadingRef.current === "lazy" && typeof IntersectionObserver !== "undefined" && elemento.current) {
        observador = new IntersectionObserver(
          (entradas) => {
            if (entradas.some((e) => e.isIntersecting)) {
              observador?.disconnect();
              void cargar();
            }
          },
          { rootMargin: "1200px" }
        );
        observador.observe(elemento.current);
      } else {
        void cargar();
      }
      return () => {
        cancelado = true;
        controlador.abort();
        observador?.disconnect();
        if (objeto) URL.revokeObjectURL(objeto);
      };
      // `loading` queda fuera de dependencias a propósito: cambiar entre "eager" y "lazy"
      // durante el scroll jamás debe revocar el blob: ya pintado (causaba parpadeo negro).
    }, [src, usarNativo, esIkigai, esCw, sinRespaldo, intento]);

    const urlFinal = usarNativo
      ? resultado?.url
      : resultado?.fallbackWeb && typeof src === "string" && !src.startsWith("/api/externo/imagen")
      ? `/api/externo/imagen?u=${encodeURIComponent(src)}`
      : src;

    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          {...props}
          ref={elemento}
          src={urlFinal}
          alt={alt}
          loading={loading}
          aria-busy={usarNativo && !resultado?.url && !resultado?.error ? true : undefined}
          style={{ ...props.style, ...(usarNativo && !resultado?.url ? { visibility: "hidden" } : {}) }}
          onError={(e) => {
            if (usarNativo) {
              if (!sinRespaldo) {
                setCargada({ src: String(src), fallbackWeb: true });
              } else {
                setCargada({ src: String(src), error: "No se pudo mostrar la imagen." });
              }
            } else if (
              !sinRespaldo &&
              typeof src === "string" &&
              !resultado?.fallbackWeb &&
              !src.startsWith("/api/externo/imagen") &&
              !src.startsWith("blob:") &&
              !src.startsWith("data:")
            ) {
              // Respaldo en la web: si la imagen directa del CDN fue bloqueada por hotlinking
              // o política de Referer del navegador, reintenta transparentemente vía /api/externo/imagen.
              setCargada({ src: String(src), fallbackWeb: true });
            } else {
              props.onError?.(e);
            }
          }}
        />
        {sinRespaldo && resultado?.error && (
          <span role="alert" className="relative z-20 block p-2 text-xs text-subtle">
            {resultado.error}{" "}
            <button
              type="button"
              className="underline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCargada(null);
                setIntento((n) => n + 1);
              }}
            >
              Reintentar
            </button>
          </span>
        )}
      </>
    );
  }
);
