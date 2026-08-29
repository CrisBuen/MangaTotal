-- Anime de proveedores externos guardado por usuario. Solo conserva
-- referencias y metadatos; los videos siguen viviendo en cada fuente.
CREATE TABLE "external_anime" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "cover_url" TEXT,
    "type" TEXT,
    "status" TEXT,
    "total_episodes" INTEGER,
    "is_adult" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_anime_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_anime_user_id_source_external_id_key"
    ON "external_anime"("user_id", "source", "external_id");
CREATE INDEX "external_anime_user_id_updated_at_idx"
    ON "external_anime"("user_id", "updated_at");

ALTER TABLE "external_anime"
    ADD CONSTRAINT "external_anime_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
