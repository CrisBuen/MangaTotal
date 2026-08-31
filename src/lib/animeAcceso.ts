import { headers } from "next/headers";
import { isAndroidApp } from "@/lib/appVersion";
import { isPlayStoreUserAgent } from "@/lib/androidVariant";

/**
 * La sección reproducible solo depende del ajuste de la cuenta dentro de
 * Android. Web y escritorio no pasan por el filtro exigido por Play Store.
 */
export async function animeAnimadoPermitido(
  animeEnabled: boolean,
  animeTermsAcceptedAt?: Date | null,
): Promise<boolean> {
  const userAgent = (await headers()).get("user-agent") ?? "";
  if (!isAndroidApp(userAgent)) return true;
  if (isPlayStoreUserAgent(userAgent)) {
    return animeEnabled && Boolean(animeTermsAcceptedAt);
  }
  return animeEnabled;
}
