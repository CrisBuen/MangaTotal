import type { Metadata } from "next";
import { HomeExperience } from "@/components/home/HomeExperience";

export const metadata: Metadata = {
  title: "Leer manga y ver anime online",
  description:
    "Explora manga, manhwa, manhua y anime en MangaTotal y encuentra nuevas series, capítulos y episodios.",
  alternates: { canonical: "/" },
};

/**
 * Inicio. Vive dentro del grupo (reader) para compartir la cabecera y la
 * barra de abajo con Biblioteca, Explorar, AniList y Perfil: así al cambiar
 * de pestaña solo se reemplaza el contenido, no toda la pantalla.
 */
export default function Home() {
  // el margen negativo conserva el aire que tenía antes de compartir layout
  return (
    <div className="-mt-2 sm:-mt-4" data-od-id="home-content">
      <HomeExperience />
    </div>
  );
}
