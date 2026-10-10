// Componente real con cuenta ficticia; no usa cookies ni credenciales del proyecto.
const esbuild = require(process.env.ESBUILD_MODULE || "esbuild"), { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("node:http"), path = require("node:path"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
(async () => {
  const bundle = await esbuild.build({
    stdin: { resolveDir: root, loader: "tsx", contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ExperienceEntry} from './src/components/experience/ExperienceEntry'; createRoot(document.getElementById('app')).render(<ExperienceEntry/>);` },
    bundle: true, write: false, jsx: "automatic", platform: "browser", define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{ name: "cuenta-ficticia", setup(build) {
      build.onResolve({ filter: /^(next\/(navigation|link|image)|\.\/ExperienceShell)$/ }, args => ({ path: args.path, namespace: "qa" }));
      build.onLoad({ filter: /^next\/navigation$/, namespace: "qa" }, () => ({ loader: "js", contents: `export const usePathname=()=>location.pathname; export const useSearchParams=()=>new URLSearchParams(location.search); export const useRouter=()=>({push:href=>window.__destino=href,refresh:()=>{}});` }));
      build.onLoad({ filter: /.*/, namespace: "qa" }, args => ({ loader: "tsx", resolveDir: root, contents: args.path === "./ExperienceShell" ? `export const useExperience=()=>({user:location.search.includes('guest')?null:{nickname:'Cuenta QA',avatarPath:null,isAdmin:false},animeEnabled:!location.search.includes('play')});` : args.path === "next/navigation" ? `export const useSearchParams=()=>new URLSearchParams(location.search); export const useRouter=()=>({push:href=>window.__destino=href,refresh:()=>{}});` : args.path === "next/link" ? `export default function Link({children,...p}){return <a {...p}>{children}</a>}` : `export default function Image(p){return <img {...p}/ >}` }));
    } }],
  });
  const server = http.createServer((req, res) => { res.setHeader("Content-Type", req.url === "/bundle.js" ? "application/javascript" : "text/html"); res.end(req.url === "/bundle.js" ? bundle.outputFiles[0].text : '<div id="app"></div><script src="/bundle.js"></script>'); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ executablePath: process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  try {
    const page = await browser.newPage();
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base);
    await page.getByRole('heading', { name: '¿Continuamos?' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Continuar como Cuenta QA' }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Cerrar sesión' }).count(), 1);
    await page.getByRole('button', { name: 'Continuar como Cuenta QA' }).click();
    await page.getByRole('heading', { name: '¿Qué te apetece hoy?' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: '¿Qué te apetece hoy?' }).evaluate(n => n === document.activeElement), true);
    await page.getByRole('button', { name: /Entrar a anime/ }).click();
    assert.equal(await page.evaluate(() => window.__destino), '/explorar?seccion=animada');
    await page.goto(base + '/?elegir=1');
    await page.getByRole('button', { name: /Entrar a lectura/ }).click();
    assert.equal(await page.evaluate(() => window.__destino), '/lectura');
    await page.goto(base + '/?guest=1');
    await page.getByRole('heading', { name: '¿Qué te apetece hoy?' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Cerrar sesión' }).count(), 0);
    await page.goto(base + '/?guest=1&play=1');
    await page.getByRole('button', { name: /Configurar acceso/ }).click();
    assert.equal(await page.evaluate(() => window.__destino), '/login');
    console.log('OK cuenta existente → selección → lectura/anime; cambio de sección; invitado y activación Play. Sin modificar cuentas.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
