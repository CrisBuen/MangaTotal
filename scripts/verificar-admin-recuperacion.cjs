// Solo datos artificiales y base simulada: no restablece cuentas reales.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");

function cargar(archivo, dependencias, logs = []) {
  const exports = {};
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", archivo), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(codigo, {
    exports, Buffer,
    console: { info: (...datos) => logs.push(datos), error: (...datos) => logs.push(datos) },
    require: (id) => {
      if (id in dependencias) return dependencias[id];
      throw new Error(`Dependencia sin simular: ${id}`);
    },
  });
  return exports;
}

function escenario(opciones = {}) {
  let usuario = {
    id: 2, nickname: "AmigoQA", email: null, emailVerifiedAt: null,
    passwordHash: bcrypt.hashSync("anterior-qa", 4), sessionVersion: 3, isAdmin: false,
    biblioteca: ["serie-a", "serie-b"], progreso: { capitulo: 105 }, favoritos: ["serie-a"],
    ...opciones.usuario,
  };
  let tokens = [
    { userId: 2, kind: "reset_password:correo", usedAt: null },
    { userId: 2, kind: "verify_email:correo", usedAt: null },
    { userId: 8, kind: "reset_password:otro", usedAt: null },
  ];
  const logs = [], cambios = [], limites = [];
  const session = { save: async () => {} };
  const db = {
    user: {
      findUnique: async () => opciones.inexistente ? null : structuredClone(usuario),
      update: async ({ data }) => {
        cambios.push(data);
        usuario = { ...usuario, ...data, sessionVersion: usuario.sessionVersion + data.sessionVersion.increment };
        return structuredClone(usuario);
      },
    },
    accountToken: {
      deleteMany: async ({ where }) => {
        if (opciones.falloTransaccion) throw new Error("fallo-simulado");
        tokens = tokens.filter((token) => !(token.userId === where.userId && token.kind.startsWith(where.kind.startsWith) && token.usedAt === where.usedAt));
      },
    },
    $transaction: async (fn) => {
      const anterior = structuredClone(usuario), tokensAntes = structuredClone(tokens);
      try { return await fn(db); }
      catch (error) { usuario = anterior; tokens = tokensAntes; throw error; }
    },
  };
  const dependencias = {
    "node:crypto": crypto, bcryptjs: bcrypt, "next/server": { NextResponse: Response },
    "@/lib/db": { db },
    "@/lib/auth": {
      getSessionAdmin: async () => opciones.sinAdmin ? null : { id: 1 },
      getSessionUser: async () => structuredClone(usuario),
      getSession: async () => session,
      publicUser: ({ id, nickname, sessionVersion }) => ({ id, nickname, sessionVersion }),
    },
    "@/lib/authRateLimit": {
      cuerpoAuthDemasiadoGrande: () => Boolean(opciones.grande),
      consumirLimite: async () => ({ permitido: !opciones.limitado }),
      REGLAS_AUTH: { passwordUsuario: {}, loginIp: {}, loginCuenta: {} },
      respuestaLimite: () => Response.json({ error: "Demasiados intentos" }, { status: 429 }),
      restablecerLimite: async (...args) => limites.push(args),
      identidadCliente: () => "qa-local",
      limpiarLimitesAntiguos: async () => {},
      passwordComparable: () => true,
      passwordDentroDelLimite: () => true,
    },
  };
  const ruta = cargar("src/app/api/admin/users/[id]/recovery/route.ts", dependencias, logs);
  return {
    ...ruta, dependencias, logs, cambios, limites, session,
    estado: () => structuredClone({ usuario, tokens }),
    pedir: (id = "2", body = { confirm: true }) => ruta.POST({ json: async () => body }, { params: Promise.resolve({ id }) }),
  };
}

test("solo admin, con confirmación e id válido, puede restablecer otra cuenta", async () => {
  for (const [opciones, id, body, status] of [
    [{ sinAdmin: true }, "2", { confirm: true }, 403],
    [{}, "1", { confirm: true }, 400],
    [{}, "2texto", { confirm: true }, 400],
    [{}, "0", { confirm: true }, 400],
    [{}, "2147483648", { confirm: true }, 400],
    [{}, "2", null, 400],
    [{}, "2", { confirm: "true" }, 400],
    [{ grande: true }, "2", { confirm: true }, 413],
    [{ limitado: true }, "2", { confirm: true }, 429],
    [{ inexistente: true }, "2", { confirm: true }, 404],
  ]) {
    const e = escenario(opciones), antes = e.estado();
    const res = await e.pedir(id, body);
    assert.equal(res.status, status);
    assert.equal(e.cambios.length, 0);
    assert.deepEqual(e.estado(), antes);
    assert.equal("password" in await res.json(), false);
  }
});

test("genera clave válida, conserva biblioteca/correo y revoca sesiones y enlaces previos", async () => {
  for (const email of [null, "sin-verificar@example.com"]) {
    const e = escenario({ usuario: { email } }), antes = e.estado();
    const res = await e.pedir("2", { confirm: true, password: "ignorar-clave-del-cliente" });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const { password } = await res.json(), despues = e.estado();
    assert.match(password, /^[A-Za-z0-9_-]{24}$/);
    assert.ok(await bcrypt.compare(password, despues.usuario.passwordHash));
    assert.equal(await bcrypt.compare("anterior-qa", despues.usuario.passwordHash), false);
    assert.equal(despues.usuario.sessionVersion, antes.usuario.sessionVersion + 1);
    assert.equal(despues.usuario.emailVerifiedAt, null);
    assert.equal(despues.usuario.email, email);
    assert.deepEqual(despues.usuario.biblioteca, antes.usuario.biblioteca);
    assert.deepEqual(despues.usuario.progreso, antes.usuario.progreso);
    assert.deepEqual(despues.usuario.favoritos, antes.usuario.favoritos);
    assert.deepEqual(Object.keys(e.cambios[0]).sort(), ["passwordHash", "sessionVersion"]);
    assert.equal(despues.tokens.length, 2);
    assert.deepEqual(e.limites, [["login-cuenta", "amigoqa"]]);
    assert.ok(!JSON.stringify(despues).includes(password));
    assert.ok(!JSON.stringify(e.logs).includes(password));
    const otra = await (await e.pedir()).json();
    assert.notEqual(password, otra.password);
    assert.equal(await bcrypt.compare(password, e.estado().usuario.passwordHash), false);
  }
});

test("si la transacción falla, no entrega clave ni deja cambios parciales", async () => {
  const e = escenario({ falloTransaccion: true }), antes = e.estado();
  const res = await e.pedir();
  assert.equal(res.status, 500);
  assert.equal("password" in await res.json(), false);
  assert.deepEqual(e.estado(), antes);
});

test("la clave generada inicia sesión y permite cambiarla desde Perfil con los handlers reales", async () => {
  const e = escenario();
  const { password } = await (await e.pedir()).json();
  const login = cargar("src/app/api/auth/login/route.ts", e.dependencias);
  const perfil = cargar("src/app/api/auth/password/route.ts", e.dependencias);
  const iniciar = (clave) => login.POST({ json: async () => ({ nickname: "AmigoQA", password: clave }) });
  assert.equal((await iniciar("anterior-qa")).status, 401);
  assert.equal((await iniciar(password)).status, 200);
  assert.equal(e.session.userId, 2);
  assert.equal(e.session.sessionVersion, 4);
  const res = await perfil.POST({ json: async () => ({ current_password: password, new_password: "mi-clave-privada-qa" }) });
  assert.equal(res.status, 200);
  assert.equal(e.session.sessionVersion, 5);
  assert.equal((await iniciar(password)).status, 401);
  assert.equal((await iniciar("mi-clave-privada-qa")).status, 200);
  assert.deepEqual(e.estado().usuario.progreso, { capitulo: 105 });
});
