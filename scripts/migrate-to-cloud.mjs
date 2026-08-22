/**
 * Migra los datos locales a la nube (deployment-vercel.md, paso 6):
 *   - lector-total.db (SQLite)  →  Postgres (DATABASE_URL)
 *   - storage/                  →  Vercel Blob (BLOB_READ_WRITE_TOKEN)
 *
 * Uso (PowerShell):
 *   $env:DATABASE_URL="postgresql://..."; $env:BLOB_READ_WRITE_TOKEN="..."; node scripts/migrate-to-cloud.mjs
 *
 * Requiere Node 22.5+ (usa node:sqlite). No borra nada local: los originales
 * quedan intactos para verificar el Preview antes de Production.
 *
 * Antes de correrlo, aplicar el esquema en Postgres:
 *   npx prisma migrate deploy
 */

import { DatabaseSync } from "node:sqlite";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";

const SQLITE_PATH = process.env.SQLITE_PATH ?? "lector-total.db";
const STORAGE_DIR = process.env.STORAGE_DIR ?? "storage";
const SKIP_FILES = process.argv.includes("--skip-files");
const SKIP_DB = process.argv.includes("--skip-db");

if (!process.env.DATABASE_URL?.startsWith("postgres")) {
  console.error("DATABASE_URL debe apuntar a Postgres (postgresql://...)");
  process.exit(1);
}
if (!SKIP_FILES && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Falta BLOB_READ_WRITE_TOKEN (o usar --skip-files)");
  process.exit(1);
}

const CONTENT_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** SQLite guarda fechas como número (ms) o texto ISO; ambas → Date. */
function toDate(v) {
  if (v === null || v === undefined) return null;
  const d = typeof v === "number" ? new Date(v) : new Date(String(v).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) throw new Error(`Fecha inválida: ${v}`);
  return d;
}

const bool = (v) => Boolean(v);

async function migrateDatabase(prisma) {
  const sqlite = new DatabaseSync(SQLITE_PATH, { readOnly: true });
  const all = (table) => sqlite.prepare(`SELECT * FROM ${table}`).all();

  const users = all("users");
  const series = all("series");
  const chapters = all("chapters");
  const pages = all("pages");
  const progress = all("reading_progress");
  const favorites = all("favorites");
  const announcements = all("announcements");
  const jobs = all("ingestion_jobs");
  sqlite.close();

  console.log(
    `SQLite: ${users.length} usuarios, ${series.length} series, ${chapters.length} capítulos, ` +
      `${pages.length} páginas, ${progress.length} progresos, ${favorites.length} favoritos, ` +
      `${announcements.length} noticias, ${jobs.length} jobs`
  );

  // orden por claves foráneas; ids preservados para no romper referencias
  await prisma.user.createMany({
    data: users.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      passwordHash: u.password_hash,
      birthdate: toDate(u.birthdate),
      isAdmin: bool(u.is_admin),
      showAdultContent: bool(u.show_adult_content),
      preferredReadingMode: u.preferred_reading_mode,
      avatarPath: u.avatar_path,
      createdAt: toDate(u.created_at),
    })),
    skipDuplicates: true,
  });

  await prisma.series.createMany({
    data: series.map((s) => ({
      id: s.id,
      title: s.title,
      originalTitle: s.original_title,
      slug: s.slug,
      type: s.type,
      description: s.description,
      coverImagePath: s.cover_image_path,
      status: s.status,
      createdAt: toDate(s.created_at),
      updatedAt: toDate(s.updated_at),
    })),
    skipDuplicates: true,
  });

  await prisma.chapter.createMany({
    data: chapters.map((c) => ({
      id: c.id,
      seriesId: c.series_id,
      number: c.number,
      title: c.title,
      sourceZipName: c.source_zip_name,
      pageCount: c.page_count,
      uploadedAt: toDate(c.uploaded_at),
    })),
    skipDuplicates: true,
  });

  await prisma.page.createMany({
    data: pages.map((p) => ({
      id: p.id,
      chapterId: p.chapter_id,
      pageNumber: p.page_number,
      filePath: p.file_path,
      width: p.width,
      height: p.height,
      fileSizeBytes: p.file_size_bytes,
      checksumSha256: p.checksum_sha256,
    })),
    skipDuplicates: true,
  });

  await prisma.readingProgress.createMany({
    data: progress.map((r) => ({
      id: r.id,
      userId: r.user_id,
      seriesId: r.series_id,
      chapterId: r.chapter_id,
      lastPageNumber: r.last_page_number,
      updatedAt: toDate(r.updated_at),
    })),
    skipDuplicates: true,
  });

  await prisma.favorite.createMany({
    data: favorites.map((f) => ({
      id: f.id,
      userId: f.user_id,
      seriesId: f.series_id,
      createdAt: toDate(f.created_at),
    })),
    skipDuplicates: true,
  });

  await prisma.announcement.createMany({
    data: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      createdAt: toDate(a.created_at),
      updatedAt: toDate(a.updated_at),
    })),
    skipDuplicates: true,
  });

  await prisma.ingestionJob.createMany({
    data: jobs.map((j) => ({
      id: j.id,
      originalFilename: j.original_filename,
      status: j.status,
      errorMessage: j.error_message,
      seriesId: j.series_id,
      chapterId: j.chapter_id,
      startedAt: toDate(j.started_at),
      finishedAt: toDate(j.finished_at),
    })),
    skipDuplicates: true,
  });

  // como se insertó con ids explícitos, realinear las secuencias SERIAL
  for (const table of [
    "users",
    "series",
    "chapters",
    "pages",
    "reading_progress",
    "favorites",
    "announcements",
    "ingestion_jobs",
  ]) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
    );
  }

  // verificación de conteos (checklist del doc)
  const counts = {
    users: await prisma.user.count(),
    series: await prisma.series.count(),
    chapters: await prisma.chapter.count(),
    pages: await prisma.page.count(),
    reading_progress: await prisma.readingProgress.count(),
    favorites: await prisma.favorite.count(),
    announcements: await prisma.announcement.count(),
    ingestion_jobs: await prisma.ingestionJob.count(),
  };
  console.log("Postgres:", counts);

  const expected = {
    users: users.length,
    series: series.length,
    chapters: chapters.length,
    pages: pages.length,
    reading_progress: progress.length,
    favorites: favorites.length,
    announcements: announcements.length,
    ingestion_jobs: jobs.length,
  };
  for (const [table, n] of Object.entries(expected)) {
    if (counts[table] < n) {
      throw new Error(`Conteo en ${table}: Postgres tiene ${counts[table]} y SQLite ${n}`);
    }
  }
  console.log("✔ Base de datos migrada y verificada");
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(abs);
    else yield abs;
  }
}

async function migrateFiles() {
  let uploaded = 0;
  let skipped = 0;
  for await (const abs of walk(STORAGE_DIR)) {
    const key = path.relative(STORAGE_DIR, abs).split(path.sep).join("/");
    const contentType = CONTENT_TYPES[path.extname(abs).toLowerCase()];
    if (!contentType) {
      skipped++;
      continue;
    }
    const data = await readFile(abs);
    await put(key, data, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
      cacheControlMaxAge: 31536000,
    });
    uploaded++;
    if (uploaded % 25 === 0) console.log(`  ${uploaded} archivos subidos...`);
  }
  console.log(`✔ Archivos migrados a Blob: ${uploaded} subidos, ${skipped} omitidos (no-imagen)`);
}

const prisma = new PrismaClient();
try {
  if (!SKIP_DB) await migrateDatabase(prisma);
  if (!SKIP_FILES) await migrateFiles();
  console.log("Migración completa. Verificar portadas y páginas en el Preview antes de Production.");
} finally {
  await prisma.$disconnect();
}
