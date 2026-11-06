// Ejecutar: node --test scripts/verificar-catharsis-v3.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

test("Mapeo de identidad en biblioteca reconoce Catharsis por slug", () => {
  const ts = require("typescript");
  const fs = require("node:fs");
  const vm = require("node:vm");

  const archivo = path.resolve(__dirname, "../src/lib/identidadBiblioteca.ts");
  const codigo = ts.transpileModule(fs.readFileSync(archivo, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const salida = {};
  vm.runInNewContext(codigo, {
    exports: salida,
    require: (mod) => {
      if (mod === "./referenciasLectura") {
        return { normalizarFuenteLectura: (s) => s.toLowerCase() };
      }
      return require(mod);
    },
    console,
  });

  const { buscarReferenciaBiblioteca } = salida;
  const guardada = {
    source: "catharsis",
    external_id: "0032d32b-554d-4d7b-883b-ad88c10a56ac",
    slug: "bailarin-de-ballet",
    type: "comic",
    last_chapter_name: "8",
  };

  // Coincidencia exacta por external_id
  assert.equal(
    buscarReferenciaBiblioteca([guardada], "catharsis", "0032d32b-554d-4d7b-883b-ad88c10a56ac"),
    guardada
  );
  // Coincidencia por slug
  assert.equal(
    buscarReferenciaBiblioteca([guardada], "catharsis", "bailarin-de-ballet"),
    guardada
  );
  // No coincide otra fuente
  assert.equal(
    buscarReferenciaBiblioteca([guardada], "ikigai", "bailarin-de-ballet"),
    null
  );
});

test("Integración viva con Catharsis v3: Catálogo, Ficha y Lector", async () => {
  const ts = require("typescript");
  const fs = require("node:fs");
  const vm = require("node:vm");

  const ruta = path.resolve(__dirname, "../src/lib/catharsisServidor.ts");
  const codigo = ts.transpileModule(fs.readFileSync(ruta, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;

  const salida = {};
  vm.runInNewContext(codigo, {
    exports: salida,
    require: (mod) => {
      if (mod === "@/lib/catharsis") {
        return {
          CW_WEB: "https://newcatharsis.dig-it.info",
          imagenCw: (id) => `https://direct-new-catha.catharsisfood.com/assets/${id}`,
        };
      }
      return require(mod);
    },
    console,
    fetch: globalThis.fetch,
    URL,
    URLSearchParams,
    Buffer,
    setTimeout,
    clearTimeout,
    crypto: require("node:crypto"),
  }, { filename: ruta });

  const { novedadesCwServidor, catalogoCwServidor, serieCwServidor, obtenerTicketPaginaCw, obtenerBytesPaginaCw } = salida;

  // 1. Catálogo Novedades
  const nov = await novedadesCwServidor(false);
  assert.ok(Array.isArray(nov) && nov.length > 0, "Novedades debe devolver una lista de series");
  const primera = nov[0];
  assert.ok(primera.id, "Cada serie debe tener un ID");
  assert.ok(primera.nombre, "Cada serie debe tener un nombre");
  assert.ok(primera.portada, "Cada serie debe tener portada");

  // 2. Catálogo General y Búsqueda
  const catalogo = await catalogoCwServidor(false);
  assert.ok(Array.isArray(catalogo) && catalogo.length > 0, "El catálogo general debe devolver series");
  const ballet = catalogo.find((s) => s.nombre.toLowerCase().includes("ballet"));
  assert.ok(ballet, "Debe contener una serie de ballet");

  // 3. Resolución de ficha por UUID o ID
  const ficha = await serieCwServidor(ballet.id);
  assert.ok(ficha.nombre, "La ficha debe tener nombre");
  assert.ok(ficha.capitulos.length > 0, "La ficha debe tener capítulos");
  assert.ok(ficha.capitulos[0].id, "El capítulo debe tener ID");
  assert.ok(ficha.capitulos[0].numero, "El capítulo debe tener número");

  // 4. Ticket de página y descifrado de imagen con serie pública sin restricción de login
  const koori = catalogo.find((s) => s.v3Id === 1038 || s.nombre.toLowerCase().includes("koori no jouheki"));
  assert.ok(koori, "Debe existir la serie pública Koori no Jouheki");
  const fichaKoori = await serieCwServidor(koori.id);
  const primerCap = fichaKoori.capitulos.find((c) => c.numero === "1" || c.numero === 1) || fichaKoori.capitulos[0];
  assert.ok(primerCap, "Debe existir un capítulo 1 o inicial");

  const ticket = await obtenerTicketPaginaCw(koori.v3Id || koori.id, primerCap.numero, 0);
  assert.ok(ticket.signedToken, "El ticket debe tener signedToken");
  assert.ok(ticket.scrambleKey, "El ticket debe tener scrambleKey");

  // El servidor solo retransmite bytes crudos (sin sharp, para no gastar
  // CPU de Vercel); el descifrado lo hace el dispositivo con Canvas
  const { bytes, ticket: t2 } = await obtenerBytesPaginaCw(koori.v3Id || koori.id, primerCap.numero, 1);
  assert.ok(bytes.byteLength > 1000, "La página cruda debe tener tamaño suficiente");
  assert.ok(t2.scrambleKey, "La clave de reordenamiento viaja junto a los bytes");
});
