import fs from "fs/promises";
import path from "path";
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

export function getObjectStorage(): ObjectStorage {
  return getStorageProvider() === "blob" ? blobStorageAdapter : localStorageAdapter;
}

export { STORAGE_ROOT, contentTypeFor };
