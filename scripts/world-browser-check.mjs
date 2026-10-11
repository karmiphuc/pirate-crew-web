import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Own the server by default; GAME_URL uses a server owned by the caller.
const base = process.env.GAME_URL ?? "http://127.0.0.1:5196";
const server = process.env.GAME_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5196",
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
  const idle = () =>
    page.waitForFunction(
      () =>
        !window.__privateer.busy &&
        window.__privateer.diagnostics().saveWrites === 0,
    );
  const chart = () => page.evaluate(() => window.__privateer.state().world);
  await page.click('[data-action="map"]');
  assert.equal(await page.locator(".map-node").count(), 18);
  await page.locator('.map-node[data-id="1"]').focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page.getAttribute('.map-node[data-id="1"]', "aria-pressed"),
    "true",
  );
  assert.match(
    await page.locator("#route-details").innerText(),
    /2 food.*9 gold wages.*7 sec voyage/,
  );
  await page
    .locator("#modal")
    .screenshot({ path: "artifacts/world-chart.png" });
  await page.click('[data-action="close"]');
  const initial = await chart();
  await page.click('[data-action="settings"]');
  await page.locator(".new-voyage summary").click();
  await page.fill("#world-seed", "0");
  await page.click('[data-action="new"]');
  await idle();
  assert.deepEqual(await chart(), initial);
  await page.fill("#world-seed", "42");
  await page.click('[data-action="new"]');
  await idle();
  await page.evaluate(() => {
    window.__privateer.paused = true;
    window.__privateer.state().pirates.forEach((p) => (p.duty = "guard"));
    window.__privateer.renderUI(true);
  });
  assert.equal(
    await page.evaluate(async () => {
      const { generateWorld } = await import("/src/sim/world.ts");
      return (
        JSON.stringify(window.__privateer.state().world) ===
        JSON.stringify(generateWorld(42))
      );
    }),
    true,
  );
  const seeded = await chart();
  await page.reload();
  await page.waitForFunction(
    () => window.__privateer?.diagnostics().views.artwork,
  );
  await page.evaluate(() => {
    window.__privateer.paused = true;
    window.__privateer.state().pirates.forEach((p) => (p.duty = "guard"));
  });
  assert.deepEqual(await chart(), seeded);
  await page.click('[data-action="map"]');
  await page.locator('.map-node[data-id="2"]').click();
  await page.click('[data-action="sail"][data-id="2"]');
  await idle();
  await page.evaluate(() => {
    const app = window.__privateer;
    for (let i = 0; i < 200; i++) app.sim.tick();
    app.game.scene.getScene("sea").update(0, 0);
    app.renderUI(true);
  });
  assert.equal(
    await page.evaluate(() => window.__privateer.state().phase),
    "encounter",
  );
  await page.click('[data-action="view-away"]');
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/world-seeded-island.png" });
  await page.click('[data-action="board"]');
  await page.evaluate(() => {
    const app = window.__privateer;
    for (let i = 0; i < 220; i++) app.sim.tick();
    app.game.scene.getScene("sea").update(0, 0);
    app.renderUI(true);
  });
  assert.equal(
    await page.evaluate(() => window.__privateer.state().pirates[0].shipId),
    2,
  );
  await page.click('[data-action="collect"]');
  await page.evaluate(() => {
    const app = window.__privateer;
    for (let i = 0; i < 220; i++) app.sim.tick();
    app.game.scene.getScene("sea").update(0, 0);
    app.renderUI(true);
  });
  assert.equal(
    await page.evaluate(() => window.__privateer.state().phase),
    "aftermath",
  );
  await page.click('[data-action="retreat"]');
  await page.evaluate(() => {
    const app = window.__privateer;
    for (let i = 0; i < 280; i++) app.sim.tick();
    app.game.scene.getScene("sea").update(0, 0);
    app.renderUI(true);
  });
  assert.equal(
    await page.evaluate(() => window.__privateer.state().pirates[0].shipId),
    1,
  );
  await page.click('[data-action="plunder"]');
  await idle();
  const items = await page.evaluate(() => window.__privateer.state().itemStock);
  assert.equal((await chart())[2].cleared, true);
  // Return, then revisit the persisted island without regenerating its prize.
  for (const id of [0, 2]) {
    await page.click('[data-action="map"]');
    const routes = await page.locator(".world-map svg path").getAttribute("d");
    const currentChart = await chart();
    const home = currentChart.find((n) => n.id === 0);
    if (id === 0) assert.ok(routes.includes(`L${home.x} ${home.y}`));
    await page.click(`.map-node[data-id="${id}"]`);
    await page.click(`[data-action="sail"][data-id="${id}"]`);
    await idle();
    await page.evaluate(() => {
      const app = window.__privateer;
      for (let i = 0; i < 200; i++) app.sim.tick();
      app.game.scene.getScene("sea").update(0, 0);
      app.renderUI(true);
    });
    await idle();
  }
  assert.equal(
    await page.evaluate(() => window.__privateer.state().phase),
    "victory",
  );
  assert.equal(
    await page.evaluate(() => window.__privateer.state().ships.length),
    1,
  );
  assert.deepEqual(
    await page.evaluate(() => window.__privateer.state().itemStock),
    items,
  );
  await page.reload();
  await page.waitForFunction(
    () => window.__privateer?.diagnostics().views.artwork,
  );
  await page.evaluate(() => (window.__privateer.paused = true));
  assert.equal((await chart())[2].cleared, true);
  assert.deepEqual(
    await page.evaluate(() => window.__privateer.state().itemStock),
    items,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-action="map"]');
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= 390),
    true,
  );
  assert.equal(await page.locator(".map-node").count(), 18);
  await page
    .locator("#modal")
    .screenshot({ path: "artifacts/world-phone.png" });
  await page.click('[data-action="close"]');
  await page.evaluate(async () => {
    const app = window.__privateer;
    window.__worldDisposed = { app, scene: app.game.scene.getScene("sea") };
    await app.dispose();
  });
  await page.waitForFunction(
    () =>
      !document.querySelector("canvas") &&
      window.__worldDisposed.scene.actors.size === 0,
  );
  assert.deepEqual(
    await page.evaluate(() => {
      const { app } = window.__worldDisposed;
      delete window.__worldDisposed;
      return [app.diagnostics().views.subscriptions, app.sim.graphCount];
    }),
    [0, 0],
  );
  assert.deepEqual(errors, []);
  const report = {
    locations: 18,
    seedInputValidation: "passed",
    seed42AndReload: "passed",
    keyboardRouteSelection: "passed",
    actualRoutePreviewAndTravel: "passed",
    seededIslandBoardingChestAndReturn: "passed",
    clearedRevisitAndReload: "passed",
    compactMapOverflow: "passed",
    disposal: "passed",
    errors,
  };
  await writeFile(
    "artifacts/world-browser-report.json",
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
