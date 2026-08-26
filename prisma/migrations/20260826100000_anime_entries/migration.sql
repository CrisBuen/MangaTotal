-- CreateTable
CREATE TABLE "anime_entries" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "anilist_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "cover_url" TEXT,
    "total_episodes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'watching',
    "episodes_watched" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anime_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anime_entries_user_id_status_idx" ON "anime_entries"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "anime_entries_user_id_anilist_id_key" ON "anime_entries"("user_id", "anilist_id");

-- AddForeignKey
ALTER TABLE "anime_entries" ADD CONSTRAINT "anime_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

