// QA aislada: biblioteca, fuentes y progreso ficticios; no accede a cuentas reales.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const base = process.env.QA_URL || "http://localhost:3148";

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  try {
    for (const variante of ["web", "windows", "android-local", "android-play"]) {
      const android = variante.startsWith("android");
      const context = await browser.newContext({ viewport: android ? { width: 412, height: 915 } : { width: 1365, height: 1000 },
        serviceWorkers: "block", hasTouch: android, isMobile: android,
        userAgent: "Mozilla/5.0 AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36 " +
          (android ? `MangaTotalApp/24 MangaTotalChannel/${variante === "android-play" ? "play" : "local"}` : "") });
      const rows = Array.from({ length: 60 }, (_, i) => ({ source: "olympus", external_id: `obra-${i}-20260827-110518270`,
        slug: `obra-${i}-20260827-110518270`, title: `Serie ${String(i).padStart(2, "0")}`, type: "comic",
        cover_url: "/icons/mangatotal-v2-192.png", last_chapter_name: "105", last_chapter_id: "105", saved: true }));
      await context.addInitScript(v => { if (v === "windows") window.__TAURI__ = { app: { getVersion: async () => "1.12.0" } }; }, variante);
      const writes = [], errors = [];
      await context.route("**/api/**", async route => {
        const request = route.request(), p = new URL(request.url()).pathname;
        if (request.method() !== "GET") writes.push(p);
        let data = [];
        if (p === "/api/externo/biblioteca") data = rows;
        else if (p === "/api/auth/me") data = { id: 999901, nickname: "QA", anime_enabled: false };
        else if (p === "/api/externo/progreso") data = { saved: true, last_chapter_id: "105", last_chapter_name: "105", last_page_number: 8, read_through_number: 105, chapters: [] };
        else if (p.startsWith("/api/externo/olympus/series/")) data = {
          serie: { id: 40, slug: "obra-40-20260923-080456839", title: "Serie 40", type: "comic", genres: [], summary: "Descripción de prueba", status: "Activo", chapter_count: 106, team: "Olympus", url_original: "https://olympusxyz.com" },
          chapters: [{ id: 105, name: "105", published_at: "2026-09-01", team: "Olympus" }],
        };
        await route.fulfill({ json: data });
      });
      const page = await context.newPage();
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(base + "/mas");
      await page.getByRole("link", { name: /Fuentes Tus series/ }).click();
      await page.getByLabel("60 series guardadas").waitFor();
      await page.getByRole("link", { name: /Olympus Scanlation/ }).click();
      const fila = page.getByRole("link", { name: /Serie 40 Vas por el cap. 105/ });
      await fila.scrollIntoViewIfNeeded();
      const y = await page.evaluate(() => window.scrollY);
      assert.ok(y > 1000);
      await fila.click();
      await page.getByRole("heading", { name: "Serie 40", exact: true }).waitFor();
      await page.getByRole("button", { name: "En mi biblioteca" }).waitFor();
      await page.getByText("vas por acá").waitFor();
      await page.getByRole("link", { name: "← Series de esta fuente" }).click();
      await fila.waitFor();
      await page.waitForFunction(y => Math.abs(window.scrollY - y) < 120, y);
      await fila.click();
      await page.getByRole("heading", { name: "Serie 40", exact: true }).waitFor();
      await page.goBack();
      await fila.waitFor();
      await page.waitForFunction(y => Math.abs(window.scrollY - y) < 120, y);
      await page.goto(base + "/externo/olympus/obra-40-20260923-080456839");
      await page.getByRole("button", { name: "En mi biblioteca" }).waitFor();
      await page.getByRole("link", { name: "← Explorar", exact: true }).waitFor();
      assert.equal(await page.getByRole("link", { name: "← Series de esta fuente" }).count(), 0);
      assert.equal(writes.filter(p => p !== "/api/analytics").length, 0);
      assert.deepEqual(errors, []);
      console.log(variante + ": conteo, ficha, identidad importada, regreso y scroll correctos; sin escrituras");
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
