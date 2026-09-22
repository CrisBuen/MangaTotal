// Ejecutar: node --test scripts/verificar-referencias-lectura.cjs
// Pruebas públicas reales opcionales: MANGATOTAL_TEST_DOM apunta a linkedom
// instalado fuera del proyecto; MANGATOTAL_TEST_LIVE=1 habilita las consultas.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const raiz = path.resolve(__dirname, "..");

function cargar(archivo, mocks = {}, globals = {}, cache = new Map()) {
  const ruta = path.resolve(raiz, archivo);
  if (cache.has(ruta)) return cache.get(ruta);
  const salida = {};
  cache.set(ruta, salida);
  const codigo = ts.transpileModule(fs.readFileSync(ruta, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const importar = (nombre) => {
    if (Object.hasOwn(mocks, nombre)) return mocks[nombre];
    if (nombre.startsWith(".") || nombre.startsWith("@/")) {
      let destino = nombre.startsWith("@/")
        ? path.resolve(raiz, "src", nombre.slice(2))
        : path.resolve(path.dirname(ruta), nombre);
      if (!fs.existsSync(destino)) destino += fs.existsSync(destino + ".ts") ? ".ts" : ".tsx";
      return cargar(destino, mocks, globals, cache);
    }
    return require(nombre);
  };
  vm.runInNewContext(codigo, {
    exports: salida, require: importar, console, URL, URLSearchParams,
    fetch: () => { throw new Error("Red no autorizada en esta prueba"); },
    ...globals,
  }, { filename: ruta });
  return salida;
}

const ids = ["1202575895160651779", "1206272332840796162"];
const referencias = cargar("src/lib/referenciasLectura.ts");
test("Ikigai conserva ids exactos y recupera los dos progresos redondeados", () => {
  for (const id of ids) {
    assert.equal(referencias.recuperarIdIkigai(id, [{ id }]), id);
    assert.equal(referencias.recuperarIdIkigai(String(Number(id)), [{ id }]), id);
  }
  for (const id of ["123", "999", "no-es-id", "1e19"]) {
    assert.equal(referencias.recuperarIdIkigai(id, [{ id: ids[0] }]), id);
  }
  assert.equal(referencias.recuperarIdIkigai(String(Number(ids[0])), []), String(Number(ids[0])));
});

test("Ikigai no adivina cuando dos capítulos comparten el redondeo", () => {
  const casiIgual = String(BigInt(ids[0]) + 1n);
  assert.throws(() => referencias.recuperarIdIkigai(String(Number(ids[0])), [
    { id: ids[0] }, { id: casiIgual },
  ]), /No se pudo identificar/);
  assert.equal(referencias.recuperarIdIkigai(ids[0], [{ id: ids[0] }, { id: casiIgual }]), ids[0]);
});

const viejo = "obra-20260827-110518270";
const vigente = "obra-20260914-080456839";
const entrada = { id: 1498, slug: vigente, type: "comic" };
test("Olympus solo acepta una base exacta y distingue cómic de novela", () => {
  assert.equal(referencias.aliasOlympus(viejo, [entrada]).slug, vigente);
  assert.equal(referencias.aliasOlympus("obra", [entrada]).slug, vigente);
  assert.equal(referencias.aliasOlympus(vigente, [entrada]), null);
  assert.equal(referencias.aliasOlympus("otra-obra", [entrada]), null);
  assert.equal(referencias.aliasOlympus(viejo, [entrada], "novel"), null);
  assert.equal(referencias.aliasOlympus(viejo, [entrada, { ...entrada, id: 2, type: "novel" }]), null);
  assert.equal(referencias.aliasOlympus(viejo, [entrada, { ...entrada, id: 2, type: "novel" }], "comic").id, 1498);
});

function olympusSimulado({ estado = 404, detalleId = 1498, capViejo = 404 } = {}) {
  const llamadas = [];
  const api = cargar("src/lib/olympus.ts", {}, {
    fetch: async (url, opciones) => {
      llamadas.push({ url, opciones });
      if (url.endsWith("/api/series/list")) return Response.json({ data: [entrada] });
      if (url.endsWith("/api/series/" + viejo)) return new Response("", { status: estado });
      if (url.endsWith("/api/series/" + vigente)) {
        return Response.json({ data: { ...entrada, id: detalleId, name: "Obra", genres: [] } });
      }
      if (url.includes("/api/capitulo/")) {
        if (url.includes(viejo) && capViejo !== 200) return new Response("", { status: capViejo });
        return Response.json({ chapter: { id: 10, name: "1", pages: ["https://example.org/1.jpg"] } });
      }
      throw new Error("URL inesperada: " + url);
    },
  });
  return { api, llamadas };
}
test("Olympus resuelve ficha y capítulo antiguos con índice fresco", async () => {
  const { api, llamadas } = olympusSimulado();
  assert.equal((await api.serie(viejo)).slug, vigente);
  assert.ok(llamadas.find((x) => x.url.endsWith("/list") && x.opciones.next.revalidate === 0));
  const cap = await api.paginas(10, "comic", viejo);
  assert.equal(cap.pages.length, 1);
  assert.ok(cap.url_original.includes(vigente));
});
test("Olympus no convierte 403/500 en cambios de slug ni acepta otro id", async () => {
  for (const estado of [403, 500]) {
    const { api, llamadas } = olympusSimulado({ estado });
    await assert.rejects(api.serie(viejo), new RegExp(String(estado)));
    assert.equal(llamadas.length, 1);
  }
  const { api } = olympusSimulado({ detalleId: 9999 });
  await assert.rejects(api.serie(viejo), /404/);
});
test("La API de ficha pide los capítulos de la dirección resuelta", async () => {
  const llamadas = [];
  const route = cargar("src/app/api/externo/olympus/series/[slug]/route.ts", {
    "@/lib/olympus": {
      serie: async (s) => { llamadas.push(s); return entrada; },
      capitulos: async (s) => { llamadas.push(s); return { chapters: [], total: 0 }; },
    },
  });
  const res = await route.GET({ nextUrl: new URL("https://example.test/api/externo/olympus/series/obra") }, { params: Promise.resolve({ slug: viejo }) });
  assert.equal(res.status, 200);
  assert.deepEqual(llamadas, [viejo, vigente]);
});

function documentoFicha(adulto = false) {
  return {
    querySelector: () => ({ textContent: "Obra" }),
    querySelectorAll(selector) {
      if (selector === 'a[href^="/capitulo/"]') return [...ids].reverse().map((id) => ({
        getAttribute: () => "/capitulo/" + id + "/",
        querySelector: (s) => ({ textContent: s === "h3" ? "Capítulo " + (ids.indexOf(id) + 1) : "hace 1 d" }),
      }));
      if (selector === 'a[href*="generos"]') return [{ textContent: adulto ? "+18" : "Fantasía" }];
      return [];
    },
  };
}
const documentoCapitulo = {
  documentElement: { innerHTML: "" },
  querySelector: () => ({ textContent: "Capítulo de prueba - Obra" }),
  querySelectorAll: () => [{ getAttribute: () => "https://example.org/1.jpg" }],
};
function ikigaiSimulado(ua, { adulto = false, fichaCaida = false } = {}) {
  const llamadas = [];
  const api = cargar("src/lib/ikigai.ts", {
    "./fuenteNativa": {
      traerDocumento: async (url) => {
        llamadas.push(url);
        if (url.includes("/series/")) {
          if (fichaCaida) throw new Error("Ficha caída");
          return documentoFicha(adulto);
        }
        return documentoCapitulo;
      },
    },
  }, { navigator: { userAgent: ua } });
  return { api, llamadas };
}
test("La lectura recupera el id antes de pedir el capítulo en Windows y ambos Android", async () => {
  for (const ua of ["Windows", "MangaTotalApp/19 MangaTotalChannel/local", "MangaTotalApp/19 MangaTotalChannel/play"]) {
    const { api, llamadas } = ikigaiSimulado(ua);
    const lectura = await api.lecturaIkigai(String(Number(ids[0])), "obra");
    assert.equal(lectura.cap.id, ids[0]);
    assert.ok(llamadas.at(-1).includes(ids[0]));
    assert.equal(lectura.ficha.capitulos[1].id, ids[1]);
  }
});
test("Play sigue rechazando ficha adulta, sin slug o sin clasificación disponible", async () => {
  for (const opciones of [{ adulto: true }, { fichaCaida: true }]) {
    const { api, llamadas } = ikigaiSimulado("MangaTotalApp/19 MangaTotalChannel/play", opciones);
    await assert.rejects(api.lecturaIkigai(ids[0], "obra"));
    assert.ok(llamadas.every((url) => !url.includes("/capitulo/")));
  }
  const { api, llamadas } = ikigaiSimulado("MangaTotalApp/19 MangaTotalChannel/play");
  await assert.rejects(api.lecturaIkigai(ids[0], ""), /desde la ficha/);
  assert.equal(llamadas.length, 0);
});

function lectorSimulado(obtener, disponible = true) {
  let cursor = 0, efectos = [], capId = String(Number(ids[0]));
  const slots = [];
  const depsIguales = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const react = {
    use: (x) => x,
    useState: (inicial) => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = inicial;
      return [slots[i], (v) => { slots[i] = v; }];
    },
    useRef: (inicial) => {
      const i = cursor++;
      return slots[i] ??= { current: inicial };
    },
    useCallback: (fn, deps) => {
      const i = cursor++;
      if (!depsIguales(slots[i]?.deps, deps)) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect: (fn, deps) => {
      const i = cursor++;
      if (depsIguales(slots[i]?.deps, deps)) return;
      efectos.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    },
  };
  const { default: Page } = cargar("src/app/leer-externo/ikigai/[id]/page.tsx", {
    react,
    "next/navigation": { useSearchParams: () => new URLSearchParams("slug=obra&page=2") },
    "@/components/reader/OlympusReader": { OlympusReader: "lector" },
    "@/components/fuentes/AvisoFuente": { AvisoFuente: "aviso" },
    "@/lib/ikigai": { IKIGAI_WEB: "https://example.org", IKIGAI_NOMBRE: "Ikigai", lecturaIkigai: obtener, ikigaiDisponible: () => disponible },
  });
  return {
    render: (id = capId) => { capId = id; cursor = 0; return Page({ params: { id } }); },
    async efectos() { const pendientes = efectos; efectos = []; pendientes.forEach((fn) => fn()); await new Promise(setImmediate); },
  };
}
const lecturaDePrueba = (id = ids[0]) => ({
  cap: { id, paginas: ["https://example.org/1.jpg"], url_original: "https://example.org/capitulo/" + id },
  ficha: { capitulos: ids.map((id, i) => ({ id, numero: String(i + 1) })) },
});
test("El lector transmite ids exactos, vecinos y página inicial; Reintentar vuelve a cargar", async () => {
  let intentos = 0;
  const ui = lectorSimulado(async () => { if (++intentos === 1) throw new Error("404"); return lecturaDePrueba(); });
  ui.render(); await ui.efectos();
  const error = ui.render();
  assert.equal(error.props.children.type, "aviso");
  await error.props.children.props.onReintentar();
  const lector = ui.render();
  assert.equal(intentos, 2);
  assert.equal(lector.type, "lector");
  assert.equal(lector.props.chapter.id, ids[0]);
  assert.equal(lector.props.nextChapter.id, ids[1]);
  assert.equal(lector.props.prevChapter, null);
  assert.equal(lector.props.initialPage, 2);
  assert.ok(lector.props.hrefCapitulo(ids[1]).includes(ids[1]));
});
test("Una respuesta atrasada no reemplaza al capítulo siguiente", async () => {
  const pendientes = [];
  const ui = lectorSimulado(() => new Promise((resolve) => pendientes.push(resolve)));
  ui.render(ids[0]); await ui.efectos();
  ui.render(ids[1]); await ui.efectos();
  pendientes[1](lecturaDePrueba(ids[1])); await new Promise(setImmediate);
  pendientes[0](lecturaDePrueba(ids[0])); await new Promise(setImmediate);
  assert.equal(ui.render().props.chapter.id, ids[1]);
  assert.equal(ui.render().props.prevChapter.id, ids[0]);
});
test("Ikigai no se habilita en el navegador al pulsar Reintentar", async () => {
  let consultas = 0;
  const ui = lectorSimulado(async () => { consultas++; return lecturaDePrueba(); }, false);
  ui.render(); await ui.efectos();
  await ui.render().props.children.props.onReintentar();
  assert.equal(consultas, 0);
});

test("Fuentes reales: recuperar dos series Ikigai y saltar 1 → 2 → 1; Olympus antiguo", {
  skip: process.env.MANGATOTAL_TEST_LIVE !== "1", timeout: 180000,
}, async () => {
  const { parseHTML } = require(process.env.MANGATOTAL_TEST_DOM);
  const obtener = async (url, opciones) => {
    // Reproducir los encabezados de fuenteNativa: sin ellos Ikigai devuelve
    // un documento sin las páginas del visor, aunque el estado sea 200.
    const res = await fetch(url, {
      ...opciones,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9",
        ...opciones?.headers,
      },
      signal: AbortSignal.timeout(25000),
    });
    return res;
  };
  const ikigai = cargar("src/lib/ikigai.ts", {
    "./fuenteNativa": { traerDocumento: async (url) => {
      const res = await obtener(url);
      assert.equal(res.status, 200, url);
      return parseHTML(await res.text()).document;
    } },
  // Las fichas reales pueden tener clasificación restringida. Play se
  // comprueba arriba con casos permitidos y denegados, sin quitar su filtro.
  }, { navigator: { userAgent: "MangaTotalApp/19 MangaTotalChannel/local" } });
  for (const slug of ["la-criada-con-un-nino", "el-pequeno-retono-que-florecio-en-la-familia-del-duque-villano"]) {
    const ficha = await ikigai.serieIkigai(slug);
    const primero = ficha.capitulos.find((c) => c.numero === "1");
    const segundo = ficha.capitulos.find((c) => c.numero === "2");
    assert.ok(primero && segundo);
    const lectura = await ikigai.lecturaIkigai(String(Number(primero.id)), slug);
    assert.equal(lectura.cap.id, primero.id);
    for (const id of [segundo.id, primero.id]) {
      const cap = await ikigai.capituloIkigai(id);
      assert.ok(cap.paginas.length > 0);
    }
    console.log("Ikigai:", slug, "recuperación y capítulos 1/2 correctos;", lectura.cap.paginas.length, "páginas en cap. 1");
  }
  const olympus = cargar("src/lib/olympus.ts", {}, { fetch: obtener });
  const slug = "que-abundante-cosecha-senor-demonio-20260827-110518270";
  const ficha = await olympus.serie(slug);
  assert.equal(ficha.id, 1498);
  const lista = await olympus.capitulos(ficha.slug);
  assert.equal(lista.chapters.length, lista.total);
  const cap = await olympus.paginas(ficha.first_chapter.id, ficha.type, slug);
  assert.ok(cap.pages.length > 0 && cap.next);
  const segundo = await olympus.paginas(cap.next.id, ficha.type, slug);
  assert.ok(segundo.pages.length > 0);
  console.log("Olympus: enlace antiguo resuelto;", lista.total, "capítulos; capítulos 1/2 correctos");
  const frontera = await olympus.serie("loco-frontera-20260914-080505795");
  const capFrontera = await olympus.paginas(frontera.first_chapter.id, frontera.type, frontera.slug);
  assert.ok(capFrontera.pages.length > 0);
  console.log("Olympus: serie adicional Loco frontera correcta");
});
