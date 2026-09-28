"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { ImagenFuente } from "./ImagenFuente";

const recuperadas = new Map<string, Promise<string | null>>();
let activas = 0;
const esperando: (() => void)[] = [];

/** Solo consulta metadatos públicos: jamás reimporta ni modifica la biblioteca. */
async function recuperar(id: string): Promise<string | null> {
  const anterior = recuperadas.get(id);
  if (anterior) return anterior;
  const trabajo = (async () => {
    // Una biblioteca grande no debe disparar cientos de fichas simultáneas.
    if (activas >= 3) await new Promise<void>(resolve => esperando.push(resolve));
    else activas++;
    try {
      const [codigo, slug, extra] = id.split("/");
      if (!codigo || !slug || extra) return null;
      const { serieLc } = await import("@/lib/leercapitulo");
      return (await serieLc(codigo, slug)).cover_url;
    } catch { return null; }
    finally {
      const siguiente = esperando.shift();
      if (siguiente) siguiente(); else activas--;
    }
  })();
  recuperadas.set(id, trabajo);
  if (recuperadas.size > 256) recuperadas.delete(recuperadas.keys().next().value!);
  return trabajo;
}

type Props = ImgHTMLAttributes<HTMLImageElement> & { source: string; externalId: string };

export function PortadaExterna(props: Props) {
  // Evita que una respuesta tardía pinte la portada de otra tarjeta reutilizada.
  return <Portada key={`${props.source}:${props.externalId}:${props.src}`} {...props} />;
}

function Portada({ source, externalId, src, onError, ...props }: Props) {
  const [fallo, setFallo] = useState(false);
  const [actual, setActual] = useState<string | null>(null);
  const elemento = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!fallo || source !== "leercapitulo") return;
    let cancelado = false;
    const cargar = () => void recuperar(externalId).then(url => { if (!cancelado) setActual(url); });
    // También las portadas rotas fuera de pantalla esperan hasta ser visibles.
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { observer?.disconnect(); cargar(); }
    }, { rootMargin: "200px" }) : null;
    if (observer && elemento.current) observer.observe(elemento.current); else cargar();
    return () => { cancelado = true; observer?.disconnect(); };
  }, [fallo, source, externalId]);
  return <ImagenFuente {...props} ref={elemento} src={actual || src} onError={e => {
    setFallo(true); onError?.(e);
  }} />;
}
