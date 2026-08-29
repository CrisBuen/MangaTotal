import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Las instalaciones directas 1.8.1 y anteriores usan esta firma. Android
// rechaza una actualización si el certificado cambia, aunque el package y
// el versionCode sean correctos.
const FIRMA_ACTUALIZACIONES =
  "c3f172c18a928831b3d7bbc00343793ec6dae1e44eeb90fab331ef178506700f";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apk = path.join(
  raiz,
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk",
);
const destino = path.resolve(
  raiz,
  "..",
  "public",
  "descargas",
  "MangaTotal-android.apk",
);
const version = JSON.parse(
  fs.readFileSync(path.join(raiz, "version.json"), "utf8"),
);

const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(
    process.env.LOCALAPPDATA ||
      path.join(os.homedir(), "AppData", "Local"),
    "Android",
    "Sdk",
  );
const herramientas = path.join(sdk, "build-tools");

if (!fs.existsSync(apk)) {
  throw new Error("No existe el APK compilado: " + apk);
}
if (!fs.existsSync(herramientas)) {
  throw new Error("No existen Android Build Tools en: " + herramientas);
}

const versiones = fs
  .readdirSync(herramientas, { withFileTypes: true })
  .filter((entrada) => entrada.isDirectory())
  .map((entrada) => entrada.name)
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

function herramienta(nombre) {
  for (const carpeta of versiones) {
    if (nombre === "apksigner") {
      const jar = path.join(
        herramientas,
        carpeta,
        "lib",
        "apksigner.jar",
      );
      if (fs.existsSync(jar)) {
        const java = process.env.JAVA_HOME
          ? path.join(
              process.env.JAVA_HOME,
              "bin",
              process.platform === "win32" ? "java.exe" : "java",
            )
          : "java";
        return { comando: java, prefijo: ["-jar", jar] };
      }
    }

    const base = path.join(herramientas, carpeta, nombre);
    const candidatos =
      process.platform === "win32"
        ? [base + ".bat", base + ".exe"]
        : [base];
    for (const archivo of candidatos) {
      if (fs.existsSync(archivo)) {
        return { comando: archivo, prefijo: [] };
      }
    }
  }
  throw new Error("No se encontró " + nombre + " en Android Build Tools");
}

function ejecutar(programa, argumentos) {
  const resultado = spawnSync(
    programa.comando,
    [...programa.prefijo, ...argumentos],
    {
      encoding: "utf8",
    },
  );
  const salida =
    (resultado.stdout || "") + String.fromCharCode(10) + (resultado.stderr || "");
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) throw new Error(salida.trim());
  return salida;
}

const firma = ejecutar(herramienta("apksigner"), [
  "verify",
  "--print-certs",
  apk,
]);
const huella = firma
  .match(/Signer #1 certificate SHA-256 digest:\s*([a-f0-9]+)/i)?.[1]
  ?.toLowerCase();
if (huella !== FIRMA_ACTUALIZACIONES) {
  throw new Error(
    "APK NO publicado: firma incompatible (" +
      (huella || "desconocida") +
      "). Esperada: " +
      FIRMA_ACTUALIZACIONES,
  );
}

const manifiesto = ejecutar(herramienta("aapt"), [
  "dump",
  "badging",
  apk,
]);
const codigo = manifiesto.match(/versionCode='(\d+)'/)?.[1];
const nombre = manifiesto.match(/versionName='([^']+)'/)?.[1];
if (
  Number(codigo) !== version.versionCode ||
  nombre !== version.versionName
) {
  throw new Error(
    "APK NO publicado: contiene " +
      nombre +
      " (" +
      codigo +
      ") y version.json exige " +
      version.versionName +
      " (" +
      version.versionCode +
      ")",
  );
}

fs.copyFileSync(apk, destino);
console.log(
  "APK " +
    nombre +
    " (" +
    codigo +
    ") publicado con la firma compatible: " +
    destino,
);
