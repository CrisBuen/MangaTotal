const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, URL, console, process, require: n => mocks[n] || (n === "@/lib/androidVariant" ? load("src/lib/androidVariant.ts") : require(n)) });
  return exports;
}
test("arte: solo obra exacta, no temporadas parecidas, ambigüedad ni contenido adulto", () => {
  const { elegirArteAnime } = load("src/lib/animeArtwork.ts");
  const image = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/a.jpg";
  const m = { id: 12, isAdult: false, title: { romaji: "Serie: II!" }, coverImage: { extraLarge: image } };
  assert.equal(elegirArteAnime("Serie II", [m]).cover, image);
  assert.equal(elegirArteAnime("Serie III", [m]).cover, null);
  assert.equal(elegirArteAnime("Serie II", [m, { ...m, id: 13 }]).cover, null);
  assert.equal(elegirArteAnime("Serie II", [{ ...m, isAdult: true }]).cover, null);
  assert.equal(elegirArteAnime("Serie II", [{ ...m, bannerImage: "https://evil.test/image.jpg" }]).banner, null);
});
test("invitados: GET públicos, cuentas y escrituras conservan autenticación", async () => {
  const { middleware } = load("src/middleware.ts", { "@/lib/requestSecurity": { origenPermitido: () => true } });
  const request = (p, method = "GET", ua = "Mozilla/5.0") => ({ method, headers: new Headers({ "user-agent": ua }), cookies: { get: () => undefined }, nextUrl: Object.assign(new URL("https://example.test" + p), { clone() { return new URL(this.href); } }) });
  for (const p of ["/lectura", "/leer/1", "/leer-externo/ikigai/1", "/explorar/jkanime/obra/1", "/api/anime/jkanime", "/api/anime/tioanime/obra/1", "/api/anime/arte", "/api/externo/capitulos/id"]) {
    const r = await middleware(request(p)); assert.equal(r.headers.get("x-middleware-next"), "1", p);
  }
  for (const p of ["/api/externo/biblioteca", "/api/anime/externo/progreso", "/api/anime/externo/biblioteca", "/api/admin/users"]) {
    for (const method of ["GET", "PUT", "PATCH", "DELETE"]) assert.equal((await middleware(request(p, method))).status, 401, method + p);
  }
  assert.equal((await middleware(request("/api/anime/jkanime", "POST"))).status, 401);
  assert.equal((await middleware(request("/api/admin/users", "GET", "MangaTotalApp/24 MangaTotalChannel/play"))).status, 404);
});
test("activar anime en Play y preferencias Android no se eluden con la navegación", async () => {
  let ua = "Mozilla/5.0";
  const { animePublicoPermitido } = load("src/lib/animeAcceso.ts", {
    "next/headers": { headers: async () => new Headers({ "user-agent": ua }) },
    "@/lib/appVersion": { isAndroidApp: value => value.includes("MangaTotalApp/") },
  });
  assert.equal(await animePublicoPermitido(null), true);
  ua = "MangaTotalApp/24 MangaTotalChannel/play";
  assert.equal(await animePublicoPermitido(null), false);
  assert.equal(await animePublicoPermitido({ animeEnabled: true }), false);
  assert.equal(await animePublicoPermitido({ animeEnabled: true, animeTermsAcceptedAt: new Date() }), true);
  ua = "MangaTotalApp/24 MangaTotalChannel/local";
  assert.equal(await animePublicoPermitido(null), true);
  assert.equal(await animePublicoPermitido({ animeEnabled: false }), false);
});
