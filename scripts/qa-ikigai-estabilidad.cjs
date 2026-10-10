// Pruebas DOM reales del adaptador, sin cuentas ni escrituras en la fuente.
// PLAYWRIGHT_PATH apunta a una instalación existente; IKIGAI_LIVE=1 consulta una obra pública.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const ts = require("typescript");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const root = path.resolve(__dirname, "..");
const codigo = ts.transpileModule(fs.readFileSync(path.join(root, "src/lib/ikigai.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helpers = Object.fromEntries(["ikigaiPaginas", "imagenFuenteNativa"].map(name => ["./" + name, ts.transpileModule(fs.readFileSync(path.join(root, "src/lib", name + ".ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText]));
const ficha = (pagina, adulto = false, siguiente = false) => `<nav><a href="/series/?generos[]=906409527934582787">Adulto</a><a href="/series/?generos[]=1">Comedia</a></nav>
<article><h1>Obra de prueba</h1><img alt="Obra de prueba" src="https://image2.ikigaimangas.cloud/cover.webp"><p>Sinopsis propia.</p>
<a href="/series/?generos[]=906397894527549443">Romance</a><a href="/series/?generos[]=906397903933407235">Drama</a><a href="/series/?generos[]=906397903933407235">Drama</a>
${adulto ? '<a href="/series/?generos[]=906409527934582787">Contenido restringido</a>' : ""}</article>
${Array.from({ length: pagina === 3 ? 14 : 24 }, (_, i) => { const n = 62 - (pagina - 1) * 24 - i; return `<a href="/capitulo/${1210219148704710000n + BigInt(n)}/"><h3>Capítulo ${n}</h3><time>2026-10-01</time></a>`; }).join("")}
<a href="https://evil.example/series/obra/?pagina=300">No seguir</a><a href="/series/otra/?pagina=300">Otra obra</a>
${(siguiente ? [Math.min(3, pagina + 1)] : [1, 2, 3]).map(n => `<a href="/series/obra/?pagina=${n}">${n}</a>`).join("")}`;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  try {
    const page = await browser.newPage();
    await page.exposeFunction("textoFuente", async url => {
      const allowed = new URL(url);
      assert.equal(allowed.origin, "https://visorikigai.gettocaboca.com");
      const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
      assert.equal(r.status, 200);
      const html = await r.text();
      if (allowed.pathname.startsWith("/capitulo/")) console.log("Visor real:", r.url, html.match(/<title>(.*?)<\/title>/s)?.[1], "bytes:", html.length, "q:key:", (html.match(/q:key/g) || []).length);
      return html;
    });
    const result = await page.evaluate(async ({ codigo, paginas, live, helpers }) => {
      let play = false, actual = paginas, consultas = [], parciales = [];
      const exports = {};
      const require = nombre => {
        if (nombre === "./fuenteNativa") return { traerDocumento: async url => {
          consultas.push(url);
          const html = actual ? actual[Number(new URL(url).searchParams.get("pagina") || 1) - 1] : await window.textoFuente(url);
          await new Promise(r => setTimeout(r, 5));
          const doc = new DOMParser().parseFromString(html, "text/html");
          return doc;
        } };
        if (nombre === "./appVersion") return { isPlayStoreApp: () => play };
        if (nombre === "./referenciasLectura") return { recuperarIdIkigai: id => id };
        if (nombre === "./androidCache") return { cargarConCacheAndroid: (_, cargar) => cargar(new AbortController().signal), guardarCacheAndroid: async () => {} };
        if (helpers[nombre]) { const exp = {}; new Function("exports", "require", helpers[nombre])(exp, require); return exp; }
        throw Error(nombre);
      };
      new Function("exports", "require", codigo)(exports, require);
      play = true;
      const f = await exports.serieIkigai("obra", false, parcial => parciales.push({ completa: parcial.completa, count: parcial.capitulos.length, llamadas: consultas.length }));
      const normal = { count: f.capitulos.length, ids: f.capitulos.map(c => c.id), generos: f.generos, numeros: f.capitulos.map(c => c.numero), consultas: consultas.length, parciales };
      actual = paginas.map(p => p.replace("Sinopsis propia.", "Sinopsis propia.").replace("</article>", '<a href="/series/?generos[]=906409527934582787">Restringido</a></article>'));
      consultas = [];
      let rechazo = "";
      try { await exports.serieIkigai("obra", true); } catch (e) { rechazo = e.message; }
      const adulto = { rechazo, consultas: consultas.length };
      let real;
      if (live) {
        actual = null; consultas = []; play = true;
        const inicio = performance.now();
        let primera = 0;
        const obra = await exports.serieIkigai("ya-puedo-llorar", true, () => { primera = performance.now() - inicio; });
        const cap = await exports.capituloIkigai(obra.capitulos[0].id);
        real = { title: obra.title, generos: obra.generos, capitulos: obra.capitulos.length, paginas: cap.paginas.length, primeraMs: Math.round(primera), totalMs: Math.round(performance.now() - inicio), peticiones: consultas.length };
      }
      return { normal, adulto, real };
    }, { codigo, helpers, paginas: [1, 2, 3].map(n => ficha(n)), live: process.env.IKIGAI_LIVE === "1" });
    assert.equal(result.normal.count, 62); assert.equal(result.normal.consultas, 3);
    assert.deepEqual(result.normal.generos, ["Romance", "Drama"]);
    assert.equal(result.normal.numeros[0], "1"); assert.equal(result.normal.numeros[61], "62");
    assert.ok(result.normal.ids.every(id => /^\d{19}$/.test(id)));
    assert.deepEqual(result.normal.parciales, [{ completa: false, count: 24, llamadas: 1 }]);
    assert.match(result.adulto.rechazo, /Google Play/); assert.equal(result.adulto.consultas, 1);
    console.log(JSON.stringify({ ...result, normal: { ...result.normal, ids: `${result.normal.ids.length} IDs exactos`, numeros: "1 a 62" } }, null, 2));
    if (result.real) { assert.ok(result.real.capitulos > 0); assert.ok(result.real.paginas > 0); }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
