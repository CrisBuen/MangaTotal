"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ImgHTMLAttributes } from "react";
import { cargarImagenNativa, esImagenIkigai } from "@/lib/imagenFuenteNativa";

/** Solo cambia el transporte de Ikigai; conserva medidas y eventos del img. */
export const ImagenFuente = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(
  function ImagenFuente({ src, loading, alt, ...props }, forwardedRef) {
    const elemento = useRef<HTMLImageElement>(null);
    useImperativeHandle(forwardedRef, () => elemento.current!);
    const nativa = typeof src === "string" && esImagenIkigai(src);
    const [cargada, setCargada] = useState<{ src: string; url?: string; error?: string } | null>(null);
    const [intento, setIntento] = useState(0);
    useEffect(() => {
      if (!nativa || typeof src !== "string") return;
      let cancelado = false;
      let objeto: string | undefined;
      let observador: IntersectionObserver | undefined;
      const cargar = async () => {
        try {
          const blob = await cargarImagenNativa(src);
          if (cancelado) return;
          objeto = URL.createObjectURL(blob);
          setCargada({ src, url: objeto });
        } catch (error) {
          if (!cancelado) setCargada({ src, error: error instanceof Error ? error.message : "No se pudo cargar la imagen" });
        }
      };
      if (loading === "lazy" && typeof IntersectionObserver !== "undefined" && elemento.current) {
        observador = new IntersectionObserver((entradas) => {
          if (entradas.some((e) => e.isIntersecting)) { observador?.disconnect(); void cargar(); }
        }, { rootMargin: "1200px" });
        observador.observe(elemento.current);
      } else { void cargar(); }
      return () => { cancelado = true; observador?.disconnect(); if (objeto) URL.revokeObjectURL(objeto); };
    }, [src, nativa, loading, intento]);
    const resultado = cargada?.src === src ? cargada : null;
    return <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...props} ref={elemento} src={nativa ? resultado?.url : src} alt={alt} loading={loading}
        onError={nativa ? () => setCargada({ src: String(src), error: "No se pudo mostrar la imagen de Ikigai." }) : props.onError} />
      {nativa && resultado?.error && <span role="alert" className="relative z-20 block p-2 text-xs text-subtle">
        {resultado.error} <button type="button" className="underline" onClick={(e) => {
          e.preventDefault(); e.stopPropagation(); setCargada(null); setIntento((n) => n + 1);
        }}>Reintentar</button>
      </span>}
    </>;
  }
);
