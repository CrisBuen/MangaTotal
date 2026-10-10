// Lector real de Next + transporte de prueba que reproduce el contrato nativo.
// Solo consultas públicas. No es una prueba del binario Android/Tauri instalado.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const base = process.env.QA_URL || "http://localhost:3157";
const output = fs.mkdtempSync(path.join(os.tmpdir(), "mangatotal-ikigai-real-"));
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  try {
    const results = [];
    for (const variant of ["local", "play", "windows"]) {
      const ua = variant === "windows" ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" : `Mozilla/5.0 (Linux; Android 14) MangaTotalApp/24 MangaTotalChannel/${variant}`;
      const context = await browser.newContext({ userAgent: ua, viewport: { width: variant === "windows" ? 1280 : 390, height: 900 }, serviceWorkers: "block" });
      const page = await context.newPage(), calls = [], errors = [];
      page.on("pageerror", err => errors.push(err.message));
      await page.exposeFunction("qaPagina", async url => {
        const u = new URL(url);
        assert.equal(u.origin, "https://visorikigai.gettocaboca.com");
        const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
        assert.equal(r.status, 200); calls.push({ kind: "html", status: r.status });
        return { status: r.status, data: await r.text() };
      });
      await page.exposeFunction("qaImagen", async url => {
        const u = new URL(url);
        assert.ok(["image2.ikigaimangas.cloud", "image3.ikigaimangas.cloud"].includes(u.hostname));
        assert.equal(u.protocol, "https:"); assert.equal(u.search, "");
        const r = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000), headers: { Referer: "https://visorikigai.gettocaboca.com/", "Sec-Fetch-Mode": "cors" } });
        assert.equal(r.status, 200);
        const bytes = Buffer.from(await r.arrayBuffer()); assert.ok(bytes.length < 20 * 1024 * 1024);
        calls.push({ kind: "image", status: r.status, bytes: bytes.length });
        return { data: bytes.toString("base64") };
      });
      await page.addInitScript(variant => {
        if (variant === "windows") window.__TAURI__ = { core: { invoke: async (name, args) => {
          if (name === "traer_pagina") return (await window.qaPagina(args.url)).data;
          if (name === "traer_imagen") return [...Uint8Array.from(atob((await window.qaImagen(args.url)).data), c => c.charCodeAt(0))];
        } } };
        else window.Capacitor = { isNativePlatform: () => true, Plugins: { Fuentes: { traerPagina: args => window.qaPagina(args.url), traerImagen: args => window.qaImagen(args.url) } } };
      }, variant);
      // Invitado: ninguna respuesta privada ni escrituras reales en la app.
      await context.route("**/api/**", route => route.fulfill({ status: route.request().url().includes("analytics") ? 204 : 401, ...(route.request().url().includes("analytics") ? {} : { json: { error: "Sin sesión QA" } }) }));
      const start = Date.now();
      await page.goto(base + "/leer-externo/ikigai/1135592572277784579?slug=ya-puedo-llorar");
      await page.locator('img[alt="Página 1"]').waitFor({ state: "attached", timeout: 45000 });
      const metadataMs = Date.now() - start;
      await page.waitForFunction(() => { const i = document.querySelector('img[alt="Página 1"]'); return i?.complete && i.naturalWidth > 100; }, null, { timeout: 45000 });
      const firstImageMs = Date.now() - start;
      const pages = page.locator('img[alt^="Página "]');
      assert.equal(await pages.count(), 14);
      for (const n of [2, 3]) {
        await page.locator(`img[alt="Página ${n}"]`).scrollIntoViewIfNeeded();
        await page.waitForFunction(n => { const i = document.querySelector(`img[alt="Página ${n}"]`); return i?.complete && i.naturalWidth > 100; }, n, { timeout: 45000 });
      }
      const dimensions = await pages.evaluateAll(imgs => imgs.slice(0, 3).map(i => ({ width: i.naturalWidth, height: i.naturalHeight })));
      assert.equal(await pages.evaluateAll(imgs => imgs[2].getBoundingClientRect().top >= imgs[1].getBoundingClientRect().bottom - 2), true, "Las tiras largas no se pisan");
      assert.deepEqual(errors, []);
      await page.screenshot({ path: path.join(output, variant + ".png") });
      results.push({ variant, metadataMs, firstImageMs, pages: 14, dimensions, calls: calls.length, imageCalls: calls.filter(c => c.kind === "image").length, errors });
      await context.close();
    }
    console.log(JSON.stringify({ output, results }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
