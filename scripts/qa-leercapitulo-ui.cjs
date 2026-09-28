// Cuenta y APIs privadas ficticias; HTML e imágenes públicos reales de LeerCapítulo.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const { DOMParser } = require(process.env.MANGATOTAL_TEST_DOM);
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const codigo = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/leercapituloCodigo.ts','utf8'), {
  compilerOptions: { module: 1, target: 9 },
}).outputText, {exports:codigo, URL});
const base = process.env.QA_URL || 'http://127.0.0.1:3148';
const id = 'k1fl40list', slug = 'la-venganza-del-sabueso-de-sangre-de-hierro';
(async () => {
  const paths = ['/', `/manga/${id}/${slug}/`, `/leer/${id}/${slug}/182/`];
  const html = new Map(await Promise.all(paths.map(async p => [p, await (await fetch('https://www.leercapitulo.co'+p)).text()])));
  const paginas = codigo.paginasDelHtml(html.get(paths[2]));
  const cover = new URL(new DOMParser().parseFromString(html.get(paths[1]),'text/html').querySelector('.lc-cover-lg img').getAttribute('src'), 'https://www.leercapitulo.co').href;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const mobile of [false,true]) {
      const context = await browser.newContext({ viewport: mobile ? {width:412,height:915} : {width:1365,height:950}, isMobile:mobile, hasTouch:mobile, serviceWorkers:'block' });
      const page = await context.newPage();
      const writes = [], errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await context.route('**/portada-antigua.jpg', r => r.fulfill({status:404,body:''}));
      await context.route('**/api/**', async route => {
        const r = route.request(), u = new URL(r.url());
        if (r.method() !== 'GET') writes.push(u.pathname);
        let data = [];
        if (u.pathname === '/api/auth/me') data = {id:999901,nickname:'QA',anime_enabled:false};
        if (u.pathname === '/api/externo/biblioteca') data = [{source:'leercapitulo',external_id:`${id}/${slug}`,slug,title:'La Venganza del Sabueso de Sangre de Hierro',cover_url:base+'/portada-antigua.jpg',last_chapter_name:'105',last_chapter_id:'105',saved:true}];
        if (u.pathname === '/api/externo/progreso') data = {saved:true,last_chapter_name:'105',last_chapter_id:'105',chapters:[]};
        if (u.pathname === '/api/externo/leercapitulo') data = u.searchParams.get('accion') === 'capitulo'
          ? {paginas,numero:'182',anterior:'181',siguiente:null} : {html:html.get(u.searchParams.get('ruta'))};
        await route.fulfill({json:data});
      });
      await page.goto(base+'/fuentes?fuente=leercapitulo');
      await page.getByText('Vas por el cap. 105').waitFor();
      await page.waitForFunction(url => [...document.images].some(i=>i.src===url && i.naturalWidth>0), cover);
      assert.equal(writes.filter(p=>p!='/api/analytics').length,0);
      await page.getByRole('link',{name:/La Venganza del Sabueso/}).click();
      await page.getByRole('heading',{name:'La Venganza del Sabueso de Sangre de Hierro',exact:true}).waitFor();
      await page.getByRole('button',{name:'En mi biblioteca'}).waitFor();
      await page.getByRole('link',{name:'← Series de esta fuente'}).click();
      await page.getByText('Vas por el cap. 105').waitFor();
      // Solo para el middleware del servidor QA local, arrancado con este secreto ficticio.
      const value = await require('iron-session').sealData({userId:999901}, {
        password:'mangatotal-qa-local-only-not-production-secret-2026', ttl:3600,
      });
      await context.addCookies([{name:'lector_total_session',value,url:base}]);
      await page.goto(base+`/leer-externo/leercapitulo/182?serie=${id}&slug=${slug}`);
      await page.getByAltText('Página 1',{exact:true}).waitFor();
      await page.waitForFunction(()=> {const i=document.querySelector('img[alt="Página 1"]');return i?.naturalWidth>0;});
      await page.getByAltText('Página 1',{exact:true}).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const dims = await page.getByAltText('Página 1',{exact:true}).evaluate(i=>({width:i.naturalWidth,height:i.naturalHeight,box:i.getBoundingClientRect().toJSON()}));
      assert.ok(dims.box.width > 200 && dims.box.height > 200);
      assert.deepEqual(errors,[]);
      if (process.env.QA_SCREENSHOT && !mobile) await page.screenshot({path:process.env.QA_SCREENSHOT});
      console.log(`${mobile?'Móvil':'Escritorio'}: portada recuperada, progreso 105 intacto, ficha, regreso y capítulo 182 visible (${dims.width}x${dims.height}); cuenta real sin acceso`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
