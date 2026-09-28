// MANGATOTAL_TEST_DOM apunta a linkedom instalado fuera del proyecto.
// MANGATOTAL_TEST_LIVE=1 comprueba además el capítulo real entregado por el dueño.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { DOMParser } = require(process.env.MANGATOTAL_TEST_DOM);
function cargar(file, mocks = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: n => { if (n in mocks) return mocks[n]; throw Error(n); },
    URL, URLSearchParams, DOMParser, AbortController, ...globals });
  return exports;
}
const codigo = cargar('src/lib/leercapituloCodigo.ts');
function cliente(html, nativo = false) {
  return cargar('src/lib/leercapitulo.ts', {
    './fuenteNativa': { fuenteAndroidDisponible: () => false, fuenteNativaDisponible: () => nativo,
      traerDocumento: async () => new DOMParser().parseFromString(html, 'text/html') },
    './desafioHtml': { esDesafioHtml: () => false }, './leercapituloCodigo': codigo,
  }, { fetch: async () => ({ ok: true, json: async () => ({ html }) }) });
}
const img = (i, url = `https://es1s11.t34798ndc.com/${i}.webp`) => `<img data-src="${url}" data-index="${i}">`;
test('El visor nuevo valida índices y conserva el orden explícito', () => {
  const h = `<main id="lcPages">${img(1)}${img(0)}</main>`;
  assert.equal(codigo.paginasDelHtml(h)[0], 'https://es1s11.t34798ndc.com/0.webp');
  for (const body of [img(0)+img(0), img(2), img(0, 'https://otro.test/0.webp'), '<img src="x">']) {
    assert.throws(() => codigo.paginasDelHtml(`<main id="lcPages">${body}</main>`));
  }
});
test('El formato antiguo sigue exigiendo su meta y no devuelve el barajado', () => {
  const encode = text => Buffer.from(text).toString('base64').replace(/[A-Za-z0-9+/]/g,
    c => codigo.ALFABETO['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(c)]);
  const h = `<p id="array_data">${encode('https://a.test/1,https://a.test/2')}</p>`;
  assert.throws(() => codigo.paginasDelHtml(h), /ordenar/);
  assert.equal(codigo.paginasDelHtml(`<meta content="0-1">${h}`)[0], 'https://a.test/2');
});
test('Títulos hermanos de portadas sin alt, búsqueda vacía y fichas 404', async () => {
  const h = '<article class="lc-release"><a href="/manga/id/serie/"><img src="/cover.jpg" alt=""></a><a class="lc-release-title" href="/manga/id/serie/">Título real</a></article>';
  assert.equal((await cliente(h).catalogoLc(1)).series[0].title, 'Título real');
  assert.equal((await cliente(h).catalogoLc(1, {q:'inexistente'})).series.length, 0);
  await assert.rejects(cliente('<h1>Esta pagina ya no existe</h1>').serieLc('id','serie'));
});
test('Ficha nueva conserva descripción, capítulos y separa fechas del título', async () => {
  const h = '<h1>Serie real</h1><div class="lc-cover-lg"><img src="/covers/a.jpg"></div><section id="sinopsis"><p>Descripción real</p></section><div id="chapterList"><a href="/leer/id/serie/2/"><span class="n">Capitulo 2</span><span class="d">2026-09-28</span></a><a href="/leer/id/serie/1/">Capitulo 1</a></div>';
  const s = await cliente(h).serieLc('id','serie');
  assert.equal(s.title, 'Serie real'); assert.equal(s.description, 'Descripción real');
  assert.equal(s.capitulos[0].numero, '1'); assert.equal(s.capitulos[1].titulo, 'Capitulo 2');
});
test('Sitio real: explorar, búsqueda, ficha, capítulo 182 y bytes de imagen', { skip: process.env.MANGATOTAL_TEST_LIVE !== '1' }, async () => {
  const base = 'https://www.leercapitulo.co';
  const get = async p => { const r = await fetch(base+p); assert.equal(r.status,200); return r.text(); };
  const home = await cliente(await get('/')).catalogoLc(1);
  assert.ok(home.series.length > 10); assert.ok(home.series.every(s => s.title !== 'Sin título'));
  const q = await cliente(await get('/manga/?q=sabueso')).catalogoLc(1,{q:'sabueso'});
  assert.ok(q.series.some(s => s.id === 'k1fl40list'));
  const slug = 'la-venganza-del-sabueso-de-sangre-de-hierro';
  const s = await cliente(await get(`/manga/k1fl40list/${slug}/`)).serieLc('k1fl40list',slug);
  assert.match(s.title,/Sabueso/); assert.ok(s.description); assert.ok(s.capitulos.some(c=>c.numero==='182'));
  const h = await get(`/leer/k1fl40list/${slug}/182/`);
  const p = await cliente(h,true).paginasLc('k1fl40list',slug,'182');
  assert.ok(p.paginas.length>0); assert.equal(p.anterior,'181');
  const r = await fetch(p.paginas[0]); assert.equal(r.status,200);
  assert.match(r.headers.get('content-type'),/^image\//); assert.ok((await r.arrayBuffer()).byteLength>1000);
  console.log(`LC real: ${home.series.length} títulos, ${s.capitulos.length} capítulos, ${p.paginas.length} páginas; primera imagen OK`);
});
