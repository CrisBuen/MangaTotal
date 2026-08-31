import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const raiz = process.cwd();
const origen = path.join(raiz, "assets", "branding", "mangatotal-logo.png");
const fondo = { r: 7, g: 8, b: 8, alpha: 1 };

if (!fs.existsSync(origen)) {
  throw new Error("No existe el logo maestro: " + origen);
}

async function pngCuadrado(destino, tamano) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  await sharp(origen)
    .resize(tamano, tamano, { fit: "cover" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destino);
}

async function pngMaskable(destino, tamano) {
  const interior = Math.round(tamano * 0.88);
  const logo = await sharp(origen)
    .resize(interior, interior, { fit: "cover" })
    .png()
    .toBuffer();

  await sharp({
    create: { width: tamano, height: tamano, channels: 4, background: fondo },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destino);
}

async function simboloTransparente() {
  const { data, info } = await sharp(origen)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // El original trae el fondo oscuro horneado. En el icono adaptativo se
  // separa el simbolo para que Android pueda recortarlo sin crear dos marcos.
  for (let i = 0; i < data.length; i += 4) {
    const maximo = Math.max(data[i], data[i + 1], data[i + 2]);
    data[i + 3] = maximo <= 18 ? 0 : 255;
  }

  return sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(700, 700, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

async function recursosAndroid() {
  const carpeta = path.join(raiz, "mobile", "recursos");
  await pngCuadrado(path.join(carpeta, "icon.png"), 1024);

  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: fondo },
  })
    .png({ compressionLevel: 9 })
    .toFile(path.join(carpeta, "icon-background.png"));

  const simbolo = await simboloTransparente();
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: simbolo, gravity: "center" }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(carpeta, "icon-foreground.png"));

  const logoSplash = await sharp(origen)
    .resize(820, 820, { fit: "cover" })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 2732, height: 2732, channels: 4, background: fondo },
  })
    .composite([{ input: logoSplash, gravity: "center" }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(carpeta, "splash.png"));
}

await Promise.all([
  pngCuadrado(path.join(raiz, "public", "branding", "mangatotal-logo.png"), 512),
  pngCuadrado(path.join(raiz, "src", "app", "icon.png"), 512),
  pngCuadrado(path.join(raiz, "src", "app", "apple-icon.png"), 180),
  pngCuadrado(path.join(raiz, "public", "icons", "icon-192.png"), 192),
  pngCuadrado(path.join(raiz, "public", "icons", "icon-512.png"), 512),
  pngCuadrado(path.join(raiz, "public", "icons", "apple-touch-icon.png"), 180),
  pngMaskable(path.join(raiz, "public", "icons", "maskable-192.png"), 192),
  pngMaskable(path.join(raiz, "public", "icons", "maskable-512.png"), 512),
  recursosAndroid(),
]);

console.log("Logo web, PWA y recursos Android generados desde assets/branding/mangatotal-logo.png");
