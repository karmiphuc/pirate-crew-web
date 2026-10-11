import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.GAME_URL ?? "http://127.0.0.1:5189";
const server = process.env.GAME_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5189",
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
      /* Server startup. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("Development server unavailable");
  await mkdir("artifacts", { recursive: true });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1080 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(
    () =>
      window.__privateer?.diagnostics().lock === "owned" &&
      window.__privateer.diagnostics().views.artwork,
  );
  await page.evaluate(() => {
    window.__privateer.paused = true;
    window.__privateer.renderUI(true);
  });
  await page.click('[data-action="crew-settings"]');
  await page.click('[data-action="teach"][data-kind="swim"]');
  await page.waitForFunction(
    () =>
      window.__privateer.state().pirates[0].skills.includes("swim") &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
  assert.equal(
    await page.evaluate(() => window.__privateer.state().pirates[0].duty),
    "guard",
  );
  await page.reload();
  await page.waitForFunction(
    () => window.__privateer?.diagnostics().views.artwork,
  );
  assert.equal(
    await page.evaluate(() => window.__privateer.state().schemaVersion),
    7,
  );
  assert.equal(
    await page.evaluate(() =>
      window.__privateer.state().pirates[0].skills.includes("swim"),
    ),
    true,
  );
  await page.evaluate(async () => {
    const app = window.__privateer,
      { starterShip } = await import("/src/sim/model.ts"),
      s = app.sim.state;
    app.paused = true;
    s.phase = "aftermath";
    s.location = 1;
    s.ships.push(starterShip(2, true));
    s.pirates.forEach((p) => (p.duty = "guard"));
    s.pirates[0].x = s.pirates[0].previousX = 17;
    app.sim.rebuild();
    app.selection = [3];
    app.renderUI(true);
  });
  await page.click('[data-action="board"]');
  await page.evaluate(() => {
    const app = window.__privateer;
    for (let i = 0; i < 17; i++) app.sim.tick();
    app.game.scene.getScene("sea").update(0, 0);
    app.renderUI(true);
  });
  assert.equal(
    await page.evaluate(() => window.__privateer.sim.crossingCount),
    1,
  );
  assert.equal(
    await page.evaluate(() => window.__privateer.state().pirates[0].shipId),
    1,
  );
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/rope-crossing.png" });
  const ropeTick = await page.evaluate(() => window.__privateer.state().tick);
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => window.__privateer.state().tick),
    ropeTick,
  );
  await page.evaluate(() => {
    const app = window.__privateer;
    for (let i = 0; i < 40; i++) app.sim.tick();
    const p = app.sim.state.pirates[0];
    p.x = p.previousX = 0;
    p.y = p.previousY = 3;
    app.sim.state.ships[1].tiles.find((t) => t.x === 0 && t.y === 4).damage =
      100;
    app.sim.refreshStructure(2);
    for (let i = 0; i < 20; i++) app.sim.tick();
    app.game.scene.getScene("sea").update(0, 0);
    app.renderUI(true);
  });
  const swimming = await page.evaluate(() => {
    const app = window.__privateer,
      scene = app.game.scene.getScene("sea");
    return {
      mode: app.sim.seaPosition(3).mode,
      cropped: scene.actors.get(3).isCropped,
      itemVisible: scene.equipment.get(3).visible,
      gripVisible: scene.grips.get(3).visible,
    };
  });
  assert.deepEqual(swimming, {
    mode: "swim",
    cropped: true,
    itemVisible: false,
    gripVisible: false,
  });
  await page.locator(".voyage").screenshot({ path: "artifacts/swimming.png" });
  await page.evaluate(() => {
    const app = window.__privateer;
    for (let i = 0; i < 140; i++) app.sim.tick();
    const p = app.sim.state.pirates[1];
    p.shipId = 2;
    p.x = p.previousX = 0;
    p.y = p.previousY = 3;
    app.sim.state.pirates[0].x = app.sim.state.pirates[0].previousX = 17;
    for (let i = 0; i < 16; i++) app.sim.tick();
    app.renderUI(true);
  });
  await page.click('[data-action="select"][data-id="3"]');
  await page.click('[data-action="rescue"]');
  await page.evaluate(() => {
    const app = window.__privateer;
    for (let i = 0; i < 8; i++) app.sim.tick();
    app.game.scene.getScene("sea").update(0, 0);
    app.renderUI(true);
  });
  assert.equal(
    await page.evaluate(() => window.__privateer.sim.seaPosition(4).rescuerId),
    3,
  );
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/rescue-line.png" });
  await page.evaluate(() => {
    window.__privateer.lowMotion = true;
    window.__privateer.game.scene.getScene("sea").scene.restart();
  });
  await page.waitForFunction(
    () =>
      window.__privateer.diagnostics().views.artwork &&
      window.__privateer.diagnostics().views.actors === 3,
  );
  assert.equal(await page.evaluate(() => window.__privateer.sim.seaCount), 1);
  assert.equal(
    await page.evaluate(() => window.__privateer.diagnostics().views.textures),
    10,
  );
  await page.evaluate(() => {
    const app = window.__privateer;
    for (let i = 0; i < 120; i++) app.sim.tick();
    app.game.scene.getScene("sea").update(0, 0);
    app.renderUI(true);
  });
  assert.equal(await page.evaluate(() => window.__privateer.sim.seaCount), 0);
  assert.equal(
    await page.evaluate(
      () =>
        window.__privateer.game.scene.getScene("sea").actors.get(4).isCropped,
    ),
    false,
  );
  assert.equal(
    await page.evaluate(
      () =>
        window.__privateer.game.scene.getScene("sea").equipment.get(4).visible,
    ),
    true,
  );
  await page.click('[data-action="plunder"]');
  await page.waitForFunction(
    () =>
      window.__privateer.state().phase === "victory" &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
  await page.evaluate(() => {
    const app = window.__privateer,
      s = app.sim.state,
      p = s.pirates[1];
    s.phase = "port";
    s.location = 0;
    p.x = p.previousX = 0;
    p.y = p.previousY = 3;
    s.ships[0].tiles.find((t) => t.x === 0 && t.y === 4).damage = 100;
    app.sim.refreshStructure(1);
    for (let i = 0; i < 16; i++) app.sim.tick();
    app.renderUI(true);
  });
  const before = await page.evaluate(() => ({
    ticks: window.__privateer.sim.seaPosition(4).ticks,
    hp: window.__privateer.state().pirates[1].hp,
  }));
  await page.evaluate(() => {
    const app = window.__privateer;
    window.__seaOriginalWrite = app.writer.backend.write;
    app.writer.backend.write = async () => {
      throw new Error("Injected sea recovery quota failure");
    };
  });
  await page.click('[data-action="rest"]');
  await page.waitForFunction(() => !window.__privateer.busy);
  const after = await page.evaluate(() => ({
    ticks: window.__privateer.sim.seaPosition(4).ticks,
    hp: window.__privateer.state().pirates[1].hp,
  }));
  assert.deepEqual(after, before);
  await page.evaluate(() => {
    window.__privateer.writer.backend.write = window.__seaOriginalWrite;
    delete window.__seaOriginalWrite;
  });
  await page.click('[data-action="rest"]');
  await page.waitForFunction(
    () =>
      window.__privateer.sim.seaCount === 0 &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
  await page.reload();
  await page.waitForFunction(
    () => window.__privateer?.diagnostics().views.artwork,
  );
  assert.equal(await page.evaluate(() => window.__privateer.sim.seaCount), 0);
  assert.equal(
    await page.evaluate(() =>
      window.__privateer.state().pirates[0].skills.includes("swim"),
    ),
    true,
  );
  const report = {
    swimmingBookAndReload: "passed",
    timedRopeAndPause: "passed",
    swimmingCropAndStoredWeapons: "passed",
    rescueControlAndLine: "passed",
    sceneRestartDuringRescue: "passed",
    cropAndWeaponRecovery: "passed",
    prizeCheckpoint: "passed",
    seaRollbackOnQuotaFailure: "passed",
    restAndReloadRecovery: "passed",
    diagnostics: await page.evaluate(() => window.__privateer.diagnostics()),
    errors,
  };
  assert.equal(errors.length, 0);
  await page.evaluate(() => window.__privateer.dispose());
  await page.waitForFunction(() => !document.querySelector("canvas"));
  await writeFile(
    "artifacts/sea-browser-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill();
    await once(server, "exit");
  }
}
