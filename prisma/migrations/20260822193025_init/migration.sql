-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nickname" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "birthdate" DATETIME,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "show_adult_content" BOOLEAN NOT NULL DEFAULT false,
    "preferred_reading_mode" TEXT NOT NULL DEFAULT 'cascade',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "series" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "original_title" TEXT,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'normal',
    "description" TEXT,
    "cover_image_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ongoing',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "series_id" INTEGER NOT NULL,
    "number" REAL NOT NULL,
    "title" TEXT,
    "source_zip_name" TEXT NOT NULL,
    "page_count" INTEGER NOT NULL DEFAULT 0,
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chapters_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chapter_id" INTEGER NOT NULL,
    "page_number" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    CONSTRAINT "pages_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reading_progress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "series_id" INTEGER NOT NULL,
    "chapter_id" INTEGER NOT NULL,
    "last_page_number" INTEGER NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "reading_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reading_progress_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reading_progress_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "series_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "favorites_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ingestion_jobs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "original_filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "series_id" INTEGER,
    "chapter_id" INTEGER,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME,
    CONSTRAINT "ingestion_jobs_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ingestion_jobs_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");

-- CreateIndex
CREATE INDEX "series_type_idx" ON "series"("type");

-- CreateIndex
CREATE INDEX "chapters_series_id_number_idx" ON "chapters"("series_id", "number");

-- CreateIndex
CREATE INDEX "pages_chapter_id_page_number_idx" ON "pages"("chapter_id", "page_number");

-- CreateIndex
CREATE INDEX "reading_progress_user_id_updated_at_idx" ON "reading_progress"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "reading_progress_user_id_series_id_key" ON "reading_progress"("user_id", "series_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_series_id_key" ON "favorites"("user_id", "series_id");
