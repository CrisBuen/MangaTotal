import fs from "fs";

/**
 * La carpeta android/ la regenera Capacitor y no se versiona, así que los
 * ajustes nativos viven en patches/ y se vuelven a copiar acá.
 */
const copias = [
  ["patches/MainActivity.java", "android/app/src/main/java/app/mangatotal/android/MainActivity.java"],
  ["patches/FuentesPlugin.java", "android/app/src/main/java/app/mangatotal/android/FuentesPlugin.java"],
  ["patches/DesafioActivity.java", "android/app/src/main/java/app/mangatotal/android/DesafioActivity.java"],
  ["patches/AndroidManifest.xml", "android/app/src/main/AndroidManifest.xml"],
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
const version = JSON.parse(fs.readFileSync("version.json", "utf8"));

const gradle = "android/app/build.gradle";
fs.writeFileSync(
  gradle,
  fs
    .readFileSync(gradle, "utf8")
    .replace(/versionCode\s+\d+/, `versionCode ${version.versionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${version.versionName}"`)
);
console.log("versión:", version.versionName, "(código " + version.versionCode + ")");

const configPath = "capacitor.config.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.android.appendUserAgent = `MangaTotalApp/${version.versionCode}`;
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
