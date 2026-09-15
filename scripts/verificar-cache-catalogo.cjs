// Casos de red lenta sin red real ni acceso a las caches del usuario.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function entorno({ android = false, sinCache = false, sinRed = false, fallaStorage = false } = {}) {
  const datos = new Map(), timers = [];
  let ahora = 1_000_000;
  const caches = {
    async open() {
      if (fallaStorage) throw new Error("Sin espacio");
      return {
        async match(r) { return datos.get(r.url)?.clone(); },
        async put(r, v) { datos.set(r.url, v.clone()); },
        async delete(r) { return datos.delete(r.url); },
        async keys() { return [...datos.keys()].map((u) => new Request(u)); },
      };
    },
  };
  const window = {
    location: { origin: "https://example.org" },
    setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    clearTimeout() {},
    ...(!sinCache && { caches }),
  };
  const exports = {};
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/androidCache.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(codigo, {
    exports, require: (nombre) => {
      assert.equal(nombre, "./appVersion");
      return { isAndroidApp: () => android };
    },
    Request, Response, URL, AbortController, window, caches,
    Date: class extends Date { static now() { return ahora; } },
    navigator: { onLine: !sinRed }, document: { visibilityState: "visible" },
  });
  return { ...exports, datos, timers, avanzar: (ms) => { ahora += ms; } };
}

const opciones = { publicCache: true, freshForMs: 900_000, maxAgeMs: 86_400_000, timeoutMs: 30_000 };
const sinConexion = async () => { throw new Error("Sin conexion"); };

for (const plataforma of ["web", "windows", "android-local", "android-play"]) {
  test(plataforma + ": reutiliza el catalogo publico sin otra descarga", async () => {
    const e = entorno({ android: plataforma.startsWith("android") });
    let llamadas = 0;
    const red = async () => ({ total: ++llamadas });
    await e.cargarConCacheAndroid("catalogo:p1", red, opciones);
    const segunda = await e.cargarConCacheAndroid("catalogo:p1", red, opciones);
    assert.equal(llamadas, 1);
    assert.equal(segunda.total, 1);
  });
}

test("Paginas, filtros y fichas tienen claves independientes", async () => {
  const e = entorno();
  for (const clave of ["catalogo:p1", "catalogo:p2", "catalogo:buscar", "ficha:serie"]) {
    const r = await e.cargarConCacheAndroid(clave, async () => clave, opciones);
    assert.equal(r, clave);
  }
  assert.equal(e.datos.size, 4);
});

test("Actualizar fuerza la red aunque la copia siga fresca", async () => {
  const e = entorno();
  await e.cargarConCacheAndroid("catalogo", async () => "anterior", opciones);
  assert.equal(await e.cargarConCacheAndroid("catalogo", async () => "nuevo", { ...opciones, force: true }), "nuevo");
  assert.equal((await e.leerCacheAndroid("catalogo", opciones)).value, "nuevo");
});

test("Copia antigua aparece antes de la red y permanece si esta falla", async () => {
  const e = entorno(), orden = [];
  await e.guardarCacheAndroid("catalogo", "anterior", opciones);
  e.avanzar(900_001);
  const resultado = await e.cargarConCacheAndroid("catalogo", async () => {
    orden.push("red"); return sinConexion();
  }, { ...opciones, onCached: () => orden.push("copia") });
  assert.deepEqual(orden, ["copia", "red"]);
  assert.equal(resultado, "anterior");
});

test("Sin conexion utiliza una copia valida sin intentar una descarga", async () => {
  const e = entorno({ sinRed: true });
  await e.guardarCacheAndroid("catalogo", "anterior", opciones);
  e.avanzar(900_001);
  let llamadas = 0;
  assert.equal(await e.cargarConCacheAndroid("catalogo", async () => { llamadas++; return "red"; }, opciones), "anterior");
  assert.equal(llamadas, 0);
});

test("No conserva un catalogo vencido mas de 24 horas", async () => {
  const e = entorno();
  await e.guardarCacheAndroid("catalogo", "anterior", opciones);
  e.avanzar(86_400_001);
  await assert.rejects(e.cargarConCacheAndroid("catalogo", sinConexion, opciones), /Sin conexion/);
  assert.equal(e.datos.size, 0);
});

test("Una primera carga colgada termina a los 30 segundos incluso sin CacheStorage", async () => {
  const e = entorno({ sinCache: true });
  const pendiente = e.cargarConCacheAndroid("catalogo", (signal) => new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new Error("Cancelado")), { once: true });
  }), opciones);
  await Promise.resolve();
  assert.equal(e.timers[0].ms, 30_000);
  e.timers[0].fn();
  await assert.rejects(pendiente, /Cancelado/);
});

test("Si falla el almacenamiento se puede cargar por red", async () => {
  const e = entorno({ fallaStorage: true });
  assert.equal(await e.cargarConCacheAndroid("catalogo", async () => "red", opciones), "red");
});

test("Opt-in publico no habilita datos privados ni cambia llamadas normales en web", async () => {
  for (const configuracion of [{}, { privateData: true }, { publicCache: true, privateData: true }]) {
    const e = entorno();
    await e.guardarCacheAndroid("usuario", "privado", configuracion);
    assert.equal(await e.leerCacheAndroid("usuario", configuracion), null);
    assert.equal(e.datos.size, 0);
  }
});

test("Cerrar sesion en Android borra datos privados y conserva el catalogo", async () => {
  const e = entorno({ android: true });
  await e.guardarCacheAndroid("usuario", "privado", { privateData: true });
  await e.guardarCacheAndroid("catalogo", "publico", opciones);
  await e.borrarCachePrivadaAndroid();
  assert.equal(e.datos.size, 1);
  assert.equal(await e.leerCacheAndroid("usuario", { privateData: true }), null);
  assert.equal((await e.leerCacheAndroid("catalogo", opciones)).value, "publico");
});

test("Explorar separa anime y espera la fuente elegida antes de MangaDex/Olympus", () => {
  const codigo = fs.readFileSync(path.join(__dirname, "../src/app/(reader)/explorar/page.tsx"), "utf8");
  for (const componente of ["JkanimeCatalog", "HentaitvCatalog", "TioanimeCatalog"]) {
    assert.ok(codigo.includes('dynamic(() => import("@/components/anime/' + componente + '")'));
    assert.ok(!codigo.includes("import { " + componente + " }"));
  }
  assert.ok(codigo.includes('!lecturaActiva || fuente !== "mangadex" || genres.length > 0'));
  assert.ok(codigo.indexOf("const [restaurado,") < codigo.indexOf("const lecturaActiva"));
  const olympus = codigo.slice(codigo.indexOf('href={' + String.fromCharCode(96) + '/externo/olympus/'));
  assert.ok(olympus.slice(0, 600).includes("prefetch={false}"));
});
