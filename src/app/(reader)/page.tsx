import type { Metadata } from "next";
import { ExperienceEntry } from "@/components/experience/ExperienceEntry";

export const metadata: Metadata = {
  title: "Leer manga y ver anime online",
  description:
    "Explora manga, manhwa, manhua y anime en MangaTotal y encuentra nuevas series, capítulos y episodios.",
  alternates: { canonical: "/" },
};

/**
 * La entrada usa la cuenta existente. El shell oculta la navegación aquí;
 * después de elegir sección, los datos y lectores siguen en sus rutas originales.
 */
export default function Home() {
  return <ExperienceEntry />;
}
