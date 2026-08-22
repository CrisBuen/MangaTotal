import fs from "fs/promises";
import path from "path";
import { del, list, put } from "@vercel/blob";
import { getStorageProvider } from "./env";
import { STORAGE_ROOT, contentTypeFor, resolveStoragePath } from "./storage";

/**
 * Adaptador de almacenamiento de objetos (deployment-vercel.md).
 * La base de datos guarda siempre claves relativas
 * (`series/<slug>/<cap>/0001.png`, `avatars/u1-....webp`); este módulo
 * traduce esas claves al proveedor configurado:
 *
 *   - STORAGE_PROVIDER="local" (default): disco en `storage/`, igual que antes.
 *   - STORAGE_PROVIDER="blob": Vercel Blob (BLOB_READ_WRITE_TOKEN).
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
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
      // el archivo nunca cambia una vez subido (docs/07 §7.4)
      cacheControlMaxAge: 31536000,
    });
  },

  async getPublicUrl(key) {
    const found = await findBlob(key);
    return found?.url ?? null;
  },

  async readObject(key) {
    const found = await findBlob(key);
    if (!found) return null;
    const res = await fetch(found.url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  },

  async deleteObject(key) {
    const found = await findBlob(key);
    if (found) await del(found.url).catch(() => {});
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

/** Resuelve la URL del blob por su clave exacta, o null si no existe. */
async function findBlob(key: string): Promise<{ url: string } | null> {
  try {
    const page = await list({ prefix: key, limit: 10 });
    const match = page.blobs.find((b) => b.pathname === key);
    return match ? { url: match.url } : null;
  } catch {
    return null;
  }
}

function normalizePrefix(prefix: string): string {
  return prefix.endsWith("/") ? prefix : prefix + "/";
}

export function getObjectStorage(): ObjectStorage {
  return getStorageProvider() === "blob" ? blobStorageAdapter : localStorageAdapter;
}

export { STORAGE_ROOT, contentTypeFor };
