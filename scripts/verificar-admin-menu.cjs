// Ejecutar con qa-admin-usuarios.cjs abierto: todas las cuentas y APIs son ficticias.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  const artefactos = fs.mkdtempSync(path.join(os.tmpdir(), "mangatotal-admin-qa-"));
  try {
    for (const viewport of [{ width: 1365, height: 1000 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      // No reemplazar el portapapeles real del usuario durante la prueba.
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", { value: { writeText: async value => { window.__qaCopiado = value; } } });
      });
      const page = await context.newPage(), errores = [];
      page.on("pageerror", error => errores.push(error.message));
      await page.goto("http://127.0.0.1:3151");
      await page.getByRole("button", { name: "Ajustes de AmigoQA" }).click();
      const dialogo = page.getByRole("dialog");
      await dialogo.waitFor();
      assert.equal(await page.getByRole("button", { name: "Ajustes de AdminQA" }).count(), 0);
      const bounds = await dialogo.boundingBox();
      await page.screenshot({ path: path.join(artefactos, `menu-${viewport.width}.png`) });
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
      assert.ok(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2) < 2);
      assert.ok(Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2) < 2, JSON.stringify({ bounds, viewport, artefactos }));
      await dialogo.getByRole("button", { name: "Recuperar contraseña", exact: true }).click();
      await dialogo.getByRole("button", { name: "Cancelar", exact: true }).click();
      assert.equal(await dialogo.getByLabel("Contraseña nueva", { exact: true }).count(), 0);
      await dialogo.getByRole("button", { name: "Recuperar contraseña", exact: true }).click();
      await dialogo.getByRole("button", { name: "Generar contraseña", exact: true }).click();
      await dialogo.getByText("Contraseña recuperada", { exact: true }).waitFor();
      await dialogo.getByRole("button", { name: "Copiar contraseña", exact: true }).click();
      assert.equal(await page.evaluate(() => window.__qaCopiado), "QA_clave_ficticia_12345678");
      await page.screenshot({ path: path.join(artefactos, `clave-ficticia-${viewport.width}.png`) });
      await dialogo.getByRole("button", { name: "Listo, cerrar" }).click();
      await page.getByRole("button", { name: "Ajustes de AmigoQA" }).click();
      assert.equal(await dialogo.getByLabel("Contraseña nueva", { exact: true }).count(), 0);
      await dialogo.getByRole("button", { name: "Hacer admin", exact: true }).click();
      await dialogo.getByRole("button", { name: "Hacer admin", exact: true }).click();
      await dialogo.getByText("La cuenta ahora es administradora.", { exact: true }).waitFor();
      await dialogo.getByRole("button", { name: "Quitar admin", exact: true }).click();
      await dialogo.getByRole("button", { name: "Quitar admin", exact: true }).click();
      await dialogo.getByText("La cuenta ahora tiene el rol de lector.", { exact: true }).waitFor();
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").count(), 0);
      await page.locator("#qa-error").check();
      await page.getByRole("button", { name: "Ajustes de AmigoQA" }).click();
      await dialogo.getByRole("button", { name: "Recuperar contraseña", exact: true }).click();
      await dialogo.getByRole("button", { name: "Generar contraseña", exact: true }).click();
      await dialogo.getByRole("alert").waitFor();
      assert.equal(await dialogo.getByLabel("Contraseña nueva", { exact: true }).count(), 0);
      await dialogo.getByRole("button", { name: "Cerrar ajustes" }).click();
      await page.locator("#qa-error").uncheck();
      await page.getByRole("button", { name: "Ajustes de SinCorreoQA" }).click();
      await dialogo.getByRole("button", { name: "Eliminar cuenta", exact: true }).click();
      assert.ok(await dialogo.getByRole("button", { name: "Eliminar definitivamente" }).isDisabled());
      await dialogo.getByRole("textbox").fill("SinCorreoQA");
      await dialogo.getByRole("button", { name: "Eliminar definitivamente" }).click();
      await dialogo.waitFor({ state: "detached" });
      assert.equal(await page.getByRole("button", { name: "Ajustes de SinCorreoQA" }).count(), 0);
      assert.deepEqual(errores, []);
      console.log(`QA ${viewport.width}px: menú, recuperación, copia, roles, eliminación, cancelación y errores OK`);
      await context.close();
    }
    console.log(`Capturas: ${artefactos}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
