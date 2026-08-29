-- Las sesiones llevan una versión revocable: cambiar la contraseña invalida
-- las cookies anteriores sin guardar el contenido de ninguna sesión.
ALTER TABLE "users"
  ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 1;

-- Los límites sobreviven a las instancias efímeras de Vercel. "key" es un
-- HMAC y no contiene en claro IPs, apodos ni identificadores de cuenta.
CREATE TABLE "auth_rate_limits" (
  "key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "window_started_at" TIMESTAMP(3) NOT NULL,
  "blocked_until" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "auth_rate_limits_updated_at_idx"
  ON "auth_rate_limits"("updated_at");
