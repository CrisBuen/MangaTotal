-- Historial de lectura de series externas.
--
-- Hasta ahora una serie externa solo existía si la persona la guardaba a
-- mano. Con esto también queda anotada la que abrió un capítulo y no llegó
-- a guardar: son las mismas filas, separadas por esta columna.
--
-- Las que ya existían son todas de la biblioteca, así que arrancan en true.
ALTER TABLE "external_series" ADD COLUMN "saved" BOOLEAN NOT NULL DEFAULT true;

DROP INDEX IF EXISTS "external_series_user_id_updated_at_idx";
CREATE INDEX "external_series_user_id_saved_updated_at_idx"
  ON "external_series" ("user_id", "saved", "updated_at");
