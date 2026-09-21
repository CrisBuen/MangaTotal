// Ejecutar contra next start local. Todas las APIs se simulan: nunca modifica cuentas.
// PLAYWRIGHT_MODULE permite reutilizar una instalación de Playwright sin agregar dependencias.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const base = process.env.QA_URL || "http://localhost:3147";
const artefactos = fs.mkdtempSync(path.join(os.tmpdir(), "mangatotal-biblioteca-"));
const variantes = ["web", "windows", "android-local", "android-play"];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  try {
    for (const variante of variantes) {
      const android = variante.startsWith("android");
      const context = await browser.newContext({ viewport: android ? { width: 412, height: 915 } : { width: 1365, height: 1000 },
        serviceWorkers: "block", hasTouch: android, isMobile: android,
        userAgent: "Mozilla/5.0 " + (android ? "Linux; Android 14 " : "Windows NT 10.0 ") + "AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36 " +
          (android ? "MangaTotalApp/22 MangaTotalChannel/" + (variante === "android-play" ? "play" : "local") : "") });
      let visitas = 0, usuario = 999901;
      const errores = [];
      const guardadas = Array.from({ length: 12 }, (_, i) => ({
        source: "mangadex", external_id: "qa-" + i, slug: "serie-" + i, title: "Serie " + (i + 1),
        cover_url: "/icons/mangatotal-v2-192.png", type: "normal", last_chapter_name: i === 0 ? "1" : null,
        last_page_number: 2, created_at: "2026-01-01", updated_at: "2026-09-20",
        href: "/externo/qa/" + i, href_continuar: "/leer-externo/qa-capitulo"
      }));
      const anime = [{ source: "jkanime", external_id: "qa-anime", slug: "qa-anime", title: "Anime de prueba", cover_url: "/icons/mangatotal-v2-192.png",
        type: "TV", status: "En emision", total_episodes: 10, last_episode_number: "1", completed: true, href: "/explorar/jkanime/qa-anime",
        last_position_seconds: 0, last_duration_seconds: 100, created_at: "2026-01-01", last_watched_at: "2026-09-20" }];
      await context.addInitScript(v => {
        window.__qaServicios = [];
        if (v.startsWith("android")) window.Capacitor = { isNativePlatform: () => true, Plugins: { Actualizacion: { estado: async x => { window.__qaServicios.push(x); } } } };
        if (v === "windows") window.__TAURI__ = { app: { getVersion: async () => "1.10.0" } };
      }, variante);
      await context.route("**/api/**", async route => {
        const u = new URL(route.request().url()), p = u.pathname;
        let data = [];
        if (p === "/api/auth/me") data = { id: usuario, nickname: "QA", anime_enabled: true, anime_terms_accepted: true };
        else if (p === "/api/externo/biblioteca") data = guardadas;
        else if (p === "/api/externo/series" || p === "/api/externo/olympus/series") data = { series: [], total: 0, page: 1, last_page: 1 };
        else if (p.startsWith("/api/externo/series/")) {
          visitas++; await new Promise(r => setTimeout(r, 350));
          data = { chapters: [{ number: "1" }, { number: "2" }, { number: "5" }], status: "completed" };
        } else if (p === "/api/anime/externo/biblioteca") data = anime;
        else if (p === "/api/anime/externo/historial") data = { historial: [], continuar: [] };
        else if (p === "/api/anime/jkanime/qa-anime") data = { episodes: [{ number: "1" }, { number: "12" }], total_episodes: 12, last_page: 1 };
        else if (p === "/api/externo/chapters/qa-capitulo") data = { pages: [], chapter: { number: "1" } };
        else if (p === "/api/anime/novedades") data = {};
        else if (p === "/api/analytics") { await route.fulfill({ status: 204 }); return; }
        await route.fulfill({ json: data });
      });
      const page = await context.newPage();
      page.on("pageerror", e => errores.push(e.message));
      await page.goto(base + "/biblioteca");
      const menu = page.getByRole("button", { name: "Opciones de biblioteca de lectura", exact: true });
      await menu.click();
      await page.getByRole("tab", { name: "ordenar", exact: true }).click();
      await page.getByLabel("Alfabéticamente", { exact: true }).check();
      await page.getByRole("tab", { name: "apariencia", exact: true }).click();
      await page.getByLabel("Lista", { exact: true }).check();
      await page.screenshot({ path: path.join(artefactos, variante + "-menu.png") });
      await page.getByRole("button", { name: "Cerrar opciones" }).click();
      assert.equal(await page.locator('.biblioteca-grid[data-vista="lista"]').count() > 0, true);
      await page.getByRole("button", { name: "Marcar favorito: Serie 1", exact: true }).click();
      await menu.click();
      await page.getByRole("tab", { name: "filtrar", exact: true }).click();
      await page.getByLabel("Favoritos", { exact: true }).check();
      await page.getByRole("button", { name: "Cerrar opciones" }).click();
      assert.equal(await page.locator(".biblioteca-grid .biblioteca-tarjeta").count(), 1);
      await menu.click(); await page.getByRole("button", { name: "Limpiar filtros" }).click();
      await page.getByRole("button", { name: "Cerrar opciones" }).click();
      await page.getByRole("button", { name: /Actualizar todo/ }).click();
      const cola = () => page.evaluate(() => Object.keys(localStorage).filter(k => k.includes("biblioteca-cola") && k.endsWith(":lectura")).map(k => JSON.parse(localStorage.getItem(k)))[0]);
      await page.waitForFunction(() => Object.keys(localStorage).some(k => k.endsWith(":lectura") && k.includes("biblioteca-cola") && JSON.parse(localStorage.getItem(k)).hechas.length >= 2));
      await page.getByRole("link", { name: "Explorar", exact: true }).first().click();
      await page.waitForURL("**/explorar**");
      await page.waitForFunction(() => Object.keys(localStorage).some(k => k.endsWith(":lectura") && k.includes("biblioteca-cola") && JSON.parse(localStorage.getItem(k)).estado === "terminado"));
      assert.equal((await cola()).hechas.length, 12);
      assert.equal(visitas, 12, "no duplicar fichas al navegar");
      await page.goto(base + "/biblioteca");
      await page.getByRole("button", { name: /Actualizar todo/ }).click();
      await page.waitForFunction(() => Object.keys(localStorage).some(k => k.endsWith(":lectura") && k.includes("biblioteca-cola") && JSON.parse(localStorage.getItem(k)).hechas.length >= 2));
      await page.getByRole("button", { name: "Pausar", exact: true }).click();
      const hechas = (await cola()).hechas.length;
      await page.reload();
      await page.getByRole("button", { name: "Continuar revisión", exact: true }).waitFor();
      assert.equal((await cola()).hechas.length, hechas);
      // Una segunda pestaña comparte la misma cola y no vuelve a empezar.
      const otra = await context.newPage(); await otra.goto(base + "/biblioteca");
      await page.getByRole("button", { name: "Continuar revisión", exact: true }).click();
      await page.waitForFunction(() => Object.keys(localStorage).some(k => k.endsWith(":lectura") && k.includes("biblioteca-cola") && JSON.parse(localStorage.getItem(k)).estado === "terminado"));
      assert.equal((await cola()).hechas.length, 12);
      await otra.close();
      await page.getByRole("tab", { name: "Anime animado", exact: true }).click();
      await page.getByRole("button", { name: "Opciones de biblioteca animada", exact: true }).click();
      await page.getByRole("tab", { name: "apariencia", exact: true }).click();
      await page.getByLabel("Cuadrícula compacta").check();
      await page.getByRole("button", { name: "Cerrar opciones" }).click();
      await page.getByRole("button", { name: "Actualizar todo", exact: true }).click();
      await page.getByText("Revisión terminada: 1/1", { exact: false }).waitFor();
      await page.getByText("12 ep.", { exact: false }).waitFor();
      await page.screenshot({ path: path.join(artefactos, variante + "-anime.png") });
      if (android) assert.ok(await page.evaluate(() => window.__qaServicios.some(x => x.activo)));
      // La cuenta siguiente no hereda filtros ni trabajo del usuario anterior.
      usuario = 999902; await page.goto(base + "/biblioteca");
      await page.waitForTimeout(500);
      assert.equal(await page.getByRole("button", { name: "Quitar favorito: Serie 1", exact: true }).count(), 0);
      assert.equal(await page.getByText("Revisión terminada:", { exact: false }).count(), 0);
      assert.deepEqual(errores, []);
      console.log(variante + ": menú, favoritos, navegación, pausa/recarga, pestañas, anime y aislamiento OK");
      await context.close();
    }
    console.log("Capturas: " + artefactos);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
