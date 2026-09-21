// node --test scripts/verificar-biblioteca.cjs
// Datos artificiales: no inicia sesión ni escribe en cuentas reales.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
function modulo(nombre, extras = {}) {
  const exports = {};
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib", nombre + ".ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(codigo, { exports, require: n => {
    if (n === "./colaBiblioteca") return cola;
    if (n === "./appVersion") return { isPlayStoreApp: () => false };
    throw Error("Importación no esperada: " + n);
  }, AbortController, setTimeout, clearTimeout, ...extras });
  return exports;
}
const cola = modulo("colaBiblioteca"), opciones = modulo("opcionesBiblioteca");
const tarea = id => ({ source: "mangadex", external_id: id, slug: null, type: null, last_chapter_name: "1" });
const resultado = ultimo => ({ ultimo, sinLeer: 2, comprobado: 100, obtenido: 100 });
const pausa = () => new Promise(r => setTimeout(r, 5));
test("referencias válidas, deduplicación y rechazo de rutas peligrosas", () => {
  assert.equal(cola.trabajoNuevo("lectura", [tarea("uno"), tarea("uno"), tarea("../secret"), tarea("x?token=1")]).tareas.length, 1);
  assert.equal(cola.tareaValida({ ...tarea("x"), source: "intranet" }), false);
});
test("rechaza cola corrupta, vencida y resultados no numéricos", () => {
  const j = cola.trabajoNuevo("lectura", [tarea("a")]);
  assert.ok(cola.leerTrabajo(JSON.stringify(j)));
  for (const cambio of [{ actualizado: 1 }, { resultados: "texto" }, { tareas: [tarea("x#x")] },
    { resultados: { x: { ...resultado("3"), numeros: ["error"] } } }]) {
    assert.equal(cola.leerTrabajo(JSON.stringify({ ...j, ...cambio })), null);
  }
  assert.equal(cola.leerTrabajo("null"), null);
});
test("concurrencia acotada y guardado por cada serie", async () => {
  let j = cola.trabajoNuevo("lectura", Array.from({ length: 8 }, (_, i) => tarea(String(i))));
  let simultaneas = 0, maximo = 0, guardados = 0;
  await cola.ejecutarCola(() => j, x => { j = x; guardados++; }, async () => {
    maximo = Math.max(maximo, ++simultaneas); await pausa(); simultaneas--; return resultado("3");
  }, new AbortController().signal);
  assert.equal(maximo, 2); assert.equal(j.hechas.length, 8); assert.equal(guardados, 9); assert.equal(j.estado, "terminado");
});
test("pausa y reanudación no vuelven a consultar las terminadas", async () => {
  let j = cola.trabajoNuevo("lectura", ["a", "b", "c", "d"].map(tarea));
  const vistas = [];
  await cola.ejecutarCola(() => j, x => { j = x; if (x.hechas.length === 2) j.estado = "pausado"; },
    async t => { vistas.push(t.external_id); return resultado("3"); }, new AbortController().signal);
  assert.equal(j.hechas.length, 2);
  j = cola.leerTrabajo(JSON.stringify(j)); j.estado = "activo";
  await cola.ejecutarCola(() => j, x => { j = x; }, async t => { vistas.push(t.external_id); return resultado("3"); }, new AbortController().signal);
  assert.equal(j.hechas.length, 4); assert.equal(new Set(vistas).size, 4); assert.equal(vistas.length, 4);
});
test("cerrar durante una consulta no marca como completado lo pendiente", async () => {
  let j = cola.trabajoNuevo("lectura", [tarea("a")]);
  const c = new AbortController();
  const p = cola.ejecutarCola(() => j, x => { j = x; }, () => new Promise(() => {}), c.signal);
  c.abort(); await p;
  assert.equal(j.hechas.length, 0);
});
test("sin conexión conserva la cola y no consulta", async () => {
  let j = cola.trabajoNuevo("lectura", [tarea("a")]), visitas = 0;
  await cola.ejecutarCola(() => j, x => { j = x; }, async () => { visitas++; return resultado("3"); }, new AbortController().signal, () => false);
  assert.equal(visitas, 0); assert.equal(j.estado, "activo");
});
test("fallos aislados mantienen el último resultado bueno y permiten reintentar", async () => {
  let j = cola.trabajoNuevo("lectura", [tarea("a"), tarea("b")]);
  j.resultados["mangadex-a"] = resultado("2");
  await cola.ejecutarCola(() => j, x => { j = x; }, async t => { if (t.external_id === "a") throw Error("404"); return resultado("3"); }, new AbortController().signal);
  assert.equal(j.estado, "terminado"); assert.equal(j.resultados["mangadex-a"].ultimo, "2");
  assert.equal(Object.keys(j.errores).length, 1);
  j.hechas = j.hechas.filter(k => !j.errores[k]); j.estado = "activo";
  await cola.ejecutarCola(() => j, x => { j = x; }, async () => resultado("4"), new AbortController().signal);
  assert.equal(Object.keys(j.errores).length, 0);
});
test("una respuesta de la cola anterior no modifica la nueva", async () => {
  let j = cola.trabajoNuevo("lectura", [tarea("a")]), resolver;
  const p = cola.ejecutarCola(() => j, x => { j = x; }, () => new Promise(r => { resolver = r; }), new AbortController().signal);
  j = cola.trabajoNuevo("lectura", [tarea("b")]); resolver(resultado("3")); await p;
  assert.equal(j.hechas.length, 0); assert.equal(j.tareas[0].external_id, "b");
});
test("fechas de detección se conservan si no hay capítulo nuevo", async () => {
  let j = cola.trabajoNuevo("lectura", [tarea("a")]);
  j.resultados["mangadex-a"] = { ...resultado("3"), obtenido: 2 };
  await cola.ejecutarCola(() => j, x => { j = x; }, async () => resultado("3"), new AbortController().signal);
  assert.equal(j.resultados["mangadex-a"].obtenido, 2);
});
test("capítulos discontinuos, decimales y progreso posterior se cuentan correctamente", () => {
  const { resumirCapitulos } = modulo("consultarBiblioteca");
  const r = resumirCapitulos([{ numero: "1" }, { numero: "1" }, { numero: "2.5" }, { numero: "9" }, { numero: null }], "1");
  assert.equal(r.sinLeer, 2); assert.equal(r.total, 3); assert.equal(r.ultimo, "9");
  assert.equal(cola.pendientesBiblioteca(r, "2.5"), 1); assert.equal(cola.pendientesBiblioteca(r, null), 3);
});
test("API: agrega metadatos solo para biblioteca y acota progreso a la sesión", async () => {
  for (const biblioteca of [false, true]) {
    let consulta;
    const exports = {};
    const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/app/api/series/route.ts"), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const fila = { id: 1, title: "QA", slug: "qa", status: "completed", type: "normal", _count: { chapters: 3 }, favorites: [], tags: [],
      progress: [{ updatedAt: "2026-09-20", chapter: { number: 2 } }], chapters: [{ number: 1 }, { number: 2 }, { number: 5 }] };
    vm.runInNewContext(codigo, { exports, URLSearchParams, require: nombre => {
      if (nombre === "next/server") return { NextResponse: { json: d => d } };
      if (nombre === "@/lib/auth") return { getSessionUser: async () => ({ id: 100 }) };
      if (nombre === "@/lib/db") return { db: { series: { findMany: async q => { consulta = q; return [fila]; } } } };
      if (nombre === "@/lib/contentAccess") return { contenidoAdultoPermitido: async () => false };
      if (nombre === "@/lib/tags") return { publicTag: t => t };
      if (nombre === "@/lib/slug") return {};
      throw Error(nombre);
    } });
    const r = await exports.GET({ nextUrl: new URL("http://localhost/api/series" + (biblioteca ? "?biblioteca=1" : "")) });
    assert.equal(consulta.include.progress.where.userId, biblioteca ? 100 : -1);
    if (biblioteca) { assert.equal(r[0].unread_count, 1); assert.equal(r[0].started, true); assert.equal(r[0].latest_chapter, 5); }
    else { assert.equal(consulta.include.chapters, false); assert.equal("unread_count" in r[0], false); }
  }
});
const filas = [{ clave: "b", titulo: "Serie 10", pendientes: 2, cantidad: 10, empezado: true, favorito: true, completado: false },
  { clave: "a", titulo: "Serie 2", pendientes: 0, cantidad: null, empezado: false, favorito: true, completado: true },
  { clave: "c", titulo: "Otro", pendientes: 4, cantidad: 5, empezado: true, favorito: false, completado: false }];
const ordenar = cambio => opciones.ordenarBiblioteca(filas, { ...opciones.opcionesIniciales, ...cambio }, x => x).map(x => x.clave).join(",");
test("filtros combinados y orden alfabético natural", () => {
  assert.equal(ordenar({ filtros: ["pendientes", "favoritos"] }), "b");
  assert.equal(ordenar({ filtros: ["completados"] }), "a");
  assert.equal(ordenar({ orden: "titulo", descendente: false }), "c,a,b");
});
test("dato desconocido queda al final en ambos sentidos; aleatorio estable", () => {
  assert.equal(ordenar({ orden: "cantidad" }), "b,c,a");
  assert.equal(ordenar({ orden: "cantidad", descendente: false }), "c,b,a");
  assert.equal(ordenar({ orden: "azar", semilla: 5 }), ordenar({ orden: "azar", semilla: 5 }));
});
test("preferencias corruptas no rompen el menú", () => {
  assert.equal(opciones.leerOpciones("{").vista, "comoda");
  assert.equal(opciones.leerOpciones('{"vista":"script","orden":"bad","filtros":["bad"]}').filtros.length, 0);
});
test("ambas variantes preservan el ahorro de batería y permiten un servicio acotado", () => {
  for (const variante of ["", "play/"]) {
    const java = fs.readFileSync(path.join(__dirname, "../mobile/patches", variante + "MainActivity.java"), "utf8");
    const xml = fs.readFileSync(path.join(__dirname, "../mobile/patches", variante + "AndroidManifest.xml"), "utf8");
    assert.match(java, /registerPlugin\(ActualizacionPlugin.class\)/);
    assert.match(java, /ActualizacionServicio.visibilidad\(webView, false\)/);
    assert.match(xml, /foregroundServiceType="dataSync"/);
  }
  const servicio = fs.readFileSync(path.join(__dirname, "../mobile/patches/ActualizacionServicio.java"), "utf8");
  assert.match(servicio, /pauseTimers/); assert.match(servicio, /cpu.release/); assert.match(servicio, /180000/);
});
