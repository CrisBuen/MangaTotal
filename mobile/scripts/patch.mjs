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
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
