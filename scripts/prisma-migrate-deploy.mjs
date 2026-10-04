import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const databaseUrlDirecta =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING;

// Las migraciones necesitan una sesión directa. Con el pool transaccional de
// Neon, el advisory lock de Prisma puede quedar asociado a otra conexión y
// hacer fallar despliegues posteriores aunque no haya migraciones pendientes.
const require = createRequire(import.meta.url);
const prisma = require.resolve("prisma/build/index.js");
const resultado = spawnSync(process.execPath, [prisma, "migrate", "deploy"], {
  env: databaseUrlDirecta
    ? { ...process.env, DATABASE_URL: databaseUrlDirecta }
    : process.env,
  stdio: "inherit",
});

if (resultado.error) {
  console.error("No se pudo iniciar Prisma Migrate:", resultado.error.message);
  process.exit(1);
}

process.exit(resultado.status ?? 1);
