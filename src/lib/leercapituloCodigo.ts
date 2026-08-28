/**
 * El código con que LeerCapítulo esconde las páginas de un capítulo.
 *
 * Son dos capas distintas y conviene no confundirlas:
 *
 *   1. La lista de páginas viaja en base64 con un alfabeto propio de ellos
 *      (ALFABETO). Eso lo resuelve `decodificar`.
 *   2. Cada dirección que sale de ahí viene, además, con la ruta cifrada, y
 *      la lista llega BARAJADA en un orden distinto en cada carga. De eso se
 *      ocupa src/lib/leercapituloOrden.ts.
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

/** Las direcciones de las páginas tal como vienen: sin ordenar. */
export function paginasDelHtml(html: string): string[] {
  const crudo = html.match(/id="array_data"[^>]*>([\s\S]*?)<\/p>/)?.[1]?.trim();
  if (!crudo) return [];
  return decodificar(crudo)
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http"));
}
