/**
 * Script de verificación para la integración de MundoDonghua.
 * Ejecutar con: npx.cmd tsx scripts/verificar-mundodonghua.cjs
 */
const assert = require("assert");

async function main() {
  console.log("=== Verificando MundoDonghua ===");
  const {
    catalogoMundodonghua,
    fichaMundodonghua,
    reproduccionMundodonghua,
    GENEROS_MUNDODONGHUA,
  } = await import("../src/lib/mundodonghua.ts");

  // 1. Catálogo
  console.log("1. Probando catálogo público...");
  const cat = await catalogoMundodonghua({ page: 1 });
  assert(cat.series.length > 0, "El catálogo debería devolver series");
  assert(cat.lastPage >= 1, "lastPage debería ser >= 1");
  console.log(`✓ Catálogo OK: ${cat.series.length} series en pág 1 (total págs: ${cat.lastPage})`);

  // 2. Búsqueda
  console.log("2. Probando búsqueda ('renegade')...");
  const busq = await catalogoMundodonghua({ q: "renegade" });
  assert(busq.series.length > 0, "La búsqueda debería encontrar resultados");
  const encontrada = busq.series.find((s) => s.slug.includes("renegade"));
  assert(encontrada, "Debería encontrar renegade-immortal");
  console.log(`✓ Búsqueda OK: encontrada serie '${encontrada.title}' (${encontrada.slug})`);

  // 3. Ficha
  console.log(`3. Probando ficha de '${encontrada.slug}'...`);
  const ficha = await fichaMundodonghua(encontrada.slug, 1);
  assert(ficha.title.length > 0, "La ficha debería tener título");
  assert(ficha.total_episodes > 0, "La ficha debería tener episodios");
  assert(ficha.episodes.length > 0, "La lista paginada de episodios no debe estar vacía");
  console.log(`✓ Ficha OK: '${ficha.title}' con ${ficha.total_episodes} episodios`);

  // 4. Reproducción
  const ep = ficha.episodes[0].number;
  console.log(`4. Probando reproducción del episodio ${ep}...`);
  const repro = await reproduccionMundodonghua(encontrada.slug, ep);
  assert(repro.sources.length > 0, "Debe encontrar al menos un servidor compatible");
  assert(repro.playback.url.startsWith("http"), "La URL de embed debe ser absoluta");
  console.log(`✓ Reproducción OK: servidor '${repro.selected_source}', URL: ${repro.playback.url}`);
  console.log(`  Servidores detectados: ${repro.sources.map((s) => s.label).join(", ")}`);

  console.log("\n Todos los tests de MundoDonghua pasaron exitosamente!");
}

main().catch((err) => {
  console.error(" Error en verificación:", err);
  process.exit(1);
});
