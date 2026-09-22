// Regresión: el script pasivo de Cloudflare no debe bloquear fichas válidas.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const modulo = { exports: {} };
const codigo = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, "../src/lib/desafioHtml.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
vm.runInNewContext(codigo, { exports: modulo.exports });
const { esDesafioHtml } = modulo.exports;

const scriptPasivo = `<script>var a=document.createElement('script');
a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';</script>`;

for (const fuente of ["Ikigai", "LeerCapítulo"]) {
  test(fuente + ": acepta ficha y capítulo con detección pasiva", () => {
    assert.equal(esDesafioHtml(`<h1>${fuente}</h1><a href="/capitulo/1">Capítulo 1</a>${scriptPasivo}`), false);
    assert.equal(esDesafioHtml(`<img src="pagina.webp">${scriptPasivo}`), false);
  });
}

test("Sigue reconociendo la pantalla real de verificación HTTP 200", () => {
  assert.equal(esDesafioHtml("<title>Just a moment...</title>"), true);
  assert.equal(esDesafioHtml("<script>window._cf_chl_opt = {cType:'managed'};</script>"), true);
});

test("Una mención de Cloudflare o clases CSS no impide leer", () => {
  assert.equal(esDesafioHtml('<h1>Serie</h1><div class="cf-challenge">Ayuda</div>'), false);
});
