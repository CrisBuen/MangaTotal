import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

/**
 * Anime viene apagado por cuenta. Ocultar el enlace no alcanza: todas las
 * páginas de esta sección vuelven a Ajustes si la persona no la habilitó.
 */
export default async function AnimeLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user?.animeEnabled) redirect("/ajustes");
  return children;
}
