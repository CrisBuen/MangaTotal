-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatar_path" TEXT;

-- CreateTable
CREATE TABLE "announcements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
