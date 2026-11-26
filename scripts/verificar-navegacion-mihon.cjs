// Ejecutar: node --test scripts/verificar-navegacion-mihon.cjs
// Requiere `.next/` compilado (`npx next build`) y Microsoft Edge instalado en Windows.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const vm = require("node:vm");
const zlib = require("node:zlib");
const { spawn, execSync } = require("node:child_process");
const ts = require("typescript");

const RAIZ = path.resolve(__dirname, "..");

// ── Generador PNG puro para E2E (sin red ni archivos binarios externos) ─────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(width, height, r = 36, g = 42, b = 68) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y += 1) {
    const off = y * rowSize;
    raw[off] = 0; // filter None
    const stripe = (Math.floor(y / 120) % 2) * 18;
    for (let x = 0; x < width; x += 1) {
      const px = off + 1 + x * 3;
      raw[px] = Math.min(255, r + stripe);
      raw[px + 1] = Math.min(255, g + stripe);
      raw[px + 2] = Math.min(255, b + stripe);
    }
  }
  const idat = zlib.deflateSync(raw, { level: 1 });
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}

// ── Cargador VM para módulos TypeScript con entorno window mockeado ─────────

function createStorageMock() {
  const map = new Map();
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(String(k), String(v));
    },
    removeItem(k) {
      map.delete(k);
    },
    clear() {
      map.clear();
    },
    get _map() {
      return map;
    },
  };
}

function createWindowEnv(initialUrl = "https://mangatotal.test/explorar") {
  let current = new URL(initialUrl);
  const backCalls = [];
  const pushCalls = [];
  const replaceCalls = [];
  const sessionStorage = createStorageMock();
  const localStorage = createStorageMock();

  const windowObj = {
    sessionStorage,
    localStorage,
    scrollY: 0,
    innerHeight: 900,
    scrollTo() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
    get location() {
      return {
        get origin() {
          return current.origin;
        },
        get pathname() {
          return current.pathname;
        },
        get search() {
          return current.search;
        },
        get hash() {
          return current.hash;
        },
        get href() {
          return current.href;
        },
        set href(next) {
          current = new URL(next, current.origin);
        },
      };
    },
    history: {
      length: 3,
      state: {
        __NA: true,
        _N: true,
        __PRIVATE_NEXTJS_INTERNALS_TREE: ["root"],
        odAnimeSheet: { id: 99, slug: "test" },
      },
      pushState(state, _title, url) {
        current = new URL(String(url), current.origin);
        this.state = state;
        this.length += 1;
        pushCalls.push({ state, url: String(url) });
      },
      replaceState(state, _title, url) {
        current = new URL(String(url), current.origin);
        this.state = state;
        replaceCalls.push({ state, url: String(url) });
      },
      back() {
        backCalls.push(current.pathname + current.search);
      },
    },
  };

  return {
    windowObj,
    backCalls,
    pushCalls,
    replaceCalls,
    setUrl(u) {
      current = new URL(u, current.origin);
    },
  };
}

function cargarTs(archivoRel, extraGlobals = {}) {
  const ruta = path.join(RAIZ, archivoRel);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(ruta, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const reactStub = {
    useCallback: (fn) => fn,
    useEffect: () => {},
    useRef: (v) => ({ current: v }),
    useState: (v) => [typeof v === "function" ? v() : v, () => {}],
  };
  vm.runInNewContext(
    code,
    {
      exports,
      require: (name) => (name === "react" ? reactStub : require(name)),
      URL,
      URLSearchParams,
      Date,
      Set,
      Map,
      Math,
      JSON,
      setTimeout,
      clearTimeout,
      requestAnimationFrame: (cb) => setTimeout(cb, 0),
      cancelAnimationFrame: (id) => clearTimeout(id),
      console,
      ...extraGlobals,
    },
    { filename: ruta }
  );
  return exports;
}

// ── 1. Pruebas unitarias de estado y navegación ──────────────────────────────

test("unit: normalizarClaveRuta y normalizarUrlRelativa son deterministas", () => {
  const { windowObj } = createWindowEnv();
  const nav = cargarTs("src/lib/navegacionEstado.ts", { window: windowObj });

  assert.equal(
    nav.normalizarClaveRuta("/explorar", "?p=20&fuente=olympus&vacio=#sec"),
    "/explorar?fuente=olympus&p=20"
  );
  assert.equal(
    nav.normalizarClaveRuta("/explorar", "fuente=olympus&p=20"),
    nav.normalizarClaveRuta("/explorar", "?p=20&fuente=olympus")
  );
  assert.equal(
    nav.normalizarUrlRelativa("https://mangatotal.com/explorar?z=1&a=2#top"),
    "/explorar?a=2&z=1"
  );
});

test("unit: escribirUrlHistorial limpia marcas internas de Next 15 y conserva estado propio", () => {
  const env = createWindowEnv("https://mangatotal.test/explorar?fuente=olympus&p=1");
  const nav = cargarTs("src/lib/navegacionEstado.ts", { window: env.windowObj });

  nav.escribirUrlHistorial("/explorar?p=20&fuente=olympus", "push");
  assert.equal(env.pushCalls.length, 1);
  const estado = env.pushCalls[0].state;
  assert.deepEqual(estado.odAnimeSheet, { id: 99, slug: "test" });
  assert.equal("__NA" in estado, false);
  assert.equal("_N" in estado, false);
  assert.equal("__PRIVATE_NEXTJS_INTERNALS_TREE" in estado, false);
  assert.equal(nav.fueEscritaPorNosotros("/explorar", "?fuente=olympus&p=20"), true);
});

test("unit: separación estricta entre mundos Lectura y Anime", () => {
  const env = createWindowEnv("https://mangatotal.test/explorar");
  const nav = cargarTs("src/lib/navegacionEstado.ts", { window: env.windowObj });

  nav.guardarUltimaFuente("lectura", "olympus");
  nav.guardarUltimaFuente("anime", "tioanime");
  nav.guardarUltimoExplorar("lectura", "/explorar?fuente=olympus&p=20");
  nav.guardarUltimoExplorar("anime", "/explorar?seccion=animada&anime_fuente=tioanime&anime_page=3");
  nav.guardarEstadoFuente("lectura", "olympus", "/explorar?fuente=olympus&p=20");
  nav.guardarEstadoFuente("anime", "tioanime", "/explorar?seccion=animada&anime_fuente=tioanime&anime_page=3");
  nav.guardarUltimaRutaMundo("lectura", "/biblioteca?f=normal");
  nav.guardarUltimaRutaMundo("anime", "/explorar/tioanime/serie-1");

  assert.equal(nav.leerUltimaFuente("lectura"), "olympus");
  assert.equal(nav.leerUltimaFuente("anime"), "tioanime");
  assert.equal(nav.leerUltimoExplorar("lectura"), "/explorar?fuente=olympus&p=20");
  assert.equal(
    nav.leerUltimoExplorar("anime"),
    "/explorar?seccion=animada&anime_fuente=tioanime&anime_page=3"
  );
  assert.equal(nav.leerEstadoFuente("lectura", "olympus"), "/explorar?fuente=olympus&p=20");
  assert.equal(
    nav.leerEstadoFuente("anime", "tioanime"),
    "/explorar?seccion=animada&anime_fuente=tioanime&anime_page=3"
  );
  assert.equal(nav.leerUltimaRutaMundo("lectura"), "/biblioteca?f=normal");
  assert.equal(nav.leerUltimaRutaMundo("anime"), "/explorar/tioanime/serie-1");

  // Una clave legada contaminada con seccion=animada jamás contamina Lectura.
  env.windowObj.sessionStorage.removeItem("mangatotal:ultimo-explorar:lectura");
  env.windowObj.sessionStorage.setItem(
    "mangatotal:ultimo-explorar",
    "/explorar?seccion=animada&anime_fuente=tioanime"
  );
  assert.equal(nav.leerUltimoExplorar("lectura"), null);
});

test("unit: pila interna, esPop y navegarAtrasInteligente evitan bucles hacia lectores/reproductores", () => {
  const env = createWindowEnv("https://mangatotal.test/explorar?fuente=olympus&p=20");
  const nav = cargarTs("src/lib/navegacionEstado.ts", { window: env.windowObj });

  nav.registrarVisitaRuta("/explorar?fuente=olympus&p=20");
  nav.registrarVisitaRuta("/externo/olympus/serie-demo");
  nav.registrarVisitaRuta("/leer-externo/olympus/100?slug=serie-demo");
  nav.registrarVisitaRuta("/leer-externo/olympus/101?slug=serie-demo");
  env.setUrl("https://mangatotal.test/leer-externo/olympus/101?slug=serie-demo");

  assert.equal(nav.esRutaLectorOPlayer("/leer-externo/olympus/100"), true);
  assert.equal(nav.esRutaLectorOPlayer("/explorar/tioanime/obra/1"), true);
  assert.equal(nav.esRutaLectorOPlayer("/externo/olympus/serie-demo"), false);

  const routerCalls = [];
  const fakeRouter = {
    push: (href) => routerCalls.push(["push", href]),
    replace: (href) => routerCalls.push(["replace", href]),
  };

  // Anterior inmediato es otro capítulo (/100) -> evitarLector obliga a saltar al fallback sin bucle.
  nav.navegarAtrasInteligente(fakeRouter, "/externo/olympus/serie-demo", {
    evitarLector: true,
    replaceFallback: true,
  });
  assert.deepEqual(routerCalls, [["replace", "/externo/olympus/serie-demo"]]);
  assert.equal(env.backCalls.length, 0);

  // Cuando esPop retrocede a la ficha y se abre un capítulo directo desde la ficha, Atrás vuelve a la ficha.
  const pilaTrasPop = nav.registrarVisitaRuta("/externo/olympus/serie-demo", { esPop: true });
  assert.deepEqual(pilaTrasPop, [
    "/explorar?fuente=olympus&p=20",
    "/externo/olympus/serie-demo",
  ]);
  nav.registrarVisitaRuta("/leer-externo/olympus/102?slug=serie-demo");
  env.setUrl("https://mangatotal.test/leer-externo/olympus/102?slug=serie-demo");
  nav.navegarAtrasInteligente(fakeRouter, "/externo/olympus/serie-demo", { evitarLector: true });
  assert.equal(env.backCalls.length, 1);
});

test("unit: guardarPosicionLector limita ratio, conserva sub-página en misma página y aplica tope LRU 60", () => {
  const env = createWindowEnv("https://mangatotal.test/leer/1");
  const nav = cargarTs("src/lib/navegacionEstado.ts", { window: env.windowObj });

  nav.guardarPosicionLector("cap:local:1", { page: 2, ratio: 1.5, chapterId: "1", updatedAt: 1000 });
  assert.equal(nav.leerPosicionLector("cap:local:1").ratio, 0.96);

  // Al guardar solo página desde debounce sin ratio, conserva el ratio de esa misma página.
  nav.guardarPosicionLector("cap:local:1", { page: 2, chapterId: "1", updatedAt: 1010 });
  assert.equal(nav.leerPosicionLector("cap:local:1").ratio, 0.96);

  // Al cambiar de página sin ratio explícito, reinicia ratio a 0.
  nav.guardarPosicionLector("cap:local:1", { page: 3, chapterId: "1", updatedAt: 1020 });
  assert.equal(nav.leerPosicionLector("cap:local:1").ratio, 0);

  for (let i = 1; i <= 70; i += 1) {
    nav.guardarPosicionLector(`cap:lru:${i}`, { page: 1, ratio: 0.2, updatedAt: 2000 + i });
  }
  assert.equal(nav.leerPosicionLector("cap:lru:1"), null);
  assert.equal(nav.leerPosicionLector("cap:lru:70").page, 1);
  assert.equal(
    Object.keys(JSON.parse(env.windowObj.localStorage.getItem("mangatotal:lector:posiciones"))).length,
    60
  );
});

test("unit: esRutaExclusivaLectura no fuerza Lectura en rutas compartidas ni Anime", () => {
  const { esRutaExclusivaLectura } = cargarTs("src/lib/readingNavigation.ts");
  const q = (s) => new URLSearchParams(s);

  for (const [ruta, query] of [
    ["/lectura", ""],
    ["/lectura/descubrir", ""],
    ["/biblioteca", "f=normal"],
    ["/fuentes", ""],
    ["/externo/olympus/obra", ""],
    ["/serie/obra", ""],
    ["/explorar", "fuente=olympus"],
  ]) {
    assert.equal(esRutaExclusivaLectura(ruta, q(query)), true, `${ruta}?${query}`);
  }

  for (const [ruta, query] of [
    ["/explorar", "seccion=animada"],
    ["/anime", ""],
    ["/anime/123", ""],
    ["/noticias", ""],
    ["/aleatorio", ""],
  ]) {
    assert.equal(esRutaExclusivaLectura(ruta, q(query)), false, `${ruta}?${query}`);
  }
});

// ── 2. Chequeos estáticos de integridad (AGENTS.md y parches Android) ──────

function contarBalanceJava(codigo, archivo) {
  let sinComentariosNiTexto = "";
  let i = 0;
  while (i < codigo.length) {
    const c = codigo[i];
    const sig = codigo[i + 1];
    if (c === "/" && sig === "/") {
      while (i < codigo.length && codigo[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && sig === "*") {
      i += 2;
      while (i < codigo.length && !(codigo[i] === "*" && codigo[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i += 1;
      while (i < codigo.length && codigo[i] !== q) {
        if (codigo[i] === "\\") i += 2;
        else i += 1;
      }
      i += 1;
      continue;
    }
    sinComentariosNiTexto += c;
    i += 1;
  }

  let llaves = 0;
  let parens = 0;
  for (const ch of sinComentariosNiTexto) {
    if (ch === "{") llaves += 1;
    else if (ch === "}") llaves -= 1;
    else if (ch === "(") parens += 1;
    else if (ch === ")") parens -= 1;
    assert.ok(llaves >= 0, `${archivo}: llave de cierre sobrante`);
    assert.ok(parens >= 0, `${archivo}: paréntesis de cierre sobrante`);
  }
  assert.equal(llaves, 0, `${archivo}: llaves desbalanceadas`);
  assert.equal(parens, 0, `${archivo}: paréntesis desbalanceados`);
}

test("estático: CascadeReader, AGENTS.md y parches Android mantienen sus invariantes", () => {
  const cascade = fs.readFileSync(path.join(RAIZ, "src/components/reader/CascadeReader.tsx"), "utf8");
  for (const token of ["PROPORCION_INICIAL", "medidas", "anotarMedida", "proporcionTipica", "aspectRatio:"]) {
    assert.ok(cascade.includes(token), `CascadeReader debe conservar ${token}`);
  }

  const leercap = fs.readFileSync(path.join(RAIZ, "src/lib/leercapitulo.ts"), "utf8");
  const leercapCod = fs.readFileSync(path.join(RAIZ, "src/lib/leercapituloCodigo.ts"), "utf8");
  const authRl = fs.readFileSync(path.join(RAIZ, "src/lib/authRateLimit.ts"), "utf8");
  const regRoute = fs.readFileSync(path.join(RAIZ, "src/app/api/auth/register/route.ts"), "utf8");

  assert.ok(leercap.includes("LC_HABILITADA"), "leercapitulo.ts perdió LC_HABILITADA");
  assert.ok(leercapCod.includes("paginasDelHtml"), "leercapituloCodigo.ts perdió paginasDelHtml");
  assert.ok(fs.existsSync(path.join(RAIZ, "src/lib/leercapituloOrden.ts")), "Falta leercapituloOrden.ts");
  assert.match(authRl, /pg_advisory_xact_lock\([\s\S]*?\)\s+IS NULL/, "Falta IS NULL en authRateLimit.ts");
  assert.match(regRoute, /pg_advisory_xact_lock\([\s\S]*?\)\s+IS NULL/, "Falta IS NULL en register/route.ts");

  for (const javaRel of ["mobile/patches/MainActivity.java", "mobile/patches/play/MainActivity.java"]) {
    const src = fs.readFileSync(path.join(RAIZ, javaRel), "utf8");
    contarBalanceJava(src, javaRel);
    assert.ok(src.includes("OnBackPressedCallback"), `${javaRel} sin OnBackPressedCallback`);
    assert.ok(src.includes("getOnBackPressedDispatcher()"), `${javaRel} sin getOnBackPressedDispatcher`);
    assert.ok(src.includes("onPause()"), `${javaRel} sin onPause`);
    assert.ok(src.includes("window.__mtFlushProgress"), `${javaRel} sin __mtFlushProgress`);
    assert.equal(/\bpublic\s+void\s+onBackPressed\s*\(/.test(src), false, `${javaRel} aún sobrescribe onBackPressed()`);
  }

  const desafio = fs.readFileSync(path.join(RAIZ, "mobile/patches/DesafioActivity.java"), "utf8");
  contarBalanceJava(desafio, "mobile/patches/DesafioActivity.java");
  assert.ok(desafio.includes("OnBackInvokedCallback"), "DesafioActivity sin OnBackInvokedCallback");
  assert.ok(desafio.includes("Build.VERSION_CODES.TIRAMISU"), "DesafioActivity sin chequeo TIRAMISU");
});

// ── 3. Infraestructura E2E real con Edge Headless + CDP sobre next start ────

function findEdgePath() {
  const candidates = [
    process.env.MANGATOTAL_EDGE_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHttp(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {}
    await sleep(150);
  }
  throw new Error(`Tiempo agotado esperando ${url}`);
}

function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    const listeners = new Map();

    const api = {
      send(method, params = {}) {
        const id = nextId++;
        return new Promise((res, rej) => {
          pending.set(id, { res, rej, method });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      on(event, fn) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(fn);
      },
      close() {
        try {
          ws.close();
        } catch {}
      },
    };

    ws.addEventListener("open", () => resolve(api));
    ws.addEventListener("error", (err) => reject(err));
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id) {
        const entry = pending.get(msg.id);
        if (!entry) return;
        pending.delete(msg.id);
        if (msg.error) entry.rej(new Error(`${entry.method}: ${msg.error.message}`));
        else entry.res(msg.result);
      } else if (msg.method) {
        const set = listeners.get(msg.method);
        if (set) {
          for (const fn of set) {
            Promise.resolve(fn(msg.params)).catch((e) => console.error("[cdp listener]", e));
          }
        }
      }
    });
  });
}

function buildMockResponder() {
  const pagePng = makePng(800, 1600, 34, 40, 74);
  const coverPng = makePng(200, 300, 48, 32, 72);
  const jsonHeaders = [
    { name: "Content-Type", value: "application/json; charset=utf-8" },
    { name: "Cache-Control", value: "no-store" },
  ];
  const pngHeaders = [
    { name: "Content-Type", value: "image/png" },
    { name: "Cache-Control", value: "public, max-age=3600" },
  ];

  const olympusSeries = Array.from({ length: 24 }, (_, idx) => {
    const n = idx + 1;
    return {
      id: 1000 + n,
      slug: `serie-demo-${n}`,
      title: `Serie Demo ${n}`,
      cover_url: `https://cdn-mock.mangatotal.test/cover-${n}.png`,
      status: "Activo",
      chapter_count: 35,
      type: "comic",
      total_views: 5000 - n,
      monthly_views: 900 - n,
      url_original: `https://olympusxyz.com/series/comic-serie-demo-${n}`,
    };
  });

  const tioSeries = Array.from({ length: 24 }, (_, idx) => {
    const n = idx + 1;
    return {
      slug: `anime-demo-${n}`,
      title: `Anime Demo ${n}`,
      cover_url: `https://cdn-mock.mangatotal.test/cover-anime-${n}.png`,
      type: "TV",
      status: "En emisión",
      url_original: `https://tioanime.com/anime/anime-demo-${n}`,
    };
  });

  const savedExtBiblioteca = Array.from({ length: 16 }, (_, idx) => {
    const n = idx + 1;
    return {
      source: "olympus",
      external_id: `serie-demo-${n}`,
      slug: `serie-demo-${n}`,
      title: `Serie Demo ${n}`,
      cover_url: `https://cdn-mock.mangatotal.test/cover-${n}.png`,
      type: "comic",
      last_chapter_name: "10",
      last_page_number: 2,
      href: `/externo/olympus/serie-demo-${n}`,
      href_continuar: `/leer-externo/olympus/${100 + n}?slug=serie-demo-${n}&cap=10&tipo=comic&page=2`,
      created_at: "2026-10-01T10:00:00.000Z",
      updated_at: "2026-11-20T10:00:00.000Z",
    };
  });

  return function resolveMock(rawUrl, resourceType) {
    const u = new URL(rawUrl);
    if (u.hostname === "cdn-mock.mangatotal.test") {
      const body = u.pathname.includes("/page-") ? pagePng : coverPng;
      return { status: 200, headers: pngHeaders, body };
    }
    if (u.hostname !== "127.0.0.1" && u.hostname !== "localhost") {
      if (resourceType === "Image") return { status: 200, headers: pngHeaders, body: coverPng };
      if (resourceType === "Stylesheet") return { status: 200, headers: [{ name: "Content-Type", value: "text/css" }], body: Buffer.from("") };
      return { status: 200, headers: jsonHeaders, body: Buffer.from("{}") };
    }
    if (!u.pathname.startsWith("/api/")) return null;

    if (u.pathname === "/api/images/mock/cover.png") {
      return { status: 200, headers: pngHeaders, body: coverPng };
    }

    const okJson = (data) => ({ status: 200, headers: jsonHeaders, body: Buffer.from(JSON.stringify(data)) });
    const p = u.pathname;

    if (p === "/api/auth/me") {
      return okJson({
        id: 1,
        nickname: "Nycks",
        is_admin: true,
        show_adult_content: true,
        anime_enabled: true,
        preferred_reading_mode: "cascade",
        email_verified: true,
      });
    }
    if (p === "/api/announcements" || p === "/api/tags" || p === "/api/favorites" || p === "/api/externo/generos") {
      return okJson([]);
    }
    if (p === "/api/progress/continue") {
      return okJson([
        {
          series: {
            id: 42,
            title: "Serie Local Prueba",
            slug: "serie-local-prueba",
            type: "manhwa",
            cover_image_path: "mock/cover.png",
            is_favorite: false,
          },
          chapter: { id: 501, number: 12, page_count: 20 },
          lastPageNumber: 5,
        },
      ]);
    }
    if (p === "/api/externo/biblioteca") {
      return okJson(savedExtBiblioteca);
    }
    if (p === "/api/externo/historial") {
      return okJson([]);
    }
    if (p === "/api/externo/progreso") {
      return okJson({
        saved: true,
        last_chapter_id: "101",
        last_chapter_name: "10",
        last_page_number: 1,
        read_through_number: 10,
        chapters: [{ id: "101", page: 1 }],
      });
    }
    if (p === "/api/externo/olympus/filtros") {
      return okJson({
        generos: [{ id: 1, name: "Acción" }],
        estados: [{ id: 1, name: "Activo" }],
        tipos: [{ id: "comic", name: "Cómic" }],
        ordenes: [
          { id: "novedades", name: "Nuevos lanzamientos" },
          { id: "populares", name: "Populares" },
          { id: "az", name: "A–Z" },
        ],
      });
    }
    if (p === "/api/externo/olympus/series") {
      const page = Number(u.searchParams.get("page") || "1") || 1;
      return okJson({ series: olympusSeries, page, last_page: 25, total: 600 });
    }
    if (p.startsWith("/api/externo/olympus/series/")) {
      const slug = decodeURIComponent(p.split("/").pop() || "serie-demo-1");
      return okJson({
        serie: {
          id: 1001,
          slug,
          title: slug === "serie-demo-1" ? "Serie Demo 1" : `Serie ${slug}`,
          cover_url: "https://cdn-mock.mangatotal.test/cover-1.png",
          status: "Activo",
          chapter_count: 35,
          type: "comic",
          url_original: `https://olympusxyz.com/series/comic-${slug}`,
          summary: "Sinopsis de prueba para verificar navegación y scroll.",
          genres: ["Acción", "Fantasía"],
          team: "Olympus Scanlation",
          rating: 9.2,
          first_chapter: { id: 100, name: "1" },
        },
        chapters: [
          { id: 101, name: "10", published_at: "2026-11-20T12:00:00Z", team: "Olympus Scanlation" },
          { id: 100, name: "9", published_at: "2026-11-19T12:00:00Z", team: "Olympus Scanlation" },
        ],
        total: 2,
      });
    }
    if (p.startsWith("/api/externo/olympus/capitulo/")) {
      return okJson({
        id: 101,
        name: "10",
        title: "Capítulo 10",
        pages: [1, 2, 3, 4, 5].map((i) => `https://cdn-mock.mangatotal.test/page-${i}.png`),
        prev: { id: 100, name: "9" },
        next: { id: 102, name: "11" },
        url_original: "https://olympusxyz.com/capitulo/10/comic-serie-demo-1",
        slug: "serie-demo-1",
      });
    }
    if (p === "/api/anime/externo/biblioteca") return okJson([]);
    if (p === "/api/anime/externo/historial") return okJson({ historial: [], continuar: [] });
    if (p === "/api/anime/externo/progreso") return okJson({ episodes: [] });
    if (p === "/api/anime/tioanime") {
      const page = Number(u.searchParams.get("page") || "1") || 1;
      return okJson({ series: tioSeries, page, lastPage: 8, total: 192 });
    }
    if (p.startsWith("/api/anime/tioanime/")) {
      const slug = decodeURIComponent(p.split("/").pop() || "anime-demo-1");
      return okJson({
        id: "777",
        slug,
        title: slug === "anime-demo-1" ? "Anime Demo 1" : `Anime ${slug}`,
        alternative_title: null,
        description: "Sinopsis de anime de prueba.",
        cover_url: "https://cdn-mock.mangatotal.test/cover-anime-1.png",
        type: "TV",
        status: "En emisión",
        genres: ["Acción", "Aventura"],
        season: "Otoño",
        year: "2026",
        total_episodes: 12,
        episodes: [
          {
            id: "777:1",
            number: "1",
            title: "Episodio 1",
            image_url: "https://cdn-mock.mangatotal.test/cover-anime-1.png",
            published_at: "2026-11-20",
          },
        ],
        page: 1,
        last_page: 1,
        url_original: `https://tioanime.com/anime/${slug}`,
      });
    }
    if (p === "/api/anime") {
      return okJson({
        pageInfo: { total: 10, currentPage: 1, lastPage: 1, hasNextPage: false },
        media: [],
      });
    }
    if (p === "/api/anime/jkanime") return okJson({ series: [], page: 1, lastPage: 1 });
    if (p === "/api/anime/mundodonghua") return okJson({ series: [], page: 1, lastPage: 1 });
    if (p === "/api/anime/hentaitv") return okJson({ series: [], page: 1, lastPage: 1 });
    if (p === "/api/series" || p === "/api/top-semanal") return okJson([]);
    if (p === "/api/analytics") return okJson({ ok: true });
    return okJson({});
  };
}

function killTree(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" });
    } else {
      proc.kill("SIGKILL");
    }
  } catch {}
}

// El SSR del layout consulta la sesión en la base: sin una base accesible desde
// esta máquina `next start` responde 500. Por eso el E2E es opcional, como las
// pruebas en vivo de verificar-referencias-lectura: MANGATOTAL_TEST_E2E=1.
test("E2E real (Edge CDP): flujos Lectura, Cascada sub-página, Anime aislado + MobileNav y Biblioteca", {
  timeout: 120_000,
  skip: process.env.MANGATOTAL_TEST_E2E === "1" ? false : "definir MANGATOTAL_TEST_E2E=1 con base de datos accesible",
}, async () => {
  assert.ok(fs.existsSync(path.join(RAIZ, ".next/BUILD_ID")), "Falta .next/BUILD_ID — ejecutá npx next build primero");
  const edgePath = findEdgePath();
  assert.ok(edgePath, "No se encontró Microsoft Edge / Chrome para la prueba E2E real");

  const nextPort = await getFreePort();
  const cdpPort = await getFreePort();
  const baseUrl = `http://127.0.0.1:${nextPort}`;
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), "mt-edge-mihon-"));

  let nextProc = null;
  let edgeProc = null;
  let cdp = null;

  try {
    nextProc = spawn(
      process.execPath,
      [path.join(RAIZ, "node_modules/next/dist/bin/next"), "start", "-p", String(nextPort), "-H", "127.0.0.1"],
      { cwd: RAIZ, stdio: "ignore" }
    );
    await waitForHttp(`${baseUrl}/login`, 25_000);

    edgeProc = spawn(
      edgePath,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1440,900",
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${tmpProfile}`,
        "about:blank",
      ],
      { stdio: "ignore" }
    );

    let wsUrl = null;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline && !wsUrl) {
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
        const targets = await res.json();
        const page = targets.find((t) => t.type === "page");
        if (page?.webSocketDebuggerUrl) wsUrl = page.webSocketDebuggerUrl;
      } catch {}
      if (!wsUrl) await sleep(120);
    }
    assert.ok(wsUrl, "Edge CDP no expuso pestaña depurable");

    cdp = await connectCdp(wsUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const apiRequests = [];
    const responder = buildMockResponder();
    await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });

    cdp.on("Fetch.requestPaused", async (params) => {
      const url = params.request.url;
      const u = new URL(url);
      if (u.pathname.startsWith("/api/") && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) {
        apiRequests.push({ method: params.request.method, path: u.pathname + u.search });
      }
      const mock = responder(url, params.resourceType);
      try {
        if (mock) {
          await cdp.send("Fetch.fulfillRequest", {
            requestId: params.requestId,
            responseCode: mock.status,
            responseHeaders: mock.headers,
            body: mock.body.toString("base64"),
          });
        } else {
          await cdp.send("Fetch.continueRequest", { requestId: params.requestId });
        }
      } catch {}
    });

    const evalJs = async (expression) => {
      const res = await cdp.send("Runtime.evaluate", {
        expression: `(() => { ${expression} })()`,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.exceptionDetails) {
        throw new Error(`JS error: ${res.exceptionDetails.text} ${JSON.stringify(res.exceptionDetails.exception || {})}`);
      }
      return res.result?.value;
    };

    const waitFor = async (predicateExpr, desc, timeoutMs = 15_000) => {
      const limit = Date.now() + timeoutMs;
      let lastVal = null;
      while (Date.now() < limit) {
        lastVal = await evalJs(`return (${predicateExpr});`);
        if (lastVal) return lastVal;
        await sleep(90);
      }
      const snap = await evalJs("return { href: location.href, y: window.scrollY, h1: document.querySelector('h1')?.textContent || '' };").catch(() => null);
      throw new Error(`Timeout esperando: ${desc} (último=${JSON.stringify(lastVal)}, estado=${JSON.stringify(snap)})`);
    };

    const navigate = async (url) => {
      await cdp.send("Page.navigate", { url });
      await waitFor("document.readyState === 'complete'", `carga completa ${url}`);
    };

    // ── Flujo 1: Catálogo Lectura pág. 20 + scroll + ficha + Atrás ──
    await navigate(`${baseUrl}/explorar?fuente=olympus&p=20&oly_orden=populares`);
    await waitFor(
      "document.querySelectorAll('a[href^=\"/externo/olympus/\"]').length >= 24 && document.documentElement.scrollHeight > 1200",
      "catálogo Olympus pág. 20 con 24 tarjetas"
    );
    await evalJs(`
      window.scrollTo({ top: 650, behavior: "instant" });
      window.dispatchEvent(new Event("scroll"));
    `);
    await sleep(300);
    const yCatalogoAntes = await evalJs("return window.scrollY;");
    assert.ok(yCatalogoAntes >= 500, `Expected catalog scroll >= 500, got ${yCatalogoAntes}`);

    await evalJs(`document.querySelector('a[href="/externo/olympus/serie-demo-1"]').click();`);
    await waitFor(
      "location.pathname === '/externo/olympus/serie-demo-1' && /Serie Demo 1/.test(document.querySelector('h1')?.textContent || '') && document.querySelector('a[href*=\"/leer-externo/olympus/101\"]')",
      "ficha serie-demo-1"
    );

    await evalJs("window.history.back();");
    await waitFor(
      "location.pathname === '/explorar' && document.querySelectorAll('a[href^=\"/externo/olympus/\"]').length >= 24 && window.scrollY >= 400",
      "vuelta a catálogo pág. 20 con scroll restaurado"
    );
    const qsTrasVolver = await evalJs("return location.search;");
    const spLectura = new URLSearchParams(qsTrasVolver);
    assert.equal(spLectura.get("fuente"), "olympus");
    assert.equal(spLectura.get("p"), "20");
    assert.equal(spLectura.get("oly_orden"), "populares");

    // ── Flujo 2: Lector Cascada/Webtoon sub-página + flush + BotonVolver + reapertura ──
    await evalJs(`document.querySelector('a[href="/externo/olympus/serie-demo-1"]').click();`);
    await waitFor("document.querySelector('a[href*=\"/leer-externo/olympus/101\"]')", "enlace capítulo 10");
    await evalJs(`document.querySelector('a[href*="/leer-externo/olympus/101"]').click();`);

    await waitFor(
      `(() => {
        const imgs = Array.from(document.querySelectorAll('[data-od-id="cascade-reader"] img'));
        return imgs.length === 5 && imgs.every((img) => img.complete && img.naturalHeight === 1600);
      })()`,
      "carga de 5 imágenes 800x1600 en CascadeReader"
    );
    await sleep(300);

    const targetY = await evalJs(`
      const p2 = document.querySelector('[data-page="2"]');
      const r = p2.getBoundingClientRect();
      const y = Math.round(window.scrollY + r.top - 56 + r.height * 0.48);
      window.scrollTo({ top: y, behavior: "instant" });
      window.dispatchEvent(new Event("scroll"));
      return y;
    `);
    await sleep(450);
    await evalJs(`
      window.__mtFlushProgress?.();
      document.dispatchEvent(new Event("visibilitychange"));
    `);
    await sleep(150);

    const savedPosRaw = await evalJs(`
      const mapa = JSON.parse(localStorage.getItem("mangatotal:lector:posiciones") || "{}");
      return mapa["cap:olympus:serie-demo-1:101"] || null;
    `);
    assert.ok(savedPosRaw, "No se guardó la posición sub-página del capítulo");
    assert.equal(savedPosRaw.page, 2);
    assert.ok(savedPosRaw.ratio > 0.25 && savedPosRaw.ratio < 0.8, `Ratio inesperado: ${savedPosRaw.ratio}`);

    await evalJs(`
      const linkVolver = Array.from(document.querySelectorAll('a[href^="/externo/olympus/"]')).find((a) => /Volver/.test(a.textContent || ""));
      if (!linkVolver) throw new Error("Falta BotonVolver");
      linkVolver.click();
    `);
    await waitFor("location.pathname === '/externo/olympus/serie-demo-1'", "retorno sin bucle desde BotonVolver");
    await sleep(350);
    assert.equal(await evalJs("return location.pathname;"), "/externo/olympus/serie-demo-1");

    // Reabrir capítulo SIN ?page= y verificar restauración exacta de página 2 + sub-página
    await navigate(`${baseUrl}/leer-externo/olympus/101?slug=serie-demo-1&cap=10&tipo=comic`);
    await waitFor(
      `(() => {
        const imgs = Array.from(document.querySelectorAll('[data-od-id="cascade-reader"] img'));
        return imgs.length === 5 && imgs.every((img) => img.complete && img.naturalHeight === 1600);
      })()`,
      "recarga de imágenes en reapertura"
    );
    await waitFor(`Math.abs(window.scrollY - ${targetY}) < 260`, "restauración vertical sub-página al reabrir capítulo");
    const posTrasReabrir = await evalJs(`
      const mapa = JSON.parse(localStorage.getItem("mangatotal:lector:posiciones") || "{}");
      return mapa["cap:olympus:serie-demo-1:101"] || null;
    `);
    assert.equal(posTrasReabrir.page, 2);
    assert.ok(posTrasReabrir.ratio > 0.25, `El montaje transitorio pisó el ratio guardado (${posTrasReabrir.ratio})`);

    // ── Flujo 3: Aislamiento Anime + TioAnime pág. 3 + filtro + VolverFuente + MobileNav ──
    await navigate(`${baseUrl}/explorar?seccion=animada`);
    await waitFor("/Anime|TioAnime|JKAnime/.test(document.body.innerText)", "portada Anime");
    apiRequests.length = 0;

    await navigate(`${baseUrl}/explorar?seccion=animada&anime_fuente=tioanime&vista=catalogo&anime_page=3&status=1`);
    await waitFor(
      "document.querySelectorAll('a[href^=\"/explorar/tioanime/\"]').length >= 20 && document.documentElement.scrollHeight > 1100",
      "catálogo TioAnime pág. 3 con status=1"
    );
    const fugasLectura = apiRequests.filter((r) =>
      /^\/api\/(externo|series|top-semanal|favorites|progress)(\/|$)/.test(r.path)
    );
    assert.equal(fugasLectura.length, 0, `Fugas hacia APIs de Lectura en Anime: ${JSON.stringify(fugasLectura)}`);

    await evalJs(`
      window.scrollTo({ top: 500, behavior: "instant" });
      window.dispatchEvent(new Event("scroll"));
    `);
    await sleep(300);
    await evalJs(`document.querySelector('a[href="/explorar/tioanime/anime-demo-1"]').click();`);
    await waitFor(
      "location.pathname === '/explorar/tioanime/anime-demo-1' && /Anime Demo 1/.test(document.querySelector('h1')?.textContent || '')",
      "ficha anime-demo-1"
    );

    await evalJs(`
      const link = Array.from(document.querySelectorAll('a')).find((a) => /Explorar anime/i.test(a.textContent || ""));
      if (!link) throw new Error("Falta VolverFuente Anime");
      link.click();
    `);
    await waitFor(
      "location.pathname === '/explorar' && document.querySelectorAll('a[href^=\"/explorar/tioanime/\"]').length >= 20 && window.scrollY >= 280",
      "retorno a TioAnime pág. 3 con scroll restaurado"
    );
    const spAnime = new URLSearchParams(await evalJs("return location.search;"));
    assert.equal(spAnime.get("seccion"), "animada");
    assert.equal(spAnime.get("anime_fuente"), "tioanime");
    assert.equal(spAnime.get("anime_page"), "3");
    assert.equal(spAnime.get("status"), "1");

    // Comprobación MobileNav (390x844) sobre TioAnime: "En emisión" usa status=1
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await waitFor("document.querySelector('nav[data-od-id=\"mobile-nav\"]')", "MobileNav visible");
    const mobileHrefs = await evalJs(`
      return Array.from(document.querySelectorAll('nav[data-od-id="mobile-nav"] a')).map((a) => ({
        label: (a.textContent || "").trim(),
        href: a.getAttribute("href") || "",
      }));
    `);
    const linkEmision = mobileHrefs.find((i) => i.label === "En emisión");
    const linkCatalogo = mobileHrefs.find((i) => i.label === "Catálogo");
    assert.ok(linkEmision && linkEmision.href.includes("status=1"), `En emisión inválido: ${JSON.stringify(linkEmision)}`);
    assert.equal(linkEmision.href.includes("status=emision"), false);
    assert.ok(linkCatalogo && linkCatalogo.href.includes("anime_page=3"), `Catálogo móvil perdió página: ${JSON.stringify(linkCatalogo)}`);

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // ── Flujo 4: Biblioteca scroll + enlace /serie/ (nunca /series/) ──
    await navigate(`${baseUrl}/biblioteca`);
    await waitFor(
      "document.querySelector('a[href=\"/serie/serie-local-prueba\"]') && document.querySelectorAll('a[href^=\"/externo/olympus/\"]').length >= 10 && document.documentElement.scrollHeight > 1000",
      "biblioteca con serie local y tarjetas externas"
    );
    const enlacesRotosSeries = await evalJs(`return document.querySelectorAll('a[href^="/series/"]').length;`);
    assert.equal(enlacesRotosSeries, 0, "Se encontró un enlace roto /series/ en biblioteca");

    await evalJs(`
      window.scrollTo({ top: 450, behavior: "instant" });
      window.dispatchEvent(new Event("scroll"));
    `);
    await sleep(300);
    await evalJs(`document.querySelector('a[href="/externo/olympus/serie-demo-1"]').click();`);
    await waitFor("location.pathname === '/externo/olympus/serie-demo-1'", "navegación desde biblioteca hacia ficha");
    await evalJs("window.history.back();");
    await waitFor(
      "location.pathname === '/biblioteca' && window.scrollY >= 250",
      "restauración de scroll en /biblioteca al volver"
    );
  } finally {
    if (cdp) cdp.close();
    killTree(edgeProc);
    killTree(nextProc);
    await sleep(250);
    try {
      fs.rmSync(tmpProfile, { recursive: true, force: true });
    } catch {}
  }
});
