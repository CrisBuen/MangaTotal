// Vista local del componente real, con APIs ficticias y sin base de datos.
// Ejecutar después de next build; ESBUILD_MODULE apunta a esbuild si no está instalado.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const esbuild = require(process.env.ESBUILD_MODULE || "esbuild");
const raiz = path.join(__dirname, "..");

(async () => {
  const bundle = await esbuild.build({
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import Usuarios from './src/app/(admin)/admin/usuarios/page';
      let users = [
        { id: 1, nickname: 'AdminQA', is_admin: true, email: null },
        { id: 2, nickname: 'AmigoQA', is_admin: false, email: 'prueba@example.com' },
        { id: 3, nickname: 'SinCorreoQA', is_admin: false, email: null },
      ].map(u => ({ ...u, email_verified: false, show_adult_content: false, created_at: '2026-10-01T12:00:00Z' }));
      window.fetch = async (url, options = {}) => {
        if (url === '/api/auth/me') return Response.json(users[0]);
        if (url === '/api/admin/users') return Response.json(users);
        const match = String(url).match(/^\\/api\\/admin\\/users\\/(\\d+)(\\/recovery)?$/);
        if (!match) throw new Error('Solicitud no simulada');
        const id = Number(match[1]);
        await new Promise(resolve => setTimeout(resolve, 400));
        if (document.querySelector('#qa-error').checked) return Response.json({ error: 'Error simulado: volvé a intentar.' }, { status: 503 });
        if (match[2] && options.method === 'POST') return Response.json({ ok: true, password: 'QA_clave_ficticia_12345678' });
        if (options.method === 'PATCH') {
          users = users.map(u => u.id === id ? { ...u, is_admin: JSON.parse(options.body).is_admin } : u);
          return Response.json({ user: users.find(u => u.id === id) });
        }
        if (options.method === 'DELETE') { users = users.filter(u => u.id !== id); return new Response(null, { status: 204 }); }
        throw new Error('Método no simulado');
      };
      createRoot(document.getElementById('app')).render(<Usuarios />);
    `, resolveDir: raiz, loader: "tsx" },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
  });
  const cssDir = path.join(raiz, ".next/static/css");
  const css = fs.readdirSync(cssDir).filter(f => f.endsWith(".css")).map(f => fs.readFileSync(path.join(cssDir, f), "utf8")).join("\n");
  http.createServer((req, res) => {
    if (req.url === "/qa.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].contents); return; }
    if (req.url === "/qa.css") { res.setHeader("Content-Type", "text/css"); res.end(css); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA local · Usuarios</title><link rel="stylesheet" href="/qa.css"><style>:root{--font-archivo:Arial;--font-plex-sans:Arial;--font-plex-mono:monospace}</style></head><body><main style="max-width:1280px;margin:32px auto;padding:0 16px"><p style="margin-bottom:16px;color:#b383ef">QA LOCAL · Solo cuentas ficticias. No modifica producción.</p><label style="display:block;margin-bottom:24px"><input id="qa-error" type="checkbox"> Simular fallo del servidor</label><div id="app"></div></main><script src="/qa.js"></script></body></html>`);
  }).listen(3151, "127.0.0.1", () => console.log("QA local disponible en http://127.0.0.1:3151"));
})();
