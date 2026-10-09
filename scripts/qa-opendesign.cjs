// Interfaz real de Next; APIs ficticias interceptadas antes de cualquier escritura.
// No inicia sesión, no modifica bibliotecas ni reproduce anuncios/fuentes externas.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const base = process.env.QA_URL || "http://localhost:3157";
const reference = process.env.OD_REFERENCE || "D:/code design/.od/projects/79120258-4b3d-4b90-99cd-9667d4cac0e3/descubrir-streaming.html";
const output = fs.mkdtempSync(path.join(os.tmpdir(), "mangatotal-opendesign-"));
const report = { output, variants: [], errors: [] };
let activePage, activeRequests, activeErrors;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  try {
    const original = await browser.newPage();
    await original.goto(new URL("file:///" + reference).href);
    await original.evaluate(() => document.fonts.ready);
    const artwork = await original.locator(".thumb svg").evaluateAll(nodes => nodes.map(node => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(node))));
    for (const width of [1440, 768, 390]) {
      await original.setViewportSize({ width, height: 1000 });
      await original.screenshot({ path: path.join(output, `original-${width}.png`), fullPage: true });
    }
    await original.close();
    const fixtures = Array.from({ length: 24 }, (_, i) => ({ id: i + 1, slug: "serie-qa-" + i, title: "Historia QA " + (i + 1),
      cover_url: artwork[i % artwork.length] || "/icons/mangatotal-logo-transparent.png", type: "TV", status: "En emisión", description: "Una aventura de prueba para comprobar la interfaz sin modificar cuentas." }));
    const all = [
      { name: "web", width: 1440 }, { name: "tablet", width: 768 },
      { name: "windows", width: 1280 }, { name: "android-local", width: 390 }, { name: "android-play", width: 390 },
    ];
    for (const variant of all) {
      const android = variant.name.startsWith("android");
      const context = await browser.newContext({ viewport: { width: variant.width, height: 1000 }, serviceWorkers: "block", hasTouch: android, isMobile: android,
        userAgent: "Mozilla/5.0 " + (android ? "(Linux; Android 14)" : "(Windows NT 10.0; Win64; x64)") + " AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36 " + (android ? "MangaTotalApp/24 MangaTotalChannel/" + (variant.name === "android-play" ? "play" : "local") : "") });
      const requests = [], mutations = [], errors = [];
      activeRequests = requests; activeErrors = errors;
      let library = [], failCatalog = false, guest = false;
      const watched = { ...fixtures[1], source: "jkanime", external_id: "2", href: "/explorar/jkanime/serie-qa-1", resume_href: "/explorar/jkanime/serie-qa-1/1", last_episode_number: "1", last_position_seconds: 720, last_duration_seconds: 1440, completed: false };
      await context.addInitScript(name => {
        if (name.startsWith("android")) window.Capacitor = { isNativePlatform: () => true, Plugins: { Actualizacion: { estado: async () => {} } } };
        if (name === "windows") window.__TAURI__ = { app: { getVersion: async () => "1.10.0" } };
      }, variant.name);
      await context.route("**/api/**", async route => {
        const req = route.request(), url = new URL(req.url()), p = url.pathname;
        requests.push(p + url.search);
        if (!["GET", "HEAD"].includes(req.method())) mutations.push({ url: p, method: req.method() });
        let data = [];
        if (p === "/api/analytics") return route.fulfill({ status: 204 });
        if (guest && p.startsWith("/api/anime/externo/")) return route.fulfill({ status: 401, json: { error: "Sin sesión" } });
        if (p === "/api/auth/me") data = guest ? {} : { id: 999909, nickname: "QA", anime_enabled: true, anime_terms_accepted: true, show_adult_content: true };
        else if (p === "/api/noticias/externas") data = { noticias: fixtures.slice(0, 5).map(item => ({ titulo: item.title, enlace: "https://example.com/noticia/" + item.id, resumen: item.description, categoria: "Noticias", imagen: item.cover_url })) };
        else if (p === "/api/top-semanal") data = { series: fixtures.map(item => ({ titulo: item.title, portada: item.cover_url, href: "/externo/serie-qa", fuenteNombre: "MangaDex", fuente: "mangadex" })) };
        else if (p === "/api/anime/externo/biblioteca") {
          if (req.method() === "PUT") { library = [{ ...JSON.parse(req.postData()), href: "/explorar/jkanime/serie-qa-0" }]; data = { ok: true }; }
          else if (req.method() === "DELETE") { library = []; data = { ok: true }; }
          else data = library;
        } else if (p === "/api/anime/externo/historial") data = { historial: [watched], continuar: [] };
        else if (p === "/api/anime/externo/progreso") data = { episodes: [{ episode_number: "1", position_seconds: 720, duration_seconds: 1440, completed: false }] };
        else if (/^\/api\/anime\/(jkanime|tioanime)$/.test(p)) {
          if (failCatalog) return route.fulfill({ status: 503, json: { error: "Fallo simulado de la fuente" } });
          data = { series: fixtures, page: Number(url.searchParams.get("page") || 1), lastPage: 3, total: 72, adult_enabled: !android };
        } else if (/^\/api\/anime\/(jkanime|tioanime)\//.test(p)) {
          const i = Number(p.split("serie-qa-")[1] || 0);
          data = { ...fixtures[i], total_episodes: 24, genres: ["Acción", "Aventura"], page: Number(url.searchParams.get("page") || 1), last_page: 2,
            episodes: [{ id: "ep1", number: "1", title: "El comienzo" }, { id: "ep2", number: "2", title: "El viaje" }] };
        } else if (p === "/api/externo/series") data = { series: [], total: 0 };
        else if (p === "/api/anime/novedades") data = {};
        await route.fulfill({ json: data });
      });
      const page = await context.newPage();
      activePage = page;
      page.on("pageerror", err => errors.push(err.message));
      await page.goto(base + "/explorar?seccion=animada&anime_fuente=jkanime");
      await page.getByRole("button", { name: "Ver ficha de Historia QA 1", exact: true }).first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "La página no debe desbordarse");
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).fontFamily.toLowerCase().includes("lato")), true, "Tipografía Lato autoalojada");
      const atStart = requests.filter(url => /^\/api\/anime\/jkanime\?/.test(url));
      assert.equal(atStart.length, 1, "No cargar todos los géneros al abrir");
      assert.equal(await page.getByText("Episodio 1 · 12:00", { exact: true }).count(), 1);
      if (variant.name === "android-play") assert.equal(await page.getByRole("button", { name: "HentaiTV", exact: true }).count(), 0);
      await page.screenshot({ path: path.join(output, variant.name + "-inicio.png"), fullPage: false });
      await page.getByRole("button", { name: "Destacado 2: Historia QA 2", exact: true }).click();
      assert.equal(await page.locator('.od-slide[data-active="true"] h2').textContent(), "Historia QA 2");
      await page.getByRole("button", { name: "Ver ficha de Historia QA 1", exact: true }).first().click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("link", { name: /Continuar · Ep\. 1 · 12:00/ }).waitFor();
      assert.equal(await page.getByRole("dialog").evaluate(node => node.scrollWidth <= node.clientWidth + 1 && node.scrollLeft === 0), true, "Ficha sin desbordamiento al enfocar cerrar");
      await page.getByRole("button", { name: "Guardar en Anime animado", exact: true }).click();
      await page.getByRole("button", { name: "En Anime animado", exact: true }).waitFor();
      assert.equal(library.length, 1);
      await page.getByRole("button", { name: "Siguiente →", exact: true }).click();
      await page.getByText("Página 2 de 2", { exact: true }).waitFor();
      await page.screenshot({ path: path.join(output, variant.name + "-ficha.png") });
      await page.goBack();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(await page.locator(".od-discover").count(), 1, "Atrás cierra la ficha sin salir del catálogo");
      await page.goForward();
      await page.getByRole("dialog").waitFor();
      assert.equal(new URL(page.url()).hash, "#ficha-anime", "Adelante restaura la misma ficha");
      await page.goBack();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "Ver ficha de Historia QA 1", exact: true }).first().click();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.locator('.od-genre-grid a').filter({ hasText: "Fantasía" }).click();
      await page.getByRole("link", { name: /Historia QA 1 / }).first().waitFor();
      assert.equal(new URL(page.url()).searchParams.get("genre"), "fantasia");
      await page.getByRole("button", { name: "Siguiente →", exact: true }).click();
      await page.getByText(/Página 2 de 3/).waitFor();
      assert(requests.some(url => url.includes("page=2") && url.includes("genre=fantasia")));
      await page.reload();
      await page.getByText(/Página 2 de 3/).waitFor();
      assert.equal(new URL(page.url()).searchParams.get("anime_page"), "2", "La recarga conserva la página del directorio");
      await page.screenshot({ path: path.join(output, variant.name + "-catalogo.png") });
      await page.goto(base + "/explorar?seccion=animada&anime_fuente=tioanime&vista=catalogo&genre=ciencia-ficcion&q=aventura");
      await page.getByPlaceholder("Buscar anime...").waitFor();
      assert.equal(await page.getByPlaceholder("Buscar anime...").inputValue(), "aventura");
      await page.getByRole("link", { name: /Historia QA 1 / }).first().waitFor();
      assert(requests.some(url => url.includes("/tioanime?") && url.includes("q=aventura") && url.includes("genre=ciencia-ficcion")));
      await page.getByRole("button", { name: "JKAnime", exact: true }).click();
      await page.getByRole("button", { name: "Ver ficha de Historia QA 1", exact: true }).first().waitFor();
      assert.equal(new URL(page.url()).searchParams.get("q"), null, "Cambiar de fuente limpia la búsqueda anterior");
      assert.equal(new URL(page.url()).searchParams.get("genre"), null, "Cambiar de fuente limpia el género anterior");
      await page.goto(base + "/explorar?seccion=animada&anime_fuente=jkanime");
      await page.getByRole("button", { name: "Ver ficha de Historia QA 1", exact: true }).first().waitFor();
      await page.getByRole("heading", { name: "Mundos de fantasía", exact: true }).scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelectorAll(".od-lazy-rail .od-media-card").length > 0);
      await page.screenshot({ path: path.join(output, variant.name + "-rieles.png") });
      failCatalog = true;
      await page.goto(base + "/explorar?seccion=animada&anime_fuente=jkanime");
      await page.getByRole("button", { name: "Reintentar JKAnime", exact: true }).waitFor();
      failCatalog = false;
      await page.getByRole("button", { name: "Reintentar JKAnime", exact: true }).click();
      await page.getByRole("button", { name: "Ver ficha de Historia QA 1", exact: true }).first().waitFor();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector(".od-slide")).transitionDuration) <= 0.001);
      for (const route of ["/", "/biblioteca", "/mas", "/login", "/registro", "/recuperar"]) {
        await page.goto(base + route);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "Desbordamiento en " + route);
        await page.screenshot({ path: path.join(output, variant.name + "-" + (route.slice(1) || "home") + ".png") });
      }
      if (variant.name === "web") {
        guest = true;
        await page.goto(base + "/explorar?seccion=animada&anime_fuente=jkanime");
        await page.getByRole("button", { name: "Ver ficha de Historia QA 1", exact: true }).first().click();
        await page.getByRole("dialog").waitFor();
        await page.getByRole("button", { name: "Guardar en Anime animado", exact: true }).waitFor();
        assert.equal(await page.getByText(/No se pudo consultar tu (lista|progreso)/).count(), 0, "Sin sesión no es un fallo de la fuente");
      }
      assert.deepEqual(errors, [], "Sin errores de React/navegación");
      report.variants.push({ ...variant, catalogInitialRequests: atStart.length, requests: requests.length, simulatedMutations: mutations, errors });
      await context.close();
    }
  } catch (err) {
    report.errors.push(err.stack);
    if (activePage && !activePage.isClosed()) {
      await activePage.screenshot({ path: path.join(output, "fallo.png"), fullPage: true });
      report.diagnostic = { url: activePage.url(), text: await activePage.locator("body").innerText(), requests: activeRequests, errors: activeErrors };
    }
    throw err;
  }
  finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
