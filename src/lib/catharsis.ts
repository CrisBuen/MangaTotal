/**
 * Catharsis World, integrada con su permiso.
 *
 * A diferencia de las otras fuentes externas, esta no se lee desde el
 * dispositivo: todo pasa por nuestro propio servidor, que habla con el
 * almacén de Catharsis en vez de con su web. Por eso funciona igual en el
 * navegador, en Windows y en Android, sin verificación de por medio.
 *
 * Ver src/app/api/externo/catharsis/route.ts, donde está explicado cómo se
 * arma el catálogo.
 */

export const CW_NOMBRE = "Catharsis World";
export const CW_WEB = "https://newcatharsis.dig-it.info";

/** De donde salen las imágenes. Acepta recortes, así que se piden a medida. */
const CW_ASSETS = "https://direct-new-catha.catharsisfood.com/assets";

export interface SerieCw {
  id: string;
  nombre: string;
  portada: string | null;
  capitulos: number;
}

export interface CapituloCw {
  id: string;
  numero: number;
  etiqueta: string;
}

export interface FichaCw {
  id: string;
  nombre: string;
  portada: string | null;
  capitulos: CapituloCw[];
}

export interface PaginaCw {
  numero: number;
  id: string;
  ancho: number;
  alto: number;
}

export type OrdenCw = "nombre" | "novedades" | "capitulos";

/**
 * La dirección de una imagen, al tamaño que se va a ver.
 *
 * Su almacén sabe redimensionar, y eso vale oro en una conexión lenta: una
 * portada entera pesa unos 85 KB y a 320 píxeles baja a 35 KB. Las páginas
 * del lector se piden enteras, que para eso se abrieron.
 */
export function imagenCw(id: string, ancho?: number): string {
  if (!ancho) return `${CW_ASSETS}/${id}`;
  return `${CW_ASSETS}/${id}?width=${ancho}&quality=72&format=webp`;
}

async function pedir<T>(consulta: string, fresco: boolean): Promise<T> {
  const res = await fetch(`/api/externo/catharsis?${consulta}${fresco ? "&fresco=1" : ""}`, {
    ...(fresco ? { cache: "no-store" as const } : {}),
  });

  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new Error(
      (cuerpo as { error?: string } | null)?.error ?? `${CW_NOMBRE} respondió ${res.status}`
    );
  }
  return (await res.json()) as T;
}

/** Una página del catálogo, ya filtrada y ordenada por el servidor. */
export async function catalogoCw(opciones: {
  busqueda?: string;
  pagina?: number;
  orden?: OrdenCw;
  fresco?: boolean;
}): Promise<{ series: SerieCw[]; total: number; paginas: number }> {
  const q = new URLSearchParams({
    accion: "catalogo",
    orden: opciones.orden ?? "nombre",
    pagina: String(opciones.pagina ?? 1),
  });
  if (opciones.busqueda?.trim()) q.set("q", opciones.busqueda.trim());

  return pedir(q.toString(), opciones.fresco === true);
}

/** La ficha de una serie con todos sus capítulos, sin límite. */
export async function serieCw(id: string, fresco = false): Promise<FichaCw> {
  return pedir(`accion=serie&id=${encodeURIComponent(id)}`, fresco);
}

/** Las páginas de un capítulo, en orden y con su tamaño real. */
export async function paginasCw(id: string, fresco = false): Promise<{ paginas: PaginaCw[] }> {
  return pedir(`accion=capitulo&id=${encodeURIComponent(id)}`, fresco);
}
