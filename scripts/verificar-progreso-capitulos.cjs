// node --test scripts/verificar-progreso-capitulos.cjs
// Datos artificiales: no accede a la cuenta ni a la base de datos.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const modulo = {};
const source = fs.readFileSync(path.join(__dirname, "../src/components/library/useProgresoSerie.ts"), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(code, { exports: modulo, require: () => ({ useEffect() {}, useState() {} }), Number });

test("leer 1 y saltar a 3 no marca 2 y conserva ambas páginas", () => {
  const progreso = { ultimoId: "3", ultimoNumero: 3, ultimaPagina: 9, guardada: true,
    paginas: { "1": 6, "3": 9 }, readThroughNumber: null };
  assert.equal(modulo.capituloLeido(progreso, "1", 1), true);
  assert.equal(modulo.capituloLeido(progreso, "2", 2), false);
  assert.equal(modulo.capituloLeido(progreso, "3", 3), true);
  assert.equal(modulo.paginaCapitulo(progreso, "1"), "page=6");
  assert.equal(modulo.paginaCapitulo(progreso, "3"), "page=9");
});

test("volver al 1 no borra el gris histórico hasta el 100", () => {
  const progreso = { ultimoId: "1", ultimoNumero: 1, ultimaPagina: 2, guardada: true,
    paginas: { "1": 2 }, readThroughNumber: 100 };
  assert.equal(modulo.capituloLeido(progreso, "1", 1), true);
  assert.equal(modulo.capituloLeido(progreso, "99", 99), true);
  assert.equal(modulo.capituloLeido(progreso, "101", 101), false);
  assert.match(modulo.estiloCapitulo(true, true), /bg-.*opacity-55/);
});
