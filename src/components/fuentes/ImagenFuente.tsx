"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ImgHTMLAttributes } from "react";
import { cargarImagenNativa, debeUsarPuenteNativo, esImagenIkigai } from "@/lib/imagenFuenteNativa";

/** Prioriza el puente nativo en Android y PC para no pasar por Vercel; conserva medidas y eventos del img. */
export const ImagenFuente = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(
  function ImagenFuente({ src, loading, alt, ...props }, forwardedRef) {
    const elemento = useRef<HTMLImageElement>(null);
    useImperativeHandle(forwardedRef, () => elemento.current!);
    const esIkigai = typeof src === "string" && esImagenIkigai(src);
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
      (esIkigai || debeUsarPuenteNativo(src));

    useEffect(() => {
      if (!usarNativo || typeof src !== "string") return;
      let cancelado = false;
      const controlador = new AbortController();
      let objeto: string | undefined;
      let observador: IntersectionObserver | undefined;
      const cargar = async () => {
        try {
          const blob = await cargarImagenNativa(src, {
            signal: controlador.signal,
            prioridad: loading === "lazy" ? 0 : 1,
          });
          if (cancelado) return;
          objeto = URL.createObjectURL(blob);
          setCargada({ src, url: objeto });
        } catch (error) {
          if (cancelado) return;
          if (!esIkigai) {
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
      if (loading === "lazy" && typeof IntersectionObserver !== "undefined" && elemento.current) {
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
    }, [src, usarNativo, esIkigai, loading, intento]);

    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          {...props}
          ref={elemento}
          src={usarNativo ? resultado?.url : src}
          alt={alt}
          loading={loading}
          aria-busy={usarNativo && !resultado?.url && !resultado?.error ? true : undefined}
          style={{ ...props.style, ...(usarNativo && !resultado?.url ? { visibility: "hidden" } : {}) }}
          onError={
            usarNativo
              ? () => {
                  if (!esIkigai) {
                    setCargada({ src: String(src), fallbackWeb: true });
                  } else {
                    setCargada({ src: String(src), error: "No se pudo mostrar la imagen de Ikigai." });
                  }
                }
              : props.onError
          }
        />
        {esIkigai && resultado?.error && (
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
