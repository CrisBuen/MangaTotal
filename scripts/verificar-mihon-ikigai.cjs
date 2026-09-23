// node --test scripts/verificar-mihon-ikigai.cjs
// MIHON_BACKUP permite probar un respaldo local sin copiarlo ni imprimir su contenido.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const ts = require("typescript"), { gzipSync } = require("node:zlib");
const root = path.resolve(__dirname, "..");
function cargar(file, mocks = {}, globals = {}, cache = new Map()) {
  const p = path.resolve(root, file);
  if (cache.has(p)) return cache.get(p);
  const exports = {}; cache.set(p, exports);
  const requireLocal = (n) => {
    if (Object.hasOwn(mocks, n)) return mocks[n];
    if (n.startsWith(".") || n.startsWith("@/")) {
      const resolved = n.startsWith("@/") ? path.resolve(root, "src", n.slice(2)) : path.resolve(path.dirname(p), n);
      return cargar(resolved + ".ts", mocks, globals, cache);
    }
    return require(n);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(p, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: requireLocal, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer, DataView,
    Blob, URL, DecompressionStream, atob, setTimeout, clearTimeout, ...globals });
  return exports;
}
const fmt = cargar("src/lib/mihonFormato.ts"), imp = cargar("src/lib/mihonImportacion.ts");
const varint = (v) => { let n = BigInt(v), a = []; do { let b = Number(n & 127n); n >>= 7n; a.push(b | (n ? 128 : 0)); } while (n); return Buffer.from(a); };
const int = (k, n) => Buffer.concat([varint(k * 8), varint(n)]);
const bin = (k, b) => Buffer.concat([varint(k * 8 + 2), varint(b.length), b]);
const str = (k, s) => bin(k, Buffer.from(s));
const float = (k, n) => { const b = Buffer.alloc(4); b.writeFloatLE(n); return Buffer.concat([varint(k * 8 + 5), b]); };
const cat = (...args) => Buffer.concat(args);
const sourceId = 9223372036854775806n, chapterId = "1210219148704710659";
function manga({ url = "/series/obra#123", favorite = true, page = 4, title = "Obra", history = true } = {}) {
  const ch = cat(str(1, "/capitulo/" + chapterId + "/"), str(2, "Capítulo 2"), int(4, 0), int(6, page), float(9, 2));
  return cat(int(1, sourceId), str(2, url), str(3, title), int(100, favorite ? 1 : 0), bin(16, ch),
    history ? bin(104, cat(str(1, "/capitulo/" + chapterId + "/"), int(2, 1700000000000n))) : Buffer.alloc(0));
}
const respaldo = (...mangas) => cat(...mangas.map((m) => bin(1, m)), bin(101, cat(str(1, "Ikigai Mangas"), int(2, sourceId))));
test("protobuf conserva Long, historial y página cero -> página uno", () => {
  const b = fmt.decodificarMihon(new Uint8Array(respaldo(manga())));
  assert.equal(b.mangas[0].source, sourceId.toString());
  const r = imp.prepararMihon(b);
  assert.equal(r.entradas[0].lastChapterId, chapterId);
  assert.equal(r.entradas[0].lastPageNumber, 5);
  assert.equal(r.entradas[0].lastChapterName, "2");
  assert.ok(imp.validarEntradaMihon(r.entradas[0]));
});
test("no importa historial sin favorito ni duplica rutas equivalentes", () => {
  const r = imp.prepararMihon(fmt.decodificarMihon(new Uint8Array(respaldo(
    manga(), manga({ url: "obra" }), manga({ favorite: false, url: "otra" })
  ))));
  assert.equal(r.entradas.length, 1); assert.equal(r.soloHistorial, 1); assert.equal(r.fuentes[0].duplicadas, 1);
});
test("omite preferencias privadas y campos futuros sin retenerlos", () => {
  const bytes = cat(respaldo(manga()), bin(104, Buffer.from("credencial-ficticia")), bin(105, Buffer.from("privado-ficticio")));
  assert.ok(!JSON.stringify(fmt.decodificarMihon(new Uint8Array(bytes))).includes("ficticio"));
});
test("gzip real y rechazo de archivos truncados o de otro formato", async () => {
  const b = await fmt.leerMihon(new Blob([gzipSync(respaldo(manga({ page: 0 })))]));
  assert.equal(imp.prepararMihon(b).entradas[0].lastPageNumber, 1);
  await assert.rejects(fmt.leerMihon(new Blob(["no es gzip"])), /respaldo/);
  for (const invalid of [Buffer.from([10, 255]), Buffer.from([0]), Buffer.from([15]), Buffer.from([128,128,128,128,128,128,128,128,128,128,1])]) {
    assert.throws(() => fmt.decodificarMihon(new Uint8Array(invalid)));
  }
});
test("rechaza bomba gzip por tamaño expandido", async () => {
  await assert.rejects(fmt.leerMihon(new Blob([gzipSync(Buffer.alloc(65 * 1024 * 1024))])), /64 MB/);
});
test("identificadores exactos y fuentes no reconocidas no se adivinan", () => {
  assert.equal(imp.idSerieMihon("olympus", "1429"), "1429");
  assert.equal(imp.idSerieMihon("leercapitulo", "/manga/abc/obra/"), "abc/obra");
  assert.equal(imp.idSerieMihon("leercapitulo", "/manga/obra/"), null);
  assert.equal(imp.fuenteMihon("Fuente parecida a Ikigai"), null);
  assert.equal(imp.portadaMihon("https://127.0.0.1/a.webp"), null);
  assert.equal(imp.portadaMihon("https://image2.ikigaimangas.cloud.evil.example/a.webp"), null);
});
const entrada = () => imp.prepararMihon(fmt.decodificarMihon(new Uint8Array(respaldo(manga())))).entradas[0];
test("validación de servidor rechaza rutas, páginas, títulos y portadas peligrosas", () => {
  for (const cambio of [
    { source: "desconocida" }, { externalId: "../admin" }, { externalId: "obra?admin=1" },
    { coverUrl: "javascript:alert(1)" }, { lastPageNumber: -1 }, { lastPageNumber: 1.5 },
    { title: "a".repeat(501) }, { lastChapterId: null }, { lastChapterId: "1?x=y" },
  ]) assert.equal(imp.validarEntradaMihon({ ...entrada(), ...cambio }), false);
});
function apiSimulada({ sesion = { id: 7 }, indice = [], existentes = [] } = {}) {
  const filas = [], llamadas = [];
  const tx = { externalSeries: {
    createMany: async ({ data, skipDuplicates }) => {
      assert.equal(skipDuplicates, true); llamadas.push(data);
      let count = 0;
      for (const e of data) {
        if (!filas.some((f) => f.userId === e.userId && f.source === e.source && f.externalId === e.externalId)) { filas.push({ ...e }); count++; }
      }
      return { count };
    },
    updateMany: async ({ where }) => { assert.equal(where.userId, 7); return { count: 0 }; },
  } };
  const api = cargar("src/app/api/externo/importar-mihon/route.ts", {
    "@/lib/auth": { getSessionUser: async () => sesion },
    "@/lib/db": { db: { $transaction: async (cb) => cb(tx), externalSeries: {
      findMany: async ({ where }) => { assert.equal(where.userId, 7); return existentes; },
    } } },
    "@/lib/olympus": { listaCompleta: async () => indice },
  });
  const req = (body, origin = "https://mangatotal.test") => new (require("next/server").NextRequest)("https://mangatotal.test/api/externo/importar-mihon", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  return { api, req, filas, llamadas };
}
test("API exige sesión y mismo origen", async () => {
  const a = apiSimulada({ sesion: null });
  assert.equal((await a.api.POST(a.req({ entradas: [entrada()] }))).status, 401);
  const b = apiSimulada();
  assert.equal((await b.api.POST(b.req({ entradas: [entrada()] }, "https://otro.test"))).status, 403);
  assert.equal(b.llamadas.length, 0);
});
test("reintentar importación no duplica ni sobrescribe progreso existente", async () => {
  const a = apiSimulada();
  const datos = { entradas: [{ ...entrada(), userId: 999 }] };
  assert.equal((await (await a.api.POST(a.req(datos))).json()).creadas, 1);
  a.filas[0].lastPageNumber = 88;
  assert.equal((await (await a.api.POST(a.req(datos))).json()).conservadas, 1);
  assert.equal(a.filas.length, 1); assert.equal(a.filas[0].userId, 7); assert.equal(a.filas[0].lastPageNumber, 88);
});
test("Olympus se resuelve por ID y los IDs ausentes se omiten", async () => {
  const a = apiSimulada({ indice: [{ id: 1429, slug: "obra-vigente", type: "comic", cover: null }] });
  const e = { ...entrada(), source: "olympus", externalId: "1429", lastChapterId: "100" };
  const r = await (await a.api.POST(a.req({ entradas: [e, { ...e, externalId: "99" }] }))).json();
  assert.equal(r.creadas, 1); assert.equal(r.omitidas.length, 1); assert.equal(a.filas[0].externalId, "obra-vigente");
});
test("API rechaza lotes grandes y datos inválidos sin tocar la base", async () => {
  const a = apiSimulada();
  for (const entradas of [[], Array(26).fill(entrada()), [{ ...entrada(), lastPageNumber: -1 }]]) {
    assert.equal((await a.api.POST(a.req({ entradas }))).status, 400);
  }
  assert.equal((await a.api.POST(a.req({ extra: "x".repeat(130 * 1024), entradas: [entrada()] }))).status, 400);
  assert.equal(a.llamadas.length, 0);
});
test("Olympus conserva identidad antigua para no duplicar la biblioteca", async () => {
  const antes = "obra-20260801-123456789", ahora = "obra-20260916-123456789";
  const a = apiSimulada({
    indice: [{ id: 1429, slug: ahora, type: "comic", cover: null }],
    existentes: [{ externalId: antes, slug: antes, type: "comic" }],
  });
  a.filas.push({ userId: 7, source: "olympus", externalId: antes, lastPageNumber: 33 });
  const e = { ...entrada(), source: "olympus", externalId: "1429", lastChapterId: "100" };
  const r = await (await a.api.POST(a.req({ entradas: [e] }))).json();
  assert.equal(r.creadas, 0); assert.equal(r.conservadas, 1);
  assert.equal(a.filas.length, 1); assert.equal(a.filas[0].lastPageNumber, 33);
});
const imagen = "https://image3.ikigaimangas.cloud/series/1/2/0.webp";
const webp = Buffer.from("RIFF0000WEBPcontenido");
test("imágenes viajan por puente Android, deduplicadas y máximo tres a la vez", async () => {
  let llamadas = 0, activas = 0, max = 0;
  const native = cargar("src/lib/imagenFuenteNativa.ts", {}, { window: { Capacitor: { Plugins: { Fuentes: {
    traerImagen: async () => {
      llamadas++; activas++; max = Math.max(max, activas);
      await new Promise((r) => setTimeout(r, 5)); activas--;
      return { data: webp.toString("base64") };
    },
  } } } }, fetch: () => assert.fail("No debe existir proxy web") });
  const p = native.cargarImagenNativa(imagen);
  assert.equal(native.cargarImagenNativa(imagen), p);
  const otros = Array.from({ length: 7 }, (_, i) => native.cargarImagenNativa(imagen.replace("0.webp", (i + 1) + ".webp")));
  await Promise.all([p, ...otros]); assert.equal(llamadas, 8); assert.equal(max, 3);
});
test("puente Windows recibe binario; placeholder, URL ajena y navegador se rechazan", async () => {
  const native = cargar("src/lib/imagenFuenteNativa.ts", {}, { window: { __TAURI__: { core: { invoke: async (cmd) => {
    assert.equal(cmd, "traer_imagen"); return [...webp];
  } } } } });
  assert.equal((await native.cargarImagenNativa(imagen)).type, "image/webp");
  // Caso real: capítulo 38 de Soy la hija del heredero loco, URL .webp y JPEG.
  const jpeg = cargar("src/lib/imagenFuenteNativa.ts", {}, { window: { __TAURI__: { core: {
    invoke: async () => [255,216,255,224,0,16,74,70,73,70,0,1,1,0],
  } } } });
  assert.equal((await jpeg.cargarImagenNativa(imagen)).type, "image/jpeg");
  for (const url of ["https://127.0.0.1/0.webp", imagen + "?url=x", imagen.replace(".cloud", ".cloud.evil.test")]) {
    assert.equal(native.esImagenIkigai(url), false);
  }
  const warning = cargar("src/lib/imagenFuenteNativa.ts", {}, { window: { __TAURI__: { core: { invoke: async () => [137,80,78,71,13,10] } } } });
  await assert.rejects(warning.cargarImagenNativa(imagen), /original/);
  const web = cargar("src/lib/imagenFuenteNativa.ts", {}, { window: {} });
  await assert.rejects(web.cargarImagenNativa(imagen), /requiere la app/);
});
test("el respaldo real se comprueba localmente sin publicar títulos ni preferencias", { skip: !process.env.MIHON_BACKUP }, async () => {
  const b = await fmt.leerMihon(new Blob([fs.readFileSync(process.env.MIHON_BACKUP)]));
  const r = imp.prepararMihon(b);
  assert.ok(r.entradas.length > 0);
  assert.ok(r.entradas.every(imp.validarEntradaMihon));
  console.log("Respaldo privado comprobado:", r.entradas.length, "series compatibles;", r.conProgreso, "con punto de lectura.");
});
