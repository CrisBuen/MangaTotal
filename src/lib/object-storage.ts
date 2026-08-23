import fs from "fs/promises";
import path from "path";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { del, get, list, put } from "@vercel/blob";
import { getStorageProvider } from "./env";
import { STORAGE_ROOT, contentTypeFor, resolveStoragePath } from "./storage";

/**
 * Adaptador de almacenamiento de objetos (deployment-vercel.md).
 * La base de datos guarda siempre claves relativas
 * (`series/<slug>/<cap>/0001.png`, `avatars/u1-....webp`); este módulo
 * traduce esas claves al proveedor configurado:
 *
 *   - STORAGE_PROVIDER="local" (default): disco en `storage/`, igual que antes.
 *   - STORAGE_PROVIDER="blob": Vercel Blob privado (BLOB_READ_WRITE_TOKEN).
 *     Los blobs son privados: nunca hay URL pública, todo se sirve vía
 *     /api/images con lectura autenticada del lado del servidor.
 */

export interface ObjectStorage {
  /** Sube un objeto (sobrescribe si existe). */
  putObject(key: string, data: Buffer, contentType: string): Promise<void>;
  /** URL pública del objeto si el proveedor tiene CDN propia, o null. */
  getPublicUrl(key: string): Promise<string | null>;
  /** Lee los bytes del objeto, o null si no existe. */
  readObject(key: string): Promise<Buffer | null>;
  /** Borra un objeto (ignora si no existe). */
  deleteObject(key: string): Promise<void>;
  /** Borra todos los objetos bajo un prefijo (carpeta de capítulo o serie). */
  deletePrefix(prefix: string): Promise<void>;
}

const localStorageAdapter: ObjectStorage = {
  async putObject(key, data) {
    const abs = resolveStoragePath(key);
    if (!abs) throw new Error(`Clave de almacenamiento inválida: ${key}`);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, data);
  },

  async getPublicUrl() {
    return null; // en local siempre se sirve vía /api/images
  },

  async readObject(key) {
    const abs = resolveStoragePath(key);
    if (!abs) return null;
    try {
      return await fs.readFile(abs);
    } catch {
      return null;
    }
  },

  async deleteObject(key) {
    const abs = resolveStoragePath(key);
    if (!abs) return;
    await fs.rm(abs, { force: true }).catch(() => {});
  },

  async deletePrefix(prefix) {
    const abs = resolveStoragePath(prefix);
    if (!abs) return;
    await fs.rm(abs, { recursive: true, force: true }).catch(() => {});
  },
};

const blobStorageAdapter: ObjectStorage = {
  async putObject(key, data, contentType) {
    await put(key, data, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
      // el archivo nunca cambia una vez subido (docs/07 §7.4)
      cacheControlMaxAge: 31536000,
    });
  },

  async getPublicUrl() {
    return null; // store privado: siempre se sirve vía /api/images
  },

  async readObject(key) {
    try {
      const result = await get(key, { access: "private" });
      if (!result?.stream) return null;
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    } catch {
      return null;
    }
  },

  async deleteObject(key) {
    await del(key).catch(() => {});
  },

  async deletePrefix(prefix) {
    // list() pagina de a 1000; iterar hasta vaciar el prefijo
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: normalizePrefix(prefix), cursor, limit: 1000 });
      if (page.blobs.length > 0) {
        await del(page.blobs.map((b) => b.url)).catch(() => {});
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  },
};

function normalizePrefix(prefix: string): string {
  return prefix.endsWith("/") ? prefix : prefix + "/";
}

// ── Cloudflare R2 (API S3) ─────────────────────────────────────────────────
let r2Client: S3Client | null = null;

function getR2(): { client: S3Client; bucket: string } {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
      },
    });
  }
  return { client: r2Client, bucket: process.env.R2_BUCKET as string };
}

const r2StorageAdapter: ObjectStorage = {
  async putObject(key, data, contentType) {
    const { client, bucket } = getR2();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        // el archivo nunca cambia una vez subido (docs/07 §7.4)
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  },

  async getPublicUrl() {
    return null; // bucket privado: siempre se sirve vía /api/images
  },

  async readObject(key) {
    const { client, bucket } = getR2();
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!res.Body) return null;
      return Buffer.from(await res.Body.transformToByteArray());
    } catch {
      return null;
    }
  },

  async deleteObject(key) {
    const { client, bucket } = getR2();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
  },

  async deletePrefix(prefix) {
    const { client, bucket } = getR2();
    let token: string | undefined;
    do {
      const page = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: normalizePrefix(prefix),
          ContinuationToken: token,
        })
      );
      const keys = (page.Contents ?? [])
        .map((o) => o.Key)
        .filter((k): k is string => Boolean(k));
      if (keys.length > 0) {
        await client
          .send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: { Objects: keys.map((Key) => ({ Key })) },
            })
          )
          .catch(() => {});
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  },
};

export function getObjectStorage(): ObjectStorage {
  const provider = getStorageProvider();
  if (provider === "r2") return r2StorageAdapter;
  if (provider === "blob") return blobStorageAdapter;
  return localStorageAdapter;
}

export { STORAGE_ROOT, contentTypeFor };
