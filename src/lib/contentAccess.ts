import { headers } from "next/headers";
import { isPlayStoreUserAgent } from "./androidVariant";

interface AdultPreference {
  showAdultContent?: boolean;
  isAdmin?: boolean;
}

/**
 * La variante Play nunca recibe contenido +18, aunque la misma cuenta lo
 * tenga habilitado desde la web o el APK local. Esta comprobación vive en el
 * servidor para que ocultar el interruptor no sea la única barrera.
 */
export async function contenidoAdultoPermitido(
  user: AdultPreference | null | undefined,
): Promise<boolean> {
  const userAgent = (await headers()).get("user-agent") ?? "";
  if (isPlayStoreUserAgent(userAgent)) return false;
  return Boolean(user?.showAdultContent || user?.isAdmin);
}

export async function peticionDesdePlayStore(): Promise<boolean> {
  const userAgent = (await headers()).get("user-agent") ?? "";
  return isPlayStoreUserAgent(userAgent);
}
