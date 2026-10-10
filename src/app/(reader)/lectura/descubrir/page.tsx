import { ReadingDiscover } from "@/components/home/ReadingDiscover";

export const metadata = { title: "Descubrir lectura · MangaTotal" };

export default function DescubrirLecturaPage() {
  return <div data-od-id="reading-discover-page">
    <h1 className="sr-only">Descubrir lectura</h1>
    <form action="/explorar" className="od-discover-tools" role="search" aria-label="Buscar lectura">
      <input type="hidden" name="fuente" value="mangadex" />
      <input name="q" type="search" placeholder="Buscá tu próxima lectura en MangaDex…" aria-label="Buscar manga" />
      <button className="od-outline">Buscar →</button>
    </form>
    <ReadingDiscover />
  </div>;
}
