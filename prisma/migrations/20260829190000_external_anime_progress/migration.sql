-- Anime visto y anime guardado no son lo mismo: una serie puede quedar en el
-- historial aunque la persona no la haya agregado a Anime animado.
ALTER TABLE "external_anime"
  ADD COLUMN "saved" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "last_episode_id" TEXT,
  ADD COLUMN "last_episode_number" TEXT,
  ADD COLUMN "last_episode_title" TEXT,
  ADD COLUMN "last_watched_at" TIMESTAMP(3);

CREATE INDEX "external_anime_user_id_saved_updated_at_idx"
  ON "external_anime"("user_id", "saved", "updated_at");

-- El progreso vive por episodio. No se persisten manifiestos HLS, iframes ni
-- tokens de los reproductores externos porque caducan y pertenecen a JKAnime.
CREATE TABLE "external_anime_episode_progress" (
  "id" SERIAL NOT NULL,
  "external_anime_id" INTEGER NOT NULL,
  "episode_id" TEXT NOT NULL,
  "episode_number" TEXT NOT NULL,
  "episode_title" TEXT,
  "position_seconds" INTEGER NOT NULL DEFAULT 0,
  "duration_seconds" INTEGER NOT NULL DEFAULT 0,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "external_anime_episode_progress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_anime_episode_progress_external_anime_id_fkey"
    FOREIGN KEY ("external_anime_id") REFERENCES "external_anime"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "external_anime_episode_progress_external_anime_id_episode_id_key"
  ON "external_anime_episode_progress"("external_anime_id", "episode_id");

CREATE INDEX "external_anime_episode_progress_external_anime_id_updated_at_idx"
  ON "external_anime_episode_progress"("external_anime_id", "updated_at");
