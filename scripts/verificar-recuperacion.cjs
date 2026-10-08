// Casos de recuperación con datos artificiales: nunca envía correos reales.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const crypto = require("node:crypto");

const usuario = { id: 7, nickname: "Prueba", email: "prueba@example.com", emailVerifiedAt: null };
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

function cargar(archivo, dependencias, globals = {}) {
  const exports = {};
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", archivo), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(codigo, {
    exports, Response, Headers, URL, AbortSignal,
    setTimeout: (fn) => { fn(); return 0; },
    console: { info() {}, warn() {}, error() {} },
    require: (id) => {
      if (id in dependencias) return dependencias[id];
      throw new Error(`Dependencia sin simular: ${id}`);
    },
    ...globals,
  });
  return exports;
}

function correo(fetch, registro = {}) {
  const tokens = [];
  const db = {
    accountToken: {
      deleteMany: async () => ({}),
      create: async ({ data }) => { tokens.push(data); return data; },
    },
    $transaction: async (operaciones) => Promise.all(operaciones),
  };
  const modulo = cargar("src/lib/accountEmail.ts", { "node:crypto": crypto, "./db": { db } }, {
    fetch,
    process: { env: { RESEND_API_KEY: "prueba", EMAIL_FROM: "cuentas@example.com" } },
    ...registro,
  });
  return { ...modulo, tokens };
}

test("recuperación reintenta una caída con el mismo enlace y clave idempotente", async () => {
  const pedidos = [];
  const modulo = correo(async (_url, opciones) => {
    pedidos.push(opciones);
    if (pedidos.length === 1) throw new TypeError("conexión interrumpida");
    return Response.json({ id: "mensaje-qa" });
  });
  assert.equal(await modulo.enviarRecuperacion(usuario), true);
  assert.equal(pedidos.length, 2);
  assert.equal(pedidos[0].body, pedidos[1].body);
  assert.equal(pedidos[0].headers["Idempotency-Key"], pedidos[1].headers["Idempotency-Key"]);
  assert.ok(pedidos[0].signal);
  const contenido = JSON.parse(pedidos[0].body);
  const token = new URL(contenido.text.match(/https:\/\/\S+/)[0]).searchParams.get("token");
  assert.equal(modulo.tokens.length, 1);
  assert.equal(modulo.tokens[0].tokenHash, hash(token));
  assert.ok(!JSON.stringify(modulo.tokens).includes(token));
});

test("403 no se reintenta y el log no expone el cuerpo del proveedor", async () => {
  let llamadas = 0;
  const logs = [];
  const modulo = correo(async () => {
    llamadas += 1;
    return Response.json({ name: "validation_error", message: usuario.email }, { status: 403 });
  }, { console: { info() {}, warn() {}, error: (...datos) => logs.push(datos) } });
  assert.equal(await modulo.enviarRecuperacion(usuario), false);
  assert.equal(llamadas, 1);
  assert.ok(!JSON.stringify(logs).includes(usuario.email));
});

test("no reintenta antes del Retry-After de una cuota agotada", async () => {
  let llamadas = 0;
  const modulo = correo(async () => {
    llamadas += 1;
    return Response.json({ name: "rate_limit_exceeded" }, { status: 429, headers: { "retry-after": "60" } });
  });
  assert.equal(await modulo.enviarRecuperacion(usuario), false);
  assert.equal(llamadas, 1);
});

test("un 200 sin identificador del proveedor no se informa como aceptado", async () => {
  const modulo = correo(async () => Response.json({}));
  assert.equal(await modulo.enviarRecuperacion(usuario), false);
});

function ruta(user, { configurado = true, enviado = true } = {}) {
  const destinatarios = [];
  const logs = [];
  const modulo = cargar("src/app/api/auth/recovery/request/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/accountEmail": {
      normalizarEmail: (value) => typeof value === "string" ? value.trim().toLowerCase() : null,
      correoConfigurado: () => configurado,
      enviarRecuperacion: async (destinatario) => { destinatarios.push(destinatario); return enviado; },
    },
    "@/lib/authRateLimit": {
      cuerpoAuthDemasiadoGrande: () => false,
      consumirLimite: async () => ({ permitido: true }),
      identidadCliente: () => "ip-prueba",
      REGLAS_AUTH: { recoveryIp: {} },
    },
    "@/lib/db": { db: { user: { findUnique: async () => user } } },
  }, { console: { info: (...datos) => logs.push(datos), error: (...datos) => logs.push(datos) } });
  return { ...modulo, destinatarios, logs };
}

test("cuenta sin verificación previa recibe recuperación; inexistente no revela su estado", async () => {
  const real = ruta(usuario);
  const inexistente = ruta(null);
  const fallo = ruta(usuario, { enviado: false });
  const pedir = (modulo) => modulo.POST({ json: async () => ({ email: "PRUEBA@example.com" }) });
  const respuestas = await Promise.all([pedir(real), pedir(inexistente), pedir(fallo)]);
  assert.equal(real.destinatarios.length, 1);
  assert.equal(inexistente.destinatarios.length, 0);
  const cuerpos = await Promise.all(respuestas.map((res) => res.json()));
  assert.deepEqual(cuerpos[0], cuerpos[1]);
  assert.deepEqual(cuerpos[0], cuerpos[2]);
  assert.ok(!JSON.stringify(real.logs).includes(usuario.email));
});

test("configuración ausente devuelve 503 independientemente de la cuenta", async () => {
  for (const user of [usuario, null]) {
    const modulo = ruta(user, { configurado: false });
    const res = await modulo.POST({ json: async () => ({ email: usuario.email }) });
    assert.equal(res.status, 503);
    assert.equal(modulo.destinatarios.length, 0);
  }
});

test("JSON null no provoca un error del servidor", async () => {
  const modulo = ruta(null);
  assert.equal((await modulo.POST({ json: async () => null })).status, 200);
  assert.equal(modulo.destinatarios.length, 0);
});

function consumo({ expirado = false, usado = false, emailCambiado = false } = {}) {
  const token = "token-de-prueba";
  let ocupado = usado;
  const cambios = [];
  const tx = {
    accountToken: {
      findUnique: async () => ({
        id: "token-qa", userId: usuario.id, kind: `reset_password:${hash(usuario.email)}`,
        usedAt: ocupado ? new Date() : null,
        expiresAt: new Date(Date.now() + (expirado ? -60_000 : 60_000)),
        user: { ...usuario, email: emailCambiado ? "otra@example.com" : usuario.email },
      }),
      updateMany: async () => {
        if (ocupado) return { count: 0 };
        ocupado = true;
        return { count: 1 };
      },
    },
    user: { update: async (datos) => { cambios.push(datos); return datos; } },
  };
  const modulo = cargar("src/lib/accountEmail.ts", {
    "node:crypto": crypto, "./db": { db: { $transaction: async (fn) => fn(tx) } },
  });
  return { ...modulo, token, cambios };
}

test("usar el enlace verifica el correo y revoca sesiones; no permite reutilizarlo", async () => {
  const modulo = consumo();
  assert.equal(await modulo.usarTokenRecuperacion(modulo.token, "hash-nuevo"), true);
  assert.ok(modulo.cambios[0].data.emailVerifiedAt);
  assert.equal(modulo.cambios[0].data.sessionVersion.increment, 1);
  assert.equal(await modulo.usarTokenRecuperacion(modulo.token, "otro-hash"), false);
  assert.equal(modulo.cambios.length, 1);
});

test("tokens vencidos, usados o del correo anterior no cambian la contraseña", async () => {
  for (const opciones of [{ expirado: true }, { usado: true }, { emailCambiado: true }]) {
    const modulo = consumo(opciones);
    assert.equal(await modulo.usarTokenRecuperacion(modulo.token, "hash"), false);
    assert.equal(modulo.cambios.length, 0);
  }
});
