// Datos artificiales: comprueba el reintento de sesión sin tocar cuentas.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");

function modulo(fetch) {
  const exports = {};
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/jkanime.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(codigo, { exports, fetch, Response, Headers, URL, URLSearchParams, Buffer, console });
  return exports;
}

const catalogo = `<!doctype html><script>var animes = ${JSON.stringify({
  current_page: 1,
  last_page: 2,
  total: 31,
  data: [{ id: 7, slug: "anime-qa", title: "Anime QA", image: "https://cdn.jkdesa.com/qa.jpg", type: "TV", status: "emision" }],
})};</script>`;

test("un 403 reintenta con la sesión temporal entregada por la portada", async () => {
  const pedidos = [];
  const fetch = async (url, init = {}) => {
    pedidos.push({ url: String(url), headers: new Headers(init.headers) });
    if (pedidos.length === 1) return new Response("prohibido", { status: 403 });
    if (pedidos.length === 2) {
      const headers = new Headers();
      headers.append("set-cookie", "XSRF-TOKEN=token; Path=/; Secure");
      headers.append("set-cookie", "jkanime_session=sesion; Path=/; HttpOnly");
      return new Response("portada", { status: 200, headers });
    }
    return new Response(catalogo, { status: 200 });
  };

  const resultado = await modulo(fetch).catalogoJkanime({}, true);
  assert.equal(resultado.series[0].title, "Anime QA");
  assert.equal(pedidos.length, 3);
  assert.equal(pedidos[1].url, "https://jkanime.net/");
  assert.match(pedidos[2].headers.get("cookie"), /XSRF-TOKEN=token/);
  assert.match(pedidos[2].headers.get("cookie"), /jkanime_session=sesion/);
  assert.equal(pedidos[2].headers.get("referer"), "https://jkanime.net/");
});

test("una respuesta normal no abre la portada adicional", async () => {
  let pedidos = 0;
  const fetch = async () => { pedidos += 1; return new Response(catalogo, { status: 200 }); };
  const resultado = await modulo(fetch).catalogoJkanime({}, false);
  assert.equal(resultado.total, 31);
  assert.equal(pedidos, 1);
});
