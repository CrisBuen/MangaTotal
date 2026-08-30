-- Presencia anónima y efímera. Una fila por instalación; el panel solo
-- considera activas las que enviaron latido durante los últimos 90 segundos.
CREATE TABLE "analytics_presence" (
  "visitor_id" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "source" TEXT,
  "platform" TEXT NOT NULL,
  "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analytics_presence_pkey" PRIMARY KEY ("visitor_id")
);

CREATE INDEX "analytics_presence_last_seen_idx"
  ON "analytics_presence"("last_seen");
CREATE INDEX "analytics_presence_source_last_seen_idx"
  ON "analytics_presence"("source", "last_seen");
CREATE INDEX "analytics_presence_section_last_seen_idx"
  ON "analytics_presence"("section", "last_seen");

-- Historial agregado a partir de aperturas reales. No se guarda la ruta ni
-- la obra concreta, y la clave de deduplicación es un hash irreversible.
CREATE TABLE "analytics_events" (
  "id" BIGSERIAL NOT NULL,
  "visitor_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "source" TEXT,
  "platform" TEXT NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "analytics_events_dedupe_key_key"
  ON "analytics_events"("dedupe_key");
CREATE INDEX "analytics_events_occurred_at_idx"
  ON "analytics_events"("occurred_at");
CREATE INDEX "analytics_events_event_type_occurred_at_idx"
  ON "analytics_events"("event_type", "occurred_at");
CREATE INDEX "analytics_events_source_occurred_at_idx"
  ON "analytics_events"("source", "occurred_at");
