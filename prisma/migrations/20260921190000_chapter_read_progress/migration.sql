-- El marcador actual y los capítulos visitados son cosas distintas.
-- La cota heredada conserva el gris anterior sin inventar huecos en lecturas nuevas.
ALTER TABLE "external_series" ADD COLUMN "read_through_number" DOUBLE PRECISION;
UPDATE "external_series" SET "read_through_number" =
  substring("last_chapter_name" from '([0-9]+(\.[0-9]+)?)')::double precision
WHERE "last_chapter_name" ~ '[0-9]';

CREATE TABLE "external_chapter_progress" (
  "id" SERIAL NOT NULL,
  "external_series_id" INTEGER NOT NULL,
  "chapter_id" TEXT NOT NULL,
  "page_number" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "external_chapter_progress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_chapter_progress_external_series_id_fkey"
    FOREIGN KEY ("external_series_id") REFERENCES "external_series"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "external_chapter_progress_external_series_id_chapter_id_key"
  ON "external_chapter_progress"("external_series_id", "chapter_id");

ALTER TABLE "reading_progress" ADD COLUMN "read_through_number" DOUBLE PRECISION;
UPDATE "reading_progress" AS progress SET "read_through_number" = chapters.number
FROM "chapters" AS chapters WHERE chapters.id = progress.chapter_id;

CREATE TABLE "read_chapters" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "chapter_id" INTEGER NOT NULL,
  "page_number" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "read_chapters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "read_chapters_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "read_chapters_chapter_id_fkey"
    FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "read_chapters_user_id_chapter_id_key" ON "read_chapters"("user_id", "chapter_id");
