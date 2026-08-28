import sharp from "sharp";

/**
 * Rehace el orden de las páginas de un capítulo de LeerCapítulo.
 *
 * Su servidor entrega la lista BARAJADA, y con un barajado distinto en cada
 * carga. Su propio lector lo deshace del lado del cliente; acá se hace en el
 * servidor, y así vale igual para la web que para las apps.
 *
 * Cómo se rehace, en tres pasos:
 *
 *   1. El número de página está en el nombre del archivo, en los dos
 *      primeros caracteres, con cero adelante. Está cifrado, pero todas las
 *      páginas de un capítulo comparten el mismo texto en varios tramos de
 *      la ruta, así que comparando esos tramos contra los de la primera sale
 *      la tabla que traduce una a la otra.
 *
 *   2. Esa tabla dice qué letra es qué letra, pero no qué dígito. Eso sale
 *      por descarte: los números tienen que dar exactamente 1..n, cada uno
 *      una vez. Quedan unas pocas asignaciones posibles.
 *
 *   3. Para elegir entre esas pocas se miran las imágenes: las tiras están
 *      cortadas de un dibujo continuo, así que en el orden bueno el borde de
 *      abajo de cada una calza con el de arriba de la siguiente. La
 *      asignación correcta da uniones de ~5 sobre 255; las equivocadas, de
 *      50 para arriba.
 *
 * ESTADO: NO ESTÁ LISTO. Sobre seis capítulos de series distintas, el orden
 * sale estable y correcto en uno solo. Falla porque en muchos capítulos son
 * pocas las páginas a las que se les puede traducir el número completo: solo
 * se recuperan cuatro o cinco cifras de las diez, y con tan pocas anclas las
 * uniones entre tiras no alcanzan para decidir.
 *
 * Por eso LeerCapítulo sigue apagada (LC_HABILITADA en src/lib/leercapitulo.ts).
 * Lo que falta y por dónde seguir está en CAMBIO-DE-DOMINIO-LEERCAPITULO.txt.
 */

/** Cuántas asignaciones de dígitos se prueban antes de rendirse. */
const MAX_CANDIDATOS = 1500;

/** Ancho al que se reducen los bordes para compararlos. */
const COLUMNAS = 48;

/** Una unión por encima de esto no es una continuación real. */
const UNION_ACEPTABLE = 15;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface Bordes {
  ancho: number;
  arriba: Uint8Array;
  abajo: Uint8Array;
}

/** Cada carácter por el orden de su primera aparición: revela la plantilla. */
function firma(texto: string): string {
  const visto = new Map<string, number>();
  return [...texto]
    .map((c) => {
      if (!/[A-Za-z0-9]/.test(c)) return c;
      if (!visto.has(c)) visto.set(c, visto.size);
      return visto.get(c)!.toString(36);
    })
    .join("");
}

/**
 * Los dos caracteres que abren el nombre de archivo de cada página, todos
 * traducidos al alfabeto de la primera. Devuelve null si la estructura de
 * las rutas no es la esperada.
 */
function codigosDePagina(urls: string[]): [string | null, string | null][] | null {
  let rutas: string[][];
  try {
    rutas = urls.map((u) => new URL(u).pathname.split("/").filter(Boolean));
  } catch {
    return null;
  }

  const tramos = rutas[0]?.length ?? 0;
  if (tramos < 2 || rutas.some((r) => r.length !== tramos)) return null;

  // los tramos que comparten plantilla: misma firma y mismo largo en todas
  const comunes: number[] = [];
  for (let s = 0; s < tramos - 1; s++) {
    const firmas = new Set(rutas.map((r) => firma(r[s])));
    const largos = new Set(rutas.map((r) => r[s].length));
    if (firmas.size === 1 && largos.size === 1) comunes.push(s);
  }
  if (comunes.length === 0) return null;

  const ref = rutas[0];
  const ultimo = tramos - 1;

  return rutas.map((ruta) => {
    const tabla = new Map<string, string>();
    for (const s of comunes) {
      for (let k = 0; k < ruta[s].length; k++) {
        const c = ruta[s][k];
        if (!/[A-Za-z0-9]/.test(c)) continue;
        if (tabla.has(c) && tabla.get(c) !== ref[s][k]) return [null, null];
        tabla.set(c, ref[s][k]);
      }
    }
    const nombre = ruta[ultimo];
    return [tabla.get(nombre[0]) ?? null, tabla.get(nombre[1]) ?? null];
  });
}

/**
 * Todas las formas de asignar dígitos a las letras que dejan números
 * válidos, sin repetir y dentro de 1..n. Se devuelven ya sin duplicados:
 * dos asignaciones que producen el mismo orden cuentan como una.
 */
function asignacionesPosibles(
  codigos: [string | null, string | null][],
  n: number
): (number | null)[][] {
  const asignado = new Map<string, number>();

  // Arranque por conteo: en un capítulo de 53 páginas la decena 0 sale 9
  // veces y la 5 solo 4, así que esas dos letras quedan fijas de entrada. Sin
  // esto, en capítulos con muchas letras la asignación buena queda fuera del
  // tope de candidatas que se alcanzan a probar.
  for (const pos of [0, 1] as const) {
    const esperado = new Map<string, number>();
    for (let p = 1; p <= n; p++) {
      const d = String(p).padStart(2, "0")[pos];
      esperado.set(d, (esperado.get(d) ?? 0) + 1);
    }
    const observado = new Map<string, number>();
    for (const c of codigos) {
      const letra = c[pos];
      if (letra) observado.set(letra, (observado.get(letra) ?? 0) + 1);
    }

    for (const [digito, cuantas] of esperado) {
      // solo sirve si ninguna otra cifra aparece esa misma cantidad de veces
      if ([...esperado.values()].filter((v) => v === cuantas).length !== 1) continue;
      const candidatas = [...observado.entries()].filter(([, v]) => v === cuantas);
      if (candidatas.length !== 1) continue;
      const letra = candidatas[0][0];
      const yaAsignado = asignado.get(letra);
      if (yaAsignado !== undefined && yaAsignado !== Number(digito)) return [];
      asignado.set(letra, Number(digito));
    }
  }

  const letras = [...new Set(codigos.flat().filter((c): c is string => c !== null))].filter(
    (l) => !asignado.has(l)
  );
  const ordenes = new Map<string, (number | null)[]>();

  const sigueSiendoPosible = (): boolean => {
    const usados = new Set<number>();
    for (const [d, u] of codigos) {
      const dd = d ? asignado.get(d) : undefined;
      const uu = u ? asignado.get(u) : undefined;
      if (dd === undefined || uu === undefined) continue;
      const numero = dd * 10 + uu;
      if (numero < 1 || numero > n || usados.has(numero)) return false;
      usados.add(numero);
    }
    return true;
  };

  const buscar = (i: number): void => {
    if (ordenes.size > MAX_CANDIDATOS) return;
    if (i === letras.length) {
      const numeros = codigos.map(([d, u]) =>
        d && u ? asignado.get(d)! * 10 + asignado.get(u)! : null
      );
      ordenes.set(numeros.join(","), numeros);
      return;
    }
    for (let d = 0; d <= 9; d++) {
      if ([...asignado.values()].includes(d)) continue;
      asignado.set(letras[i], d);
      if (sigueSiendoPosible()) buscar(i + 1);
      asignado.delete(letras[i]);
    }
  };

  buscar(0);
  return [...ordenes.values()];
}

/** El borde de arriba y el de abajo de una imagen, en escala de grises. */
async function bordesDe(url: string): Promise<Bordes | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://www.leercapitulo.co/" } });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(bytes, { limitInputPixels: false }).metadata();
    if (!meta.width || !meta.height || meta.height < 4) return null;

    const banda = async (desde: number) =>
      new Uint8Array(
        await sharp(bytes, { limitInputPixels: false })
          .extract({ left: 0, top: desde, width: meta.width!, height: 2 })
          .resize({ width: COLUMNAS, height: 1, fit: "fill" })
          .greyscale()
          .raw()
          .toBuffer()
      );

    return { ancho: meta.width, arriba: await banda(0), abajo: await banda(meta.height - 2) };
  } catch {
    return null;
  }
}

/** Cuánto se parece el borde de abajo de una al de arriba de la otra. */
function union(a: Bordes | null, b: Bordes | null): number {
  if (!a || !b) return 80;
  if (a.ancho !== b.ancho) return 60;
  let suma = 0;
  for (let i = 0; i < a.abajo.length; i++) suma += Math.abs(a.abajo[i] - b.arriba[i]);
  return suma / a.abajo.length;
}

/**
 * Qué tan bien encaja un orden propuesto.
 *
 * Solo se miran páginas realmente seguidas —la 3 con la 4, nunca la 3 con la
 * 7— y solo entre tiras del mismo ancho. Entre medio de las tiras suelen
 * venir carteles del grupo, más anchos y más bajos; esos no continúan nada,
 * así que contarlos ensuciaría el puntaje y haría descartar el orden bueno.
 */
function calidad(numeros: (number | null)[], bordes: (Bordes | null)[]): number {
  const donde = new Map<number, number>();
  numeros.forEach((x, i) => {
    if (x !== null) donde.set(x, i);
  });

  let suma = 0;
  let pares = 0;
  for (const [numero, i] of donde) {
    const j = donde.get(numero + 1);
    if (j === undefined) continue;
    const a = bordes[i];
    const b = bordes[j];
    if (!a || !b || a.ancho !== b.ancho) continue;
    suma += union(a, b);
    pares++;
  }
  return pares >= 3 ? suma / pares : Number.POSITIVE_INFINITY;
}

/**
 * Ordena las páginas de un capítulo.
 *
 * Si algo no encaja —cambiaron la estructura de sus rutas, no se pudo bajar
 * una imagen— devuelve la lista tal como vino. Vale más un capítulo en el
 * orden de ellos que un error en la cara.
 */
export async function ordenarPaginas(urls: string[]): Promise<string[]> {
  if (urls.length < 4) return urls;

  const codigos = codigosDePagina(urls);
  if (!codigos) return urls;

  const candidatos = asignacionesPosibles(codigos, urls.length);
  if (candidatos.length === 0) return urls;

  // los bordes de todas las páginas, de a ocho para no ahogar la conexión
  const bordes: (Bordes | null)[] = [];
  for (let i = 0; i < urls.length; i += 8) {
    bordes.push(...(await Promise.all(urls.slice(i, i + 8).map(bordesDe))));
  }

  let mejor: (number | null)[] | null = null;
  let mejorCalidad = Number.POSITIVE_INFINITY;
  for (const c of candidatos) {
    const q = calidad(c, bordes);
    if (q < mejorCalidad) {
      mejorCalidad = q;
      mejor = c;
    }
  }

  // ninguna asignación dio uniones creíbles: no arriesgamos un orden inventado
  if (!mejor || mejorCalidad > UNION_ACEPTABLE) return urls;

  // las páginas cuyo número quedó claro van a su lugar; las que no, se
  // acomodan en los huecos, cada una donde su borde encaje mejor
  const enSuLugar = new Map<number, number>();
  mejor.forEach((numero, i) => {
    if (numero !== null) enSuLugar.set(numero, i);
  });
  const sueltas = mejor.map((numero, i) => (numero === null ? i : -1)).filter((i) => i >= 0);

  const salida: string[] = [];
  let anterior: Bordes | null = null;

  for (let numero = 1; numero <= urls.length; numero++) {
    const puesta = enSuLugar.get(numero);
    if (puesta !== undefined) {
      salida.push(urls[puesta]);
      anterior = bordes[puesta];
      continue;
    }
    if (sueltas.length === 0) continue;

    let elegida = 0;
    let mejorUnion = Number.POSITIVE_INFINITY;
    sueltas.forEach((i, k) => {
      const u = union(anterior, bordes[i]);
      if (u < mejorUnion) {
        mejorUnion = u;
        elegida = k;
      }
    });
    const [i] = sueltas.splice(elegida, 1);
    salida.push(urls[i]);
    anterior = bordes[i];
  }

  // por las dudas: nunca perder una página por el camino
  for (const i of sueltas) salida.push(urls[i]);
  return salida.length === urls.length ? salida : urls;
}
