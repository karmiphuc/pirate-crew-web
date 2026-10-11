import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Own the server by default; GAME_URL uses a server owned by the caller.
const base = process.env.GAME_URL ?? "http://127.0.0.1:5193";
const server = process.env.GAME_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5193",
      ],
      { stdio: "ignore" },
    );
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* startup */
    }
    if (server && server.exitCode !== null)
      throw new Error("Owned server exited during startup");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("Development server unavailable");
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  await mkdir("artifacts", { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(
    () => window.__privateer?.diagnostics().views.artwork,
  );
  await page.evaluate(() => {
    window.__privateer.paused = true;
  });
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/furnished-starter.png" });
  await page.click('[data-action="shop"]');
  await page.click('[data-action="buy-furniture"][data-kind="bunk"]');
  await page.waitForFunction(() => !window.__privateer.busy);
  await page.click('[data-action="buy-furniture"][data-kind="table"]');
  await page.waitForFunction(() => !window.__privateer.busy);
  const bought = await page.evaluate(() => ({
    gold: window.__privateer.state().gold,
    stock: window.__privateer.state().furnitureStock,
  }));
  assert.deepEqual(bought, {
    gold: 360,
    stock: { bunk: 1, table: 1, lantern: 0 },
  });
  await page
    .locator("#modal")
    .screenshot({ path: "artifacts/furnishing-market.png" });
  const failWrites = () =>
    page.evaluate(() => {
      const app = window.__privateer;
      window.__furnitureWrite = app.writer.backend.write;
      app.writer.backend.write = async () => {
        throw new Error("Injected furniture quota failure");
      };
    });
  const restoreWrites = () =>
    page.evaluate(() => {
      window.__privateer.writer.backend.write = window.__furnitureWrite;
      delete window.__furnitureWrite;
    });
  await failWrites();
  await page.click('[data-action="buy-furniture"][data-kind="lantern"]');
  await page.waitForFunction(() => !window.__privateer.busy);
  assert.deepEqual(
    await page.evaluate(() => ({
      gold: window.__privateer.state().gold,
      stock: window.__privateer.state().furnitureStock,
    })),
    bought,
  );
  await restoreWrites();
  await page.click('[data-action="close"]');
  const makeDraft = async () => {
    await page.click('[data-action="build"]');
    await page.click('[data-action="hull"]');
    await page.evaluate(() => {
      const app = window.__privateer;
      for (const x of [11, 12, 13]) app.click(1, x, 1, null, false);
    });
    await page.click('[data-action="furniture-bunk"]');
    await page.evaluate(() => window.__privateer.click(1, 11, 3, null, false));
  };
  await makeDraft();
  assert.equal(
    await page.evaluate(() => window.__privateer.state().furnitureStock.bunk),
    1,
  );
  await page.click('[data-action="cancel-build"]');
  assert.equal(
    await page.evaluate(
      () => window.__privateer.state().ships[0].furnishings.length,
    ),
    3,
  );
  await makeDraft();
  await page.click('[data-action="furniture-table"]');
  await page.evaluate(() => window.__privateer.click(1, 17, 3, null, false));
  await page.click('[data-action="apply-build"]');
  await page.waitForFunction(() => !window.__privateer.busy);
  assert.equal(await page.evaluate(() => window.__privateer.state().parts), 12);
  assert.equal(
    await page.evaluate(
      () => window.__privateer.state().ships[0].furnishings.length,
    ),
    3,
  );
  await page.evaluate(() => window.__privateer.click(1, 17, 3, null, false));
  await failWrites();
  await page.click('[data-action="apply-build"]');
  await page.waitForFunction(() => !window.__privateer.busy);
  assert.equal(await page.evaluate(() => window.__privateer.state().parts), 12);
  assert.equal(
    await page.evaluate(() => window.__privateer.state().furnitureStock.bunk),
    1,
  );
  assert.equal(
    await page.evaluate(
      () => window.__privateer.state().ships[0].furnishings.length,
    ),
    3,
  );
  await restoreWrites();
  await page.click('[data-action="apply-build"]');
  await page.waitForFunction(
    () => !window.__privateer.draft() && !window.__privateer.busy,
  );
  assert.equal(await page.evaluate(() => window.__privateer.state().parts), 9);
  await page.reload();
  await page.waitForFunction(
    () => window.__privateer?.diagnostics().views.artwork,
  );
  await page.evaluate(() => {
    window.__privateer.paused = true;
  });
  assert.equal(
    await page.evaluate(() => window.__privateer.state().schemaVersion),
    6,
  );
  assert.deepEqual(
    await page.evaluate(() => window.__privateer.state().furnitureStock),
    { bunk: 0, table: 1, lantern: 0 },
  );
  assert.equal(
    await page.evaluate(
      () => window.__privateer.state().ships[0].furnishings.length,
    ),
    4,
  );
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/furnished-refit.png" });
  // Remove the newly owned bunk and return it once to inventory.
  await page.click('[data-action="build"]');
  await page.click('[data-action="furniture-bunk"]');
  await page.evaluate(() => window.__privateer.click(1, 12, 3, null, false));
  await page.click('[data-action="apply-build"]');
  await page.waitForFunction(
    () => !window.__privateer.draft() && !window.__privateer.busy,
  );
  assert.equal(
    await page.evaluate(() => window.__privateer.state().furnitureStock.bunk),
    1,
  );
  await page.click('[data-action="shop"]');
  const saleGold = await page.evaluate(() => window.__privateer.state().gold);
  await page.click('[data-action="sell-furniture"][data-kind="table"]');
  await page.waitForFunction(() => !window.__privateer.busy);
  assert.equal(
    await page.evaluate(() => window.__privateer.state().furnitureStock.table),
    0,
  );
  assert.equal(
    await page.evaluate(() => window.__privateer.state().gold),
    saleGold + 12,
  );
  await page.click('[data-action="close"]');
  const views = await page.evaluate(
    () => window.__privateer.diagnostics().views,
  );
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() =>
      window.__privateer.game.scene.getScene("sea").scene.restart(),
    );
    await page.waitForFunction(
      () =>
        window.__privateer.diagnostics().views.artwork &&
        window.__privateer.diagnostics().views.actors === 3,
    );
  }
  const after = await page.evaluate(
    () => window.__privateer.diagnostics().views,
  );
  for (const k of [
    "textures",
    "actors",
    "equipment",
    "grips",
    "subscriptions",
    "sourceImages",
    "shutdownHandlers",
    "destroyHandlers",
  ])
    assert.equal(after[k], views[k]);
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.click('[data-action="build"]');
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= 1000),
    true,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas").getBoundingClientRect();
      const tools = document
        .getElementById("build-tools")
        .getBoundingClientRect();
      return tools.top >= canvas.bottom - 1;
    }),
    true,
    "Phone builder controls must leave the game canvas unobscured",
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= 390),
    true,
  );
  await page.screenshot({
    path: "artifacts/furnishing-builder-phone.png",
    fullPage: true,
  });
  await page.evaluate(async () => {
    const app = window.__privateer;
    window.__furnitureDisposed = { app, scene: app.game.scene.getScene("sea") };
    await app.dispose();
  });
  await page.waitForFunction(
    () =>
      !document.querySelector("canvas") &&
      window.__furnitureDisposed.scene.actors.size === 0,
  );
  const disposed = await page.evaluate(() => {
    const { app, scene } = window.__furnitureDisposed;
    if (app.draftFurniture() !== null || app.draft() !== null)
      throw new Error("Drafts must release on disposal");
    const v = scene.counters;
    delete window.__furnitureDisposed;
    return { views: v, graphs: app.sim.graphCount };
  });
  for (const k of ["actors", "equipment", "grips", "subscriptions"])
    assert.equal(disposed.views[k], 0);
  assert.equal(disposed.graphs, 0);
  assert.deepEqual(errors, []);
  const report = {
    purchases: "passed",
    sale: "passed",
    purchaseQuotaRollback: "passed",
    draftCancellation: "passed",
    invalidFloor: "passed",
    refitQuotaRollback: "passed",
    refitReload: "passed",
    removeToStock: "passed",
    sceneRestarts: 10,
    compactBuilder: "passed",
    disposal: "passed",
    views: after,
    errors,
  };
  await writeFile(
    "artifacts/furniture-browser-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    const ended = once(server, "exit");
    server.kill("SIGTERM");
    await ended;
  }
}
