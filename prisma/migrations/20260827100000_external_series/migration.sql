-- CreateTable
CREATE TABLE "external_series" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "cover_url" TEXT,
    "type" TEXT,
    "last_chapter_id" TEXT,
    "last_chapter_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_series_user_id_updated_at_idx" ON "external_series"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "external_series_user_id_source_external_id_key" ON "external_series"("user_id", "source", "external_id");

-- AddForeignKey
ALTER TABLE "external_series" ADD CONSTRAINT "external_series_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

