-- La sección de anime con reproducción es optativa y viene oculta.
ALTER TABLE "users"
ADD COLUMN "anime_enabled" BOOLEAN NOT NULL DEFAULT false;
