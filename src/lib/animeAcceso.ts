import { headers } from "next/headers";
import { isAndroidApp } from "@/lib/appVersion";

/**
 * La sección reproducible solo depende del ajuste de la cuenta dentro de
 * Android. Web y escritorio no pasan por el filtro exigido por Play Store.
 */
export async function animeAnimadoPermitido(animeEnabled: boolean): Promise<boolean> {
  const userAgent = (await headers()).get("user-agent") ?? "";
  return !isAndroidApp(userAgent) || animeEnabled;
}
