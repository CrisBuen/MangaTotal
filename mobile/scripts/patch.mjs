import fs from "fs";

const argumentoVariante = process.argv.indexOf("--variant");
const variante = argumentoVariante >= 0 ? process.argv[argumentoVariante + 1] : "local";
if (variante !== "local" && variante !== "play") {
  throw new Error('Variante inválida. Usá "local" o "play".');
}

/**
 * La carpeta android/ la regenera Capacitor y no se versiona, así que los
 * ajustes nativos viven en patches/ y se vuelven a copiar acá.
 */
const copias = [
  [
    variante === "play" ? "patches/play/MainActivity.java" : "patches/MainActivity.java",
    "android/app/src/main/java/app/mangatotal/android/MainActivity.java",
  ],
  ["patches/FuentesPlugin.java", "android/app/src/main/java/app/mangatotal/android/FuentesPlugin.java"],
  ["patches/DesafioActivity.java", "android/app/src/main/java/app/mangatotal/android/DesafioActivity.java"],
  ["patches/PantallaPlugin.java", "android/app/src/main/java/app/mangatotal/android/PantallaPlugin.java"],
  [
    variante === "play" ? "patches/play/AndroidManifest.xml" : "patches/AndroidManifest.xml",
    "android/app/src/main/AndroidManifest.xml",
  ],
  ["patches/file_paths.xml", "android/app/src/main/res/xml/file_paths.xml"],
];

for (const [origen, destino] of copias) {
  fs.copyFileSync(origen, destino);
  console.log("aplicado:", destino);
}

/**
 * La versión, en los dos lugares que la necesitan.
 *
 * versionCode es lo que mira Android para saber si un APK es más nuevo que
 * el instalado, y appendUserAgent es como la app se presenta ante la web,
 * que es de donde sale el aviso de actualización. Si los dos no coinciden,
 * el aviso queda en bucle: avisa de una versión que ya está puesta.
 *
 * Vive acá porque android/ no se versiona y Capacitor la regenera.
 */
const versiones = JSON.parse(fs.readFileSync("version.json", "utf8"));
const version = variante === "play" ? versiones.playStore : versiones;
if (!version?.versionCode || !version?.versionName) {
  throw new Error("Falta la versión de la variante " + variante + " en version.json");
}

const gradle = "android/app/build.gradle";
fs.writeFileSync(
  gradle,
  fs
    .readFileSync(gradle, "utf8")
    .replace(/versionCode(\s*=\s*|\s+)\d+/, (_, sep) => `versionCode${sep}${version.versionCode}`)
    .replace(/versionName(\s*=\s*|\s+)"[^"]*"/, (_, sep) => `versionName${sep}"${version.versionName}"`)
);
// Capacitor 8 pasó a escribir estas propiedades con signo igual
// (versionCode = 19); antes iban sin él. Las expresiones de arriba aceptan
// las dos formas, y esto confirma que de verdad quedaron escritas: un
// .replace() que no encuentra su patrón no falla, deja el archivo igual, y
// la app termina anunciando una versión que no es la suya con el aviso de
// actualización saliendo para siempre.
const gradleEscrito = fs.readFileSync(gradle, "utf8");
for (const [clave, esperado] of [
  ["versionCode", String(version.versionCode)],
  ["versionName", JSON.stringify(version.versionName)],
]) {
  if (!gradleEscrito.includes(clave + " " + esperado) &&
      !gradleEscrito.includes(clave + " = " + esperado)) {
    throw new Error(
      `No se pudo escribir ${clave} en build.gradle: cambió el formato de la ` +
        "plantilla de Capacitor. Revisalo antes de compilar."
    );
  }
}

console.log(
  "variante:",
  variante,
  "· versión:",
  version.versionName,
  "(código " + version.versionCode + ")",
);

const configPath = "capacitor.config.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.android.appendUserAgent =
  `MangaTotalApp/${version.versionCode} MangaTotalChannel/${variante}`;
const configTexto = JSON.stringify(config, null, 2) + "\n";
fs.writeFileSync(configPath, configTexto);

// Y la copia que viaja DENTRO del APK. Normalmente la pone 'cap sync', y
// si se compila sin sincronizar queda la vieja: la app se presenta con un
// número de versión anterior al que realmente tiene, y el aviso de
// actualización no se apaga nunca. Escribirla acá lo vuelve imposible.
const configEnApk = "android/app/src/main/assets/capacitor.config.json";
if (fs.existsSync(configEnApk)) {
  fs.writeFileSync(configEnApk, configTexto);
  console.log("aplicado:", configEnApk);
}

/**
 * Niveles de SDK, distintos según la variante.
 *
 * Google Play exige API 36 desde el 31 de agosto de 2026, así que el paquete
 * que va a la tienda apunta ahí. El APK local se queda a propósito en 34:
 * desde 36 Android obliga al modo borde a borde y ya no deja desactivarlo,
 * y esa variante no tiene por qué pasar por ese cambio.
 *
 * compileSdk y minSdk son iguales en las dos porque los exige Capacitor 8.
 * No cambian cómo se comporta la app, solo contra qué se compila. Ojo que
 * minSdk 24 deja fuera Android 5.0 y 5.1.
 *
 * Vive acá, y no editado a mano en variables.gradle, porque android/ no se
 * versiona: Capacitor la regenera con sus valores por defecto y un cambio
 * hecho a mano ahí se pierde sin que nadie se entere.
 */
const SDK = {
  compile: 36,
  min: 24,
  target: variante === "play" ? 36 : 34,
};

const variablesGradle = "android/variables.gradle";
if (fs.existsSync(variablesGradle)) {
  let v = fs.readFileSync(variablesGradle, "utf8");
  for (const [clave, valor] of [
    ["minSdkVersion", SDK.min],
    ["compileSdkVersion", SDK.compile],
    ["targetSdkVersion", SDK.target],
  ]) {
    const patron = new RegExp(clave + "\\s*=\\s*\\d+");
    if (!patron.test(v)) {
      throw new Error(`No se encontró ${clave} en variables.gradle.`);
    }
    v = v.replace(patron, `${clave} = ${valor}`);
  }
  fs.writeFileSync(variablesGradle, v);
  console.log("SDK · compila con", SDK.compile, "· apunta a", SDK.target, "· mínimo", SDK.min);
} else {
  console.log("SDK: todavía no existe android/variables.gradle, se omite");
}

/**
 * Firma de publicación.
 *
 * La clave y su contraseña viven en mobile/firma.local.json, que NO va al
 * repositorio (es público). Si ese archivo no está, se compila sin firma de
 * publicación y 'assembleDebug' sigue andando igual que siempre.
 *
 * La contraseña no se escribe dentro de build.gradle: va a un
 * keystore.properties aparte, que es como lo hace Android, y gradle lo lee al
 * compilar.
 *
 * SI SE PIERDE ESA CLAVE no se puede volver a actualizar la app en Play
 * Store: habría que publicarla de cero con otro identificador. Guardar copia
 * fuera de la máquina.
 */
const firmaPath = "firma.local.json";
if (fs.existsSync(firmaPath)) {
  const firma = JSON.parse(fs.readFileSync(firmaPath, "utf8"));

  fs.writeFileSync(
    "android/keystore.properties",
    [
      "# generado por scripts/patch.mjs — no subir",
      `storeFile=${firma.keystore}`,
      `storePassword=${firma.password}`,
      `keyAlias=${firma.alias}`,
      `keyPassword=${firma.password}`,
      "",
    ].join("\n")
  );

  let g = fs.readFileSync(gradle, "utf8");

  if (!g.includes("firmaProps")) {
    g =
      [
        "def firmaProps = new Properties()",
        'def firmaArchivo = rootProject.file("keystore.properties")',
        "if (firmaArchivo.exists()) { firmaProps.load(new FileInputStream(firmaArchivo)) }",
        "",
      ].join("\n") + g;

    g = g.replace(
      "    buildTypes {",
      [
        "    signingConfigs {",
        "        release {",
        '            if (firmaProps["storeFile"]) {',
        '                storeFile file(firmaProps["storeFile"])',
        '                storePassword firmaProps["storePassword"]',
        '                keyAlias firmaProps["keyAlias"]',
        '                keyPassword firmaProps["keyPassword"]',
        "            }",
        "        }",
        "    }",
        "    buildTypes {",
      ].join("\n")
    );

    g = g.replace("        release {\n            minifyEnabled", "        release {\n            signingConfig signingConfigs.release\n            minifyEnabled");

    fs.writeFileSync(gradle, g);
  }
  console.log("firma de publicación: configurada");
} else {
  console.log("firma de publicación: sin firma.local.json, se omite");
}
