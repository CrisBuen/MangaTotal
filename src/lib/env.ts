/**
 * Validación de variables de entorno (docs deployment-vercel.md).
 * Cada getter lanza un error claro si falta la variable, para que el
 * primer error real aparezca en los logs de Vercel en lugar de un
 * "server-side exception" genérico.
 */

export type StorageProvider = "local" | "blob" | "r2";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET no está configurada o tiene menos de 32 caracteres. " +
        "Definila en las variables de entorno (Vercel → Settings → Environment Variables)."
    );
  }
  return secret;
}

export function getStorageProvider(): StorageProvider {
  const provider = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  if (provider !== "local" && provider !== "blob" && provider !== "r2") {
    throw new Error(
      `STORAGE_PROVIDER inválido: "${provider}". Valores soportados: "local" | "blob" | "r2".`
    );
  }
  if (provider === "blob" && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'STORAGE_PROVIDER="blob" requiere BLOB_READ_WRITE_TOKEN (Vercel → Storage → Blob).'
    );
  }
  if (provider === "r2") {
    for (const name of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
      if (!process.env[name]) {
        throw new Error(`STORAGE_PROVIDER="r2" requiere la variable ${name}.`);
      }
    }
  }
  return provider;
}

/** Verifica que DATABASE_URL exista y apunte a Postgres cuando corresponde. */
export function assertDatabaseUrl(): void {
  // durante `next build` no hay conexión real: se valida solo en runtime
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL no está configurada.");
  }
  if (process.env.NODE_ENV === "production" && !/^postgres(ql)?:\/\//.test(url)) {
    throw new Error(
      "DATABASE_URL debe ser una conexión Postgres (postgresql://...) en producción."
    );
  }

  // Aviso, no error: sin la dirección con pooler, cada instancia abre su
  // propia conexión contra Postgres, y en Vercel hay muchas a la vez. Anda
  // igual hasta que llega gente; recién ahí empiezan los errores
  // intermitentes, que es el peor momento para descubrirlo.
  if (process.env.VERCEL && !url.includes("-pooler.") && !avisadoDelPooler) {
    avisadoDelPooler = true;
    console.warn(
      "[base de datos] DATABASE_URL no parece la dirección con pooler. En Neon " +
        "es la que lleva -pooler en el host. Sin eso, con tráfico se agotan las " +
        "conexiones. Ver deployment-vercel.md."
    );
  }
}

/** Para que el aviso salga una vez por instancia y no en cada consulta. */
let avisadoDelPooler = false;
