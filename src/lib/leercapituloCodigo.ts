/**
 * El código con que LeerCapítulo esconde las páginas de un capítulo.
 *
 * Son dos capas distintas y conviene no confundirlas:
 *
 *   1. La lista de páginas viaja en base64 con un alfabeto propio de ellos
 *      (ALFABETO). Eso lo resuelve `decodificar`.
 *   2. Cada dirección que sale de ahí viene, además, con la ruta cifrada, y
 *      la lista llega BARAJADA en un orden distinto en cada carga. El orden
 *      correcto viaja escondido en el contenido de uno de los <meta>.
 *
 * Este archivo no depende del navegador ni del servidor: lo usan los dos.
 */

/**
 * Su alfabeto de base64, en orden de valor (0 a 63).
 *
 * No es el estándar: tienen el suyo desde hace años y ya nadie del equipo
 * sabe cuál era, así que se reconstruyó comparando un capítulo con las
 * direcciones que su propia página termina cargando. Tres valores (59, 62 y
 * 63) nunca aparecieron en las pruebas y quedan como hueco: si algún día
 * salen, la función avisa en vez de devolver una imagen rota.
 */
export const ALFABETO = "3EHLxNd2bWq8hIl65CKGv4wY9gaZRTVMoPm1znAeDscpSBkr0FOXJyf7uij tU  ";

const VALOR_DE = new Map<string, number>();
for (let v = 0; v < ALFABETO.length; v++) {
  if (ALFABETO[v] !== " ") VALOR_DE.set(ALFABETO[v], v);
}

/** base64 con el alfabeto de ellos. */
export function decodificar(texto: string): string {
  const limpio = texto.replace(/\s+/g, "").replace(/=+$/, "");
  let bits = "";
  for (const c of limpio) {
    const v = VALOR_DE.get(c);
    if (v === undefined) {
      throw new Error(
        "LeerCapítulo cambió la forma de codificar sus páginas. Hay que revisar el alfabeto en src/lib/leercapituloCodigo.ts."
      );
    }
    bits += v.toString(2).padStart(6, "0");
  }

  let salida = "";
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    salida += String.fromCharCode(parseInt(bits.slice(i, i + 8), 2));
  }
  return salida;
}

function atributo(etiqueta: string, nombre: string): string | null {
  const encontrado = etiqueta.match(
    new RegExp(`\\b${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
  );
  return encontrado ? (encontrado[1] ?? encontrado[2] ?? encontrado[3]) : null;
}

function indicesDelMeta(contenido: string): number[] | null {
  const partes = contenido
    .replace(/[^0-9]+/g, "-")
    .split("")
    .reverse()
    .join("")
    .split("-");

  if (partes.some((parte) => !/^\d+$/.test(parte))) return null;
  return partes.map(Number);
}

function esPermutacionCompleta(indices: number[], cantidad: number): boolean {
  if (indices.length !== cantidad) return false;

  const vistos = new Set<number>();
  for (const indice of indices) {
    if (!Number.isInteger(indice) || indice < 0 || indice >= cantidad || vistos.has(indice)) {
      return false;
    }
    vistos.add(indice);
  }
  return vistos.size === cantidad;
}

/**
 * Saca y ordena las páginas desde una sola respuesta del capítulo.
 *
 * La clave del orden y las URLs cambian juntas en cada pedido. Volver a pedir
 * el capítulo para buscar la clave mezcla dos barajados distintos y produce
 * un resultado que parece válido, pero se lee desordenado.
 */
export function paginasDelHtml(html: string): string[] {
  const crudo = html.match(/id="array_data"[^>]*>([\s\S]*?)<\/p>/)?.[1]?.trim();
  if (!crudo) return [];

  const paginas = decodificar(crudo)
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http"));

  if (paginas.length === 0) return [];

  for (const meta of html.matchAll(/<meta\b[^>]*>/gi)) {
    const contenido = atributo(meta[0], "content");
    if (!contenido) continue;

    const indices = indicesDelMeta(contenido);
    if (indices && esPermutacionCompleta(indices, paginas.length)) {
      return indices.map((indice) => paginas[indice]);
    }
  }

  throw new Error(
    "LeerCapítulo cambió la forma de ordenar sus páginas; revisar CAMBIO-DE-DOMINIO-LEERCAPITULO.txt."
  );
}
