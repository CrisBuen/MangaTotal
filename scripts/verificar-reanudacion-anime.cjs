// Prueba el componente real sin credenciales ni escrituras en cuentas.
// ESBUILD_MODULE y PLAYWRIGHT_MODULE permiten usar las herramientas locales.
// QA_JK_REAL=1 abre un episodio real: manifiesto solo en memoria y video CDN→navegador.
// QA_BASELINE=1 ejecuta la misma regresión contra el componente del último commit.
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const esbuild = require(process.env.ESBUILD_MODULE || "esbuild");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const raiz = path.join(__dirname, "..");
const real = process.env.QA_JK_REAL === "1";

function instalarPrueba(real) {
  const params = new URLSearchParams(location.search);
  const qa = window.__qa = {
    patches: [], plays: [], hls: [], gets: 0, preparations: 0,
    fallo: params.has("fallo"), posicion: params.has("nuevo") ? 0 : Number(params.get("pos") || 720),
    kind: params.get("kind") || "hls", completed: params.has("completed"),
    native: params.has("native"), rechazarSeek: params.has("seek-tardio"),
  };
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (url, options = {}) => {
    if (String(url).startsWith("/api/anime/externo/progreso")) {
      if (options.method === "PATCH") {
        qa.patches.push(JSON.parse(options.body));
        return Response.json({ ok: true });
      }
      qa.gets++;
      if (qa.fallo) return Response.json({ error: "Fallo simulado" }, { status: 503 });
      return Response.json({ position_seconds: qa.posicion, duration_seconds: params.has("nuevo") ? 0 : 1440, completed: qa.completed });
    }
    if (String(url).startsWith("/api/anime/")) {
      if (real) return originalFetch("/reproduccion");
      const source = new URL(String(url), location.origin).searchParams.get("source") || "desu";
      return Response.json({
        external_id: "qa-serie", slug: "qa-serie", series_title: "Serie ficticia QA", cover_url: null,
        total_episodes: 12, episode_id: "qa-episodio", episode_number: "1", episode_title: "Episodio 1", poster_url: null,
        sources: [{ id: "desu", label: "Desu", kind: qa.kind }, { id: "magi", label: "Magi", kind: qa.kind }],
        selected_source: source, playback: { kind: qa.kind, url: qa.kind === "embed" ? "about:blank" : "/video-ficticio" },
      });
    }
    return originalFetch(url, options);
  };
  if (real) return;
  const estados = new WeakMap();
  const estado = video => {
    if (!estados.has(video)) estados.set(video, { tiempo: 0, duracion: NaN, ready: 0, seeking: false, paused: true });
    return estados.get(video);
  };
  const evento = (video, name) => video.dispatchEvent(new Event(name));
  Object.defineProperties(HTMLMediaElement.prototype, {
    currentTime: {
      configurable: true,
      get() { return estado(this).tiempo; },
      set(value) {
        if (qa.rechazarSeek) { qa.rechazarSeek = false; throw new DOMException("Metadatos todavía incompletos"); }
        const s = estado(this);
        s.seeking = true;
        setTimeout(() => {
          s.tiempo = value; s.seeking = false;
          evento(this, "timeupdate"); evento(this, "seeked"); evento(this, "canplay");
        }, 20);
      },
    },
    duration: { configurable: true, get() { return estado(this).duracion; } },
    readyState: { configurable: true, get() { return estado(this).ready; } },
    seeking: { configurable: true, get() { return estado(this).seeking; } },
    paused: { configurable: true, get() { return estado(this).paused; } },
    src: { configurable: true, get() { return ""; }, set() { qa.preparations++; } },
  });
  HTMLMediaElement.prototype.load = function () {
    Object.assign(estado(this), { tiempo: 0, duracion: NaN, ready: 0, seeking: false });
    evento(this, "timeupdate");
  };
  HTMLMediaElement.prototype.pause = function () { estado(this).paused = true; evento(this, "pause"); };
  HTMLMediaElement.prototype.play = function () {
    estado(this).paused = false; qa.plays.push(this.currentTime); evento(this, "play"); return Promise.resolve();
  };
  HTMLMediaElement.prototype.canPlayType = () => qa.native ? "probably" : "";
  qa.ready = () => {
    const video = document.querySelector("video");
    Object.assign(estado(video), { ready: 1, duracion: 1440 });
    evento(video, "loadedmetadata"); evento(video, "durationchange"); evento(video, "canplay");
  };
  qa.avanzar = value => {
    const video = document.querySelector("video");
    estado(video).tiempo = value; evento(video, "timeupdate");
  };
}

const hlsSimulado = `export default class Hls {
  static Events = { MEDIA_ATTACHED:'attached', MANIFEST_PARSED:'manifest', ERROR:'error' };
  static isSupported() { return !window.__qa.native; }
  constructor(config) { this.config=config; this.handlers={}; window.__qa.hls.push(config); }
  on(name, callback) { this.handlers[name]=callback; }
  attachMedia(video) { this.video=video; queueMicrotask(()=>this.handlers.attached?.()); }
  loadSource() {
    window.__qa.preparations++;
    this.handlers.manifest?.('manifest', { levels:[], subtitleTracks:[] });
    this.video.dispatchEvent(new Event('timeupdate'));
  }
  destroy() { this.video?.load(); this.video?.pause(); }
}`;

(async () => {
  const bundle = await esbuild.build({
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { ReproductorAnimeExterno } from './src/components/anime/JkanimePlayer';
      (${instalarPrueba.toString()})(${real});
      const root = createRoot(document.getElementById('app'));
      window.__qa.unmount = () => root.unmount();
      root.render(<ReproductorAnimeExterno slug="${real ? "tensei-shitara-ken-deshita-ii" : "qa-serie"}"
        episode="${real ? "2" : "1"}" source="jkanime" sourceName="JKAnime" />);
    `, resolveDir: raiz, loader: "tsx" },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{ name: "qa-sin-cuentas", setup(build) {
      build.onResolve({ filter: /^(next\/navigation|@\/lib\/pantalla)$/ }, args => ({ path: args.path, namespace: "qa" }));
      if (!real) build.onResolve({ filter: /^hls\.js$/ }, () => ({ path: "hls", namespace: "qa" }));
      build.onLoad({ filter: /.*/, namespace: "qa" }, args => ({ contents:
        args.path === "hls" ? hlsSimulado : args.path === "next/navigation"
          ? "export const useRouter=()=>({push:()=>window.__qa.unmount()});"
          : `export const enAppAndroid=()=>false, pantallaCompletaEsTotal=()=>false;
             export const activarReproductorHorizontalAndroid=async()=>{}, activarPantallaCompleta=async()=>{},
             salirReproductorHorizontalAndroid=async()=>{}, salirPantallaCompleta=async()=>{};`, loader: "js" }));
      if (process.env.QA_BASELINE === "1") build.onLoad({ filter: /JkanimePlayer\.tsx$/ }, () => ({
        contents: execFileSync("git", ["show", "HEAD:src/components/anime/JkanimePlayer.tsx"], { cwd: raiz, encoding: "utf8" }),
        resolveDir: path.join(raiz, "src/components/anime"), loader: "tsx",
      }));
    } }],
  });
  let reproduccion;
  if (real) {
    const codigo = await esbuild.transform(fs.readFileSync(path.join(raiz, "src/lib/jkanime.ts"), "utf8"), { loader: "ts", format: "cjs" });
    const modulo = { exports: {} };
    new Function("module", "exports", "require", codigo.code)(modulo, modulo.exports, require);
    const datos = await modulo.exports.reproduccionJkanime("tensei-shitara-ken-deshita-ii", "2");
    assert.equal(datos.playback.kind, "hls", "El episodio real no entregó HLS nativo");
    reproduccion = datos;
  }
  const server = http.createServer((req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.url === "/qa.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].contents); return; }
    if (req.url === "/reproduccion" && reproduccion) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ...reproduccion, playback: { kind: "hls", url: "/manifest" } })); return;
    }
    if (req.url === "/manifest" && reproduccion) {
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl"); res.end(reproduccion.playback.manifest); return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script src="/qa.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    executablePath: process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true, args: ["--autoplay-policy=no-user-gesture-required"],
  });
  try {
    const page = await browser.newPage();
    const errores = [];
    page.on("pageerror", error => errores.push(error.message));
    const abrir = async query => {
      await page.goto(`http://127.0.0.1:${server.address().port}/${query || ""}`);
      await page.waitForFunction(() => window.__qa?.gets > 0);
    };
    if (real) {
      await abrir();
      await page.waitForFunction(() => {
        const video = document.querySelector("video");
        return video && video.currentTime >= 720 && video.currentTime < 740 && !video.paused && video.readyState >= 3;
      }, null, { timeout: 45000 });
      const antes = await page.locator("video").evaluate(video => video.currentTime);
      await page.waitForFunction(tiempo => document.querySelector("video").currentTime >= tiempo + 2, antes);
      await page.evaluate(() => window.__qa.unmount());
      const patches = await page.evaluate(() => window.__qa.patches);
      assert.ok(patches.length > 0 && patches.every(patch => patch.position_seconds >= 720));
      assert.deepEqual(errores, []);
      console.log("Episodio real JKAnime: HLS reproducido desde 12:00, reloj avanza y salida conserva el minuto. Sin cuenta real.");
    } else {
      for (const query of ["", "?pos=184", "?seek-tardio=1", "?kind=mp4", "?native=1"]) {
        await abrir(query);
        await page.waitForFunction(() => window.__qa.preparations > 0);
        assert.deepEqual(await page.evaluate(() => window.__qa.patches), [], "No guardar cero antes de metadatos");
        assert.deepEqual(await page.evaluate(() => window.__qa.plays), [], "No reproducir antes de restaurar");
        await page.evaluate(() => window.__qa.ready());
        await page.waitForFunction(() => window.__qa.plays.length > 0);
        assert.equal(await page.locator("video").evaluate(video => video.currentTime), query.includes("184") ? 184 : 720);
        assert.ok(await page.evaluate(() => window.__qa.patches.every(p => p.position_seconds === window.__qa.posicion)));
        await page.evaluate(() => window.__qa.avanzar(742));
        // Un seek del usuario posterior no debe volver a imponer el marcador inicial.
        await page.locator("video").evaluate(video => { video.currentTime = 750; });
        await page.waitForFunction(() => document.querySelector("video").currentTime === 750);
        await page.getByRole("button", { name: "Magi", exact: true }).click();
        await page.waitForFunction(() => window.__qa.preparations >= 2);
        await page.evaluate(() => window.__qa.ready());
        await page.waitForFunction(() => document.querySelector("video").currentTime === 750 && !document.querySelector("video").paused);
        await page.evaluate(() => { window.__qa.avanzar(754); window.__qa.unmount(); });
        const patches = await page.evaluate(() => window.__qa.patches);
        assert.equal(patches.at(-1).position_seconds, 754);
        assert.ok(patches.every(p => p.position_seconds > 0), "El vaciado del video no guarda cero");
        console.log(`OK reanudación, seek, cambio de servidor y salida: ${query || "HLS"}`);
      }
      await abrir("?fallo=1");
      await page.getByText("No se pudo recuperar el minuto guardado. Reintentá para conservar tu progreso.").waitFor();
      assert.deepEqual(await page.evaluate(() => window.__qa.patches), []);
      await page.evaluate(() => { window.__qa.fallo = false; });
      await page.getByRole("button", { name: "Reintentar", exact: true }).click();
      await page.waitForFunction(() => window.__qa.gets === 2 && window.__qa.preparations > 0);
      await page.evaluate(() => window.__qa.ready());
      await page.waitForFunction(() => document.querySelector("video").currentTime === 720);
      console.log("OK fallo de progreso: no sobreescribe y reintento vuelve a consultar el marcador");
      await abrir();
      await page.waitForFunction(() => window.__qa.preparations > 0);
      await page.evaluate(() => { window.dispatchEvent(new Event("pagehide")); window.__qa.unmount(); });
      assert.deepEqual(await page.evaluate(() => window.__qa.patches), []);
      console.log("OK salida antes de metadatos: conserva el marcador sin escribir");
      await abrir("?nuevo=1");
      await page.waitForFunction(() => window.__qa.preparations > 0);
      const apertura = await page.evaluate(() => window.__qa.patches);
      assert.equal(apertura.length, 1);
      assert.equal(apertura[0].position_seconds, 0);
      await page.evaluate(() => window.__qa.ready());
      await page.waitForFunction(() => window.__qa.plays.length > 0);
      console.log("OK episodio nuevo: registra historial y reproduce desde cero");
      await abrir("?completed=1");
      await page.waitForFunction(() => window.__qa.preparations > 0);
      assert.deepEqual(await page.evaluate(() => window.__qa.patches), []);
      await page.evaluate(() => window.__qa.ready());
      await page.waitForFunction(() => window.__qa.plays.length > 0);
      assert.equal(await page.locator("video").evaluate(video => video.currentTime), 0);
      console.log("OK episodio completado: repetición desde cero intencional");
      await abrir("?kind=embed");
      await page.locator("iframe").waitFor();
      await page.evaluate(() => { window.dispatchEvent(new Event("pagehide")); window.__qa.unmount(); });
      assert.deepEqual(await page.evaluate(() => window.__qa.patches), []);
      console.log("OK iframe alternativo: no inventa ni borra el minuto del reproductor nativo");
      assert.deepEqual(errores, []);
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
