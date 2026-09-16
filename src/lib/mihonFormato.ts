/**
 * Subconjunto de Backup*.kt oficial de Mihon (gzip + protobuf).
 * No se decodifican preferencias, tokens, notas ni datos de seguimiento.
 * Los IDs Long se conservan como texto: Number redondea los de Ikigai.
 */
export const MAX_RESPALDO = 20 * 1024 * 1024;
export const MAX_DESCOMPRIMIDO = 64 * 1024 * 1024;
export interface CapituloMihon {
  url: string; name: string; read: boolean; page: number; number: number; modified: number;
}
export interface MangaMihon {
  source: string; url: string; title: string; cover: string; favorite: boolean;
  chapters: CapituloMihon[]; history: { url: string; at: number }[];
}
export interface RespaldoMihon { mangas: MangaMihon[]; sources: Map<string, string> }
const utf8 = new TextDecoder("utf-8", { fatal: true });
class Proto {
  pos = 0;
  constructor(readonly bytes: Uint8Array) {}
  varint(): bigint {
    let n = 0n;
    for (let i = 0; i < 10; i++) {
      if (this.pos >= this.bytes.length) throw new Error("Respaldo truncado");
      const b = this.bytes[this.pos++];
      if (i === 9 && b > 1) throw new Error("Entero protobuf inválido");
      n |= BigInt(b & 127) << BigInt(i * 7);
      if (b < 128) return n;
    }
    throw new Error("Entero protobuf inválido");
  }
  bloque(n: number): Uint8Array {
    if (!Number.isSafeInteger(n) || n < 0 || this.pos + n > this.bytes.length) throw new Error("Respaldo truncado");
    const v = this.bytes.subarray(this.pos, this.pos + n); this.pos += n; return v;
  }
  campos(fn: (id: number, value: bigint | Uint8Array, wire: number) => void) {
    while (this.pos < this.bytes.length) {
      const tag = this.varint();
      if (tag > 0xffffffffn || tag < 8n) throw new Error("Campo protobuf inválido");
      const id = Number(tag >> 3n), wire = Number(tag & 7n);
      if (wire === 0) fn(id, this.varint(), wire);
      else if (wire === 2) fn(id, this.bloque(Number(this.varint())), wire);
      else if (wire === 1 || wire === 5) fn(id, this.bloque(wire === 1 ? 8 : 4), wire);
      else throw new Error("Formato protobuf no compatible");
    }
  }
}
function texto(v: bigint | Uint8Array, max = 4096): string {
  if (!(v instanceof Uint8Array) || v.length > max * 4) throw new Error("Texto inválido en el respaldo");
  const s = utf8.decode(v);
  if (s.length > max) throw new Error("Texto demasiado largo en el respaldo");
  return s;
}
function entero(v: bigint | Uint8Array): number {
  if (typeof v !== "bigint" || v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Número inválido en el respaldo");
  return Number(v);
}
function mensaje(v: bigint | Uint8Array): Proto {
  if (!(v instanceof Uint8Array)) throw new Error("Mensaje protobuf inválido");
  return new Proto(v);
}
export function decodificarMihon(bytes: Uint8Array): RespaldoMihon {
  if (!bytes.length || bytes.length > MAX_DESCOMPRIMIDO) throw new Error("Tamaño de respaldo no permitido");
  const sources = new Map<string, string>(), mangas: MangaMihon[] = [];
  let registros = 0;
  mensaje(bytes).campos((id, v, wire) => {
    if ((id === 1 || id === 101) && wire !== 2) throw new Error("Formato de respaldo inválido");
    if (id === 101) {
      let name = "", source = "";
      mensaje(v).campos((k, x) => {
        if (k === 1) name = texto(x, 200);
        if (k === 2 && typeof x === "bigint") source = x.toString();
      });
      if (source && name) sources.set(source, name);
      if (sources.size > 5000) throw new Error("Demasiadas fuentes");
    }
    if (id !== 1) return;
    if (mangas.length >= 15000) throw new Error("Demasiadas series en el respaldo");
    const m: MangaMihon = { source: "", url: "", title: "", cover: "", favorite: true, chapters: [], history: [] };
    mensaje(v).campos((k, x) => {
      if (k === 1 && typeof x === "bigint") m.source = x.toString();
      if (k === 2) m.url = texto(x);
      if (k === 3) m.title = texto(x, 500);
      if (k === 9) m.cover = texto(x);
      if (k === 100) m.favorite = entero(x) !== 0;
      if (k === 16) {
        if (++registros > 500000) throw new Error("Demasiados capítulos o registros de historial");
        const c: CapituloMihon = { url: "", name: "", read: false, page: 0, number: -1, modified: 0 };
        mensaje(x).campos((n, y, w) => {
          if (n === 1) c.url = texto(y);
          if (n === 2) c.name = texto(y, 500);
          if (n === 4) c.read = entero(y) !== 0;
          if (n === 6) c.page = entero(y);
          if (n === 9 && w === 5 && y instanceof Uint8Array) c.number = new DataView(y.buffer, y.byteOffset, 4).getFloat32(0, true);
          if (n === 11) c.modified = entero(y);
        });
        m.chapters.push(c);
      }
      if (k === 104) {
        if (++registros > 500000) throw new Error("Demasiados capítulos o registros de historial");
        const h = { url: "", at: 0 };
        mensaje(x).campos((n, y) => { if (n === 1) h.url = texto(y); if (n === 2) h.at = entero(y); });
        m.history.push(h);
      }
    });
    if (!m.source || !m.url) throw new Error("Falta el identificador de una serie");
    mangas.push(m);
  });
  if (!mangas.length) throw new Error("El archivo no contiene una biblioteca de Mihon");
  return { mangas, sources };
}
export async function leerMihon(archivo: Blob): Promise<RespaldoMihon> {
  if (!archivo.size || archivo.size > MAX_RESPALDO) throw new Error("El respaldo debe pesar menos de 20 MB");
  const cabecera = new Uint8Array(await archivo.slice(0, 2).arrayBuffer());
  if (cabecera[0] !== 31 || cabecera[1] !== 139) throw new Error("Se necesita un respaldo .tachibk o .proto.gz de Mihon");
  if (typeof DecompressionStream === "undefined") throw new Error("Actualizá el navegador o Android System WebView para importar");
  const reader = archivo.stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const trozos: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_DESCOMPRIMIDO) throw new Error("El respaldo expandido supera el límite de 64 MB");
      trozos.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let pos = 0;
  for (const trozo of trozos) { bytes.set(trozo, pos); pos += trozo.length; }
  return decodificarMihon(bytes);
}
