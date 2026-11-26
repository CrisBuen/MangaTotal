"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { regresoFuente } from "@/lib/fuentesBiblioteca";
import {
  leerEstadoFuente,
  leerUltimoExplorar,
  marcarSiguienteComoReemplazo,
  navegarAtrasInteligente,
  normalizarUrlRelativa,
  obtenerRutaAnteriorInterna,
  type MundoMangaTotal,
} from "@/lib/navegacionEstado";

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
  mundo?: MundoMangaTotal;
};

function calcularDestinoInicial(
  hrefProp: string,
  regreso: string | null,
  mundo: MundoMangaTotal
): string {
  if (regreso) return regreso;
  if (!hrefProp.startsWith("/explorar")) return hrefProp;

  try {
    const uProp = new URL(hrefProp, window.location.origin);
    const fuenteProp =
      mundo === "anime"
        ? uProp.searchParams.get("anime_fuente") || "jkanime"
        : uProp.searchParams.get("fuente") || "mangadex";

    const guardadoFuente = leerEstadoFuente(mundo, fuenteProp);
    if (guardadoFuente) return guardadoFuente;

    const ultimo = leerUltimoExplorar(mundo);
    if (ultimo && ultimo.startsWith("/explorar")) {
      const uUlt = new URL(ultimo, window.location.origin);
      const fuenteUlt =
        mundo === "anime"
          ? uUlt.searchParams.get("anime_fuente") || "jkanime"
          : uUlt.searchParams.get("fuente") || "mangadex";
      if (fuenteProp === fuenteUlt) return ultimo;
    }
  } catch {}
  return hrefProp;
}

function Enlace({ href, className, children, mundo = "lectura" }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const bibFuente = params.get("bibliotecaFuente");
  const regreso = regresoFuente(bibFuente);
  // Calculamos el estado inicial idéntico al SSR y resolvemos sessionStorage tras hidratar.
  const [destino, setDestino] = useState(() => regreso ?? href);

  useEffect(() => {
    setDestino(calcularDestinoInicial(href, regreso, mundo));
  }, [href, regreso, mundo]);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();

    if (regreso) {
      const anterior = obtenerRutaAnteriorInterna();
      if (anterior && normalizarUrlRelativa(anterior) === normalizarUrlRelativa(regreso)) {
        window.history.back();
        return;
      }
      marcarSiguienteComoReemplazo();
      router.replace(regreso);
      return;
    }

    navegarAtrasInteligente(router, destino, { evitarLector: true });
  };

  return (
    <Link href={destino} prefetch={false} className={className} onClick={handleClick}>
      {regreso ? "← Series de esta fuente" : children}
    </Link>
  );
}

/** Solo altera el regreso cuando la ficha se abrió desde Más → Fuentes. */
export function VolverFuente(props: Props) {
  return (
    <Suspense fallback={<Link href={props.href} prefetch={false} className={props.className}>{props.children}</Link>}>
      <Enlace {...props} />
    </Suspense>
  );
}
