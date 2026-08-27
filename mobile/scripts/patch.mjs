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
