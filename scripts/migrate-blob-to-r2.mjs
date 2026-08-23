/**
 * Copia todos los archivos del store de Vercel Blob a un bucket de
 * Cloudflare R2, conservando las mismas claves. No borra nada de Blob.
 *
 * Uso (PowerShell):
 *   $env:BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
 *   $env:R2_ACCOUNT_ID="..."; $env:R2_ACCESS_KEY_ID="..."
 *   $env:R2_SECRET_ACCESS_KEY="..."; $env:R2_BUCKET="..."
 *   node scripts/migrate-blob-to-r2.mjs
 *
 * Al terminar, verifica que cada clave exista en R2 con el mismo tamaño.
 * Los zips temporales bajo _uploads/ se omiten.
 */

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { get, list } from "@vercel/blob";

for (const name of [
  "BLOB_READ_WRITE_TOKEN",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
]) {
  if (!process.env[name]) {
    console.error(`Falta la variable ${name}`);
    process.exit(1);
  }
}

const CONTENT_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const bucket = process.env.R2_BUCKET;

function contentTypeFor(key) {
  const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

// ── 1. Inventario completo del store de Blob ────────────────────────────
const blobs = [];
let cursor;
do {
  const page = await list({ cursor, limit: 1000 });
  for (const b of page.blobs) {
    if (!b.pathname.startsWith("_uploads/")) blobs.push(b);
  }
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);

console.log(`Blob: ${blobs.length} archivos para copiar`);

// ── 2. Copiar uno por uno (clave y bytes idénticos) ─────────────────────
let copied = 0;
for (const b of blobs) {
  const result = await get(b.pathname, { access: "private" });
  if (!result?.stream) {
    console.error(`✗ No se pudo leer ${b.pathname} desde Blob`);
    process.exit(1);
  }
  const data = Buffer.from(await new Response(result.stream).arrayBuffer());
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: b.pathname,
      Body: data,
      ContentType: contentTypeFor(b.pathname),
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  copied++;
  if (copied % 25 === 0) console.log(`  ${copied}/${blobs.length} copiados...`);
}
console.log(`✔ ${copied} archivos copiados a R2`);

// ── 3. Verificación: cada clave existe en R2 con el mismo tamaño ────────
let mismatches = 0;
for (const b of blobs) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: b.pathname }));
    if (head.ContentLength !== b.size) {
      console.error(`✗ Tamaño distinto en ${b.pathname}: R2=${head.ContentLength} Blob=${b.size}`);
      mismatches++;
    }
  } catch {
    console.error(`✗ Falta en R2: ${b.pathname}`);
    mismatches++;
  }
}

if (mismatches > 0) {
  console.error(`Verificación con ${mismatches} diferencias — NO cambiar STORAGE_PROVIDER todavía.`);
  process.exit(1);
}
console.log("✔ Verificación completa: R2 tiene los mismos archivos, byte a byte en tamaño.");
console.log("Siguiente paso: STORAGE_PROVIDER=r2 (+ variables R2_*) en Vercel y redeploy.");
