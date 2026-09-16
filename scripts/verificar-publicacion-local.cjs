// node --test scripts/verificar-publicacion-local.cjs
// No publica ni modifica archivos: ejecuta el publicador con herramientas simuladas.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { fileURLToPath, pathToFileURL } = require("node:url");
const raiz = path.resolve(__dirname, "..");
const leer = (p) => fs.readFileSync(path.join(raiz, p), "utf8");
const version = JSON.parse(leer("mobile/version.json"));
const firma = "c3f172c18a928831b3d7bbc00343793ec6dae1e44eeb90fab331ef178506700f";

function publicar({ paquete = "app.mangatotal.android", huella = firma, codigo = version.versionCode,
  nombre = version.versionName, firmaValida = true } = {}) {
  let copias = 0;
  const archivo = path.join(raiz, "mobile/scripts/publicar-apk.mjs");
  const codigoScript = fs.readFileSync(archivo, "utf8")
    .replace(/^import .*;\r?\n/gm, "")
    .replaceAll("import.meta.url", JSON.stringify(pathToFileURL(archivo).href));
  vm.runInNewContext(codigoScript, {
    path, fileURLToPath, os: { homedir: () => raiz },
    process: { env: { ANDROID_HOME: raiz }, platform: "win32" }, console: { log() {} },
    fs: {
      existsSync: () => true,
      readdirSync: () => [{ name: "36.0.0", isDirectory: () => true }],
      readFileSync: () => JSON.stringify(version),
      copyFileSync: () => { copias++; },
    },
    spawnSync: (_comando, args) => args.includes("verify")
      ? { status: firmaValida ? 0 : 1, stdout: "Signer #1 certificate SHA-256 digest: " + huella, stderr: "" }
      : { status: 0, stdout: `package: name='${paquete}' versionCode='${codigo}' versionName='${nombre}'`, stderr: "" },
  });
  return copias;
}

test("publica solo el paquete, versión y firma oficiales", () => assert.equal(publicar(), 1));
test("rechaza el APK de pruebas aunque coincidan versión y firma", () => {
  assert.throws(() => publicar({ paquete: "app.mangatotal.android.pruebaplay" }), /paquete incompatible/);
});
test("rechaza firma distinta o APK corrupto", () => {
  assert.throws(() => publicar({ huella: "0".repeat(64) }), /firma incompatible/);
  assert.throws(() => publicar({ firmaValida: false }));
});
test("rechaza versión o nombre desincronizados", () => {
  assert.throws(() => publicar({ codigo: version.versionCode - 1 }), /version.json exige/);
  assert.throws(() => publicar({ nombre: "0.0.0" }), /version.json exige/);
});
test("Explorar usa imágenes nativas en Ikigai, no cambia el transporte de Olympus", () => {
  const pagina = leer("src/app/(reader)/explorar/page.tsx");
  const tarjeta = (fuente) => pagina.split("href={`/externo/" + fuente + "/${s.slug}`}" )[1]?.split("</Link>")[0];
  assert.match(tarjeta("ikigai"), /<ImagenFuente\s/);
  assert.doesNotMatch(tarjeta("ikigai"), /<img\s/);
  assert.match(tarjeta("olympus"), /<img\s/);
});
test("ambos puentes permiten solo el host nuevo de Ikigai, no radiot.space entero", () => {
  for (const ruta of ["desktop/src-tauri/src/main.rs", "mobile/patches/FuentesPlugin.java"]) {
    const codigo = leer(ruta);
    assert.ok(codigo.includes('"viralikigai.radiot.space"'));
    assert.ok(!codigo.includes('"radiot.space"'));
  }
});
