import { ReadingDiscover } from "@/components/home/ReadingDiscover";

export const metadata = { title: "Descubrir lectura · MangaTotal" };

export default function DescubrirLecturaPage() {
  return (
    <div data-od-id="reading-discover-page">
      <h1 className="sr-only">Descubrir lectura</h1>
      <ReadingDiscover />
    </div>
  );
}
