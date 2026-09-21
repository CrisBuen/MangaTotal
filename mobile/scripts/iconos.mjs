import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Capacitor regenera android/: el logo debe restaurarse en CADA compilación,
// no solo cuando alguien ejecuta manualmente el generador de branding.
export async function aplicarIconos() {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const res = path.join(raiz, "android/app/src/main/res");
  for (const [densidad, escala] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
    const carpeta = path.join(res, "mipmap-" + densidad);
    await fs.mkdir(carpeta, { recursive: true });
    for (const nombre of ["ic_launcher", "ic_launcher_round"]) {
      await sharp(path.join(raiz, "recursos/icon.png")).resize(48 * escala, 48 * escala).png().toFile(path.join(carpeta, nombre + ".png"));
    }
    await sharp(path.join(raiz, "recursos/icon-foreground.png")).resize(108 * escala, 108 * escala).png().toFile(path.join(carpeta, "ic_launcher_foreground.png"));
  }
  const adaptable = path.join(res, "mipmap-anydpi-v26");
  await fs.mkdir(adaptable, { recursive: true });
  for (const nombre of ["ic_launcher", "ic_launcher_round"]) {
    await fs.writeFile(path.join(adaptable, nombre + ".xml"), '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>\n');
  }
  await fs.writeFile(path.join(res, "values/ic_launcher_background.xml"), '<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#070808</color></resources>\n');
  console.log("Iconos originales MangaTotal: restaurados en todas las densidades");
}
