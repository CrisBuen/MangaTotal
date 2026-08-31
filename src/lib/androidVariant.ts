export type AndroidVariant = "local" | "play" | "legacy" | null;

/**
 * Identidad del contenedor Android. El marcador lo escribe mobile/patch.mjs
 * dentro de cada APK/AAB; no depende de una preferencia que el usuario pueda
 * cambiar desde JavaScript.
 */
export function androidVariantFromUserAgent(userAgent: string): AndroidVariant {
  const channel = /MangaTotalChannel\/(local|play)\b/i.exec(userAgent)?.[1]?.toLowerCase();
  if (channel === "local" || channel === "play") return channel;
  if (/MangaTotalApp\//.test(userAgent)) return "legacy";
  if (/Android/i.test(userAgent) && /\bwv\b/i.test(userAgent)) return "legacy";
  return null;
}

export function isPlayStoreUserAgent(userAgent: string): boolean {
  return androidVariantFromUserAgent(userAgent) === "play";
}
