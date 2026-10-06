import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.GAME_URL ?? "http://127.0.0.1:5173";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const diagnostics = () => page.evaluate(() => window.__privateer.diagnostics());
const state = () => page.evaluate(() => window.__privateer.state());
await page.goto(base);
await page.waitForFunction(
  () => window.__privateer?.diagnostics().lock === "owned",
);
await page.waitForTimeout(600);
assert.equal((await state()).phase, "port");
await page.screenshot({ path: "artifacts/harbour.png", fullPage: true });
await page.click('[data-action="recruit"]');
await page.waitForFunction(
  () =>
    window.__privateer.state().pirates.length === 4 &&
    window.__privateer.diagnostics().saveWrites === 0,
);
await page.click('[data-action="shop"]');
await page.click('[data-action="buy"][data-kind="food"]');
await page.waitForFunction(() => window.__privateer.state().food === 28);
await page.click('[data-action="close"]');
await page.click('[data-action="build"]');
assert.equal(await page.isVisible("#build-tools"), true);
// Test invalid editor commit without changing the authoritative vessel.
await page.evaluate(() => {
  const app = window.__privateer;
  app.draftTiles.push({ x: 30, y: 4, kind: "hull" });
});
await page.click('[data-action="apply-build"]');
assert.match(await page.locator("#toast").textContent(), /Connect every part/);
await page.click('[data-action="cancel-build"]');
await page.click('[data-action="build"]');
await page.evaluate(() => {
  window.__privateer.draftTiles.push({ x: 18, y: 4, kind: "hull" });
});
await page.click('[data-action="apply-build"]');
await page.waitForFunction(
  () => window.__privateer.state().ships[0].revision === 1,
);
await page.waitForFunction(
  () => window.__privateer.diagnostics().saveWrites === 0,
);
await page.click('[data-action="map"]');
await page.screenshot({ path: "artifacts/chart.png", fullPage: true });
await page.click('[data-action="destination"][data-id="1"]');
await page.click('[data-action="sail"]');
await page.waitForFunction(
  () => window.__privateer.state().phase === "encounter",
  {},
  { timeout: 20000 },
);
await page.screenshot({ path: "artifacts/battle.png", fullPage: true });
await page.click('[data-action="cannon"]');
await page.click('[data-action="select-all"]');
await page.click('[data-action="board"]');
await page.waitForFunction(
  () => window.__privateer.state().phase === "victory",
  {},
  { timeout: 45000 },
);
await page.waitForFunction(
  () => window.__privateer.diagnostics().saveWrites === 0,
);
assert.equal((await state()).ships.length, 1);
assert.equal((await diagnostics()).graphs, 1);
assert.equal((await diagnostics()).searches, 0);
await page.screenshot({ path: "artifacts/victory.png", fullPage: true });
await page.click('#scene-banner [data-action="map"]');
await page.click('[data-action="destination"][data-id="0"]');
await page.click('[data-action="sail"]');
await page.waitForFunction(
  () => window.__privateer.state().phase === "port",
  {},
  { timeout: 20000 },
);
await page.click('[data-action="rest"]');
await page.waitForFunction(
  () => window.__privateer.diagnostics().saveWrites === 0,
);
await page.click('[data-action="upgrade"]');
await page.waitForFunction(
  () => window.__privateer.diagnostics().saveWrites === 0,
);
const checkpointGold = (await state()).gold;
await page.reload();
await page.waitForFunction(
  () => window.__privateer?.diagnostics().lock === "owned",
);
assert.equal((await state()).gold, checkpointGold);
// A second tab must not gain save ownership or advance a competing campaign.
const other = await context.newPage();
await other.goto(base);
await other.waitForFunction(
  () => window.__privateer?.diagnostics().lock === "read-only",
);
assert.match(await other.locator("#toast").textContent(), /Another game tab/);
await other.close();
// UI lifetime stress: one delegated subscription, not a new listener per panel.
const before = await diagnostics();
for (let i = 0; i < 100; i++) {
  await page.evaluate(async () => {
    await window.__privateer.action("help");
    await window.__privateer.action("close");
  });
}
const after = await diagnostics();
assert.equal(after.listeners, before.listeners);
assert.equal(after.views.subscriptions, before.views.subscriptions);
// Scene restart stress checks activation cleanup, shared textures, and actor views.
for (let i = 0; i < 10; i++) {
  await page.evaluate(() =>
    window.__privateer.game.scene.getScene("sea").scene.restart(),
  );
  await page.waitForTimeout(40);
}
const restart = await diagnostics();
assert.equal(restart.views.subscriptions, 4);
assert.equal(restart.views.clouds, 3);
assert.equal(restart.views.textures, 7);
assert.equal(restart.views.actors, (await state()).pirates.length);
assert.equal(restart.views.destroyHandlers, before.views.destroyHandlers);
assert.equal(restart.views.shutdownHandlers, before.views.shutdownHandlers);
// Explicit visibility handler test; documented as synthetic rather than real background scheduling.
await page.evaluate(() => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
});
const hiddenTick = (await diagnostics()).tick;
await page.waitForTimeout(350);
assert.equal((await diagnostics()).tick, hiddenTick);
await page.evaluate(() => {
  delete document.hidden;
});
// Graphics context lifecycle via browser WebGL extension.
await page.evaluate(() => {
  const gl = window.__privateer.game.renderer.gl;
  window.__lostContext = gl.getExtension("WEBGL_lose_context");
  window.__lostContext.loseContext();
});
await page.waitForTimeout(250);
assert.match(await page.locator("#toast").textContent(), /context lost/);
await page.evaluate(() => window.__lostContext.restoreContext());
await page.waitForTimeout(600);
assert.match(await page.locator("#toast").textContent(), /restored/);
await page.click('[data-action="pause"]');
await page.waitForTimeout(3000);
const cdp = await context.newCDPSession(page);
await cdp.send("HeapProfiler.collectGarbage");
const heapBefore = await cdp.send("Runtime.getHeapUsage");
const domBefore = await cdp.send("Memory.getDOMCounters");
// Encounter fixture cycles: accelerate simulation ticks but allow real render/cleanup frames.
for (let i = 0; i < 50; i++) {
  await page.evaluate(() => {
    const app = window.__privateer,
      sim = app.sim,
      s = sim.state;
    s.phase = "port";
    s.location = 0;
    s.food = 999;
    s.gold = 100000;
    s.world[1].cleared = false;
    s.pirates.forEach((p) => {
      p.hp = p.maxHp;
      p.hunger = 100;
    });
    sim.sail(1);
    for (let t = 0; t < 220; t++) sim.tick();
  });
  await page.waitForTimeout(40);
  await page.evaluate(() => {
    const app = window.__privateer;
    app.sim.state.pirates
      .filter((p) => p.side === "enemy")
      .forEach((p) => (p.hp = 0));
    app.sim.tick();
  });
  await page.waitForFunction(
    () =>
      window.__privateer.state().phase === "victory" &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
  await page.waitForTimeout(40);
  const d = await diagnostics();
  assert.equal(d.graphs, 1);
  assert.equal(d.searches, 0);
  assert.equal(d.views.actors, 4);
  assert.equal(d.views.textures, 7);
}
await page.click('[data-action="help"]');
await page.click('[data-action="close"]');
await cdp.send("HeapProfiler.collectGarbage");
const heapAfter = await cdp.send("Runtime.getHeapUsage");
const domAfter = await cdp.send("Memory.getDOMCounters");
assert.ok(
  domAfter.jsEventListeners <= domBefore.jsEventListeners + 2,
  "listeners must not accumulate",
);
assert.ok(
  heapAfter.usedSize - heapBefore.usedSize < 2 * 1024 * 1024,
  "no large retained encounter growth",
);
// Failed storage writes must roll back port purchases.
await page.evaluate(() => {
  const s = window.__privateer.sim;
  s.state.phase = "port";
  s.state.location = 0;
});
const goldBefore = (await state()).gold;
await page.evaluate(async () => {
  const app = window.__privateer,
    backend = app.writer.backend,
    original = backend.write;
  backend.write = async () => {
    throw new Error("Injected quota failure");
  };
  await app.action("recruit");
  backend.write = original;
});
assert.equal((await state()).gold, goldBefore);
assert.match(await page.locator("#toast").textContent(), /quota failure/);

const report = {
  viewport: { width: 1440, height: 1080 },
  renderer: "Chromium SwiftShader (headless software rendering)",
  fullLoop: "passed",
  panelCycles: 100,
  sceneRestarts: 10,
  exclusiveSaveTab: "passed",
  syntheticVisibility: "passed",
  contextLoss: "passed",
  encounterViewCycles: 50,
  quotaRollback: "passed",
  memory: { heapBefore, heapAfter, domBefore, domAfter },
  diagnostics: await diagnostics(),
  errors,
};
await writeFile(
  "artifacts/browser-report.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
await page.setViewportSize({ width: 700, height: 900 });
await page.screenshot({ path: "artifacts/compact.png", fullPage: true });
await page.evaluate(() => window.__privateer.dispose());
await page.waitForTimeout(100);
assert.equal(await page.locator("canvas").count(), 0);
await browser.close();
assert.equal(errors.length, 0);
