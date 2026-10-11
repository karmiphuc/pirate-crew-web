import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Own the server by default; GAME_URL uses a server owned by the caller.
const base = process.env.GAME_URL ?? "http://127.0.0.1:5192";
const server = process.env.GAME_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5192",
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
    const app = window.__privateer;
    app.paused = true;
    app.state().pirates.forEach((p) => (p.duty = "guard"));
    app.renderUI(true);
  });
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/ship-cabins-harbour.png" });

  // Traverse both new aft roof and original upper deck with real commands.
  for (const [x, y] of [
    [2, 0],
    [8, 0],
    [3, 3],
  ]) {
    const reached = await page.evaluate(
      async ({ x, y }) => {
        const app = window.__privateer,
          { tileNode } = await import("/src/sim/model.ts");
        app.sim.queue([3], { action: "move", shipId: 1, node: tileNode(x, y) });
        for (let i = 0; i < 180; i++) app.sim.tick();
        app.game.scene.getScene("sea").update(0, 0);
        const p = app.state().pirates[0];
        return [p.x, p.y, p.hp > 0];
      },
      { x, y },
    );
    assert.deepEqual(reached, [x, y, true]);
  }

  // Editor removes the actual roof; the cabin walls disappear in that preview.
  const before = await page.evaluate(() =>
    JSON.stringify(window.__privateer.state().ships[0].tiles),
  );
  await page.click('[data-action="build"]');
  await page.evaluate(() => {
    const app = window.__privateer;
    for (let x = 0; x < 5; x++) app.click(1, x, 1, null, false);
  });
  await page.waitForTimeout(80);
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/ship-cabin-editor.png" });
  await page.click('[data-action="cancel-build"]');
  assert.equal(
    await page.evaluate(() =>
      JSON.stringify(window.__privateer.state().ships[0].tiles),
    ),
    before,
  );
  await page.click('[data-action="build"]');
  await page.evaluate(() => {
    const app = window.__privateer;
    for (let x = 0; x < 5; x++) app.click(1, x, 1, null, false);
  });
  await page.click('[data-action="apply-build"]');
  await page.waitForFunction(
    () =>
      !window.__privateer.draft() &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
  await page.reload();
  await page.waitForFunction(
    () => window.__privateer?.diagnostics().views.artwork,
  );
  assert.equal(
    await page.evaluate(() =>
      window.__privateer
        .state()
        .ships[0].tiles.some((t) => t.y === 1 && t.x < 5),
    ),
    false,
  );
  await page.evaluate(() => {
    window.__privateer.paused = true;
  });

  // An edited two-level cutaway, validated through the same refit transaction.
  const error = await page.evaluate(async () => {
    const app = window.__privateer,
      { starterShip } = await import("/src/sim/model.ts");
    app.state().parts = 100; // Fund the larger test vessel through the normal refit cost.
    const tiles = starterShip().tiles.filter(
      (t) => t.y !== 5 && t.y !== 6 && !(t.x === 5 && t.y === 4),
    );
    for (let x = 0; x < 18; x++) tiles.push({ x, y: 7, kind: "hull" });
    for (let x = 2; x < 16; x++) tiles.push({ x, y: 8, kind: "hull" });
    for (let y = 4; y < 7; y++) tiles.push({ x: 5, y, kind: "ladder" });
    const error = app.sim.edit(tiles);
    app.game.scene.getScene("sea").update(0, 0);
    app.renderUI(true);
    return error;
  });
  assert.equal(error, null);
  const lower = await page.evaluate(async () => {
    const app = window.__privateer,
      { tileNode } = await import("/src/sim/model.ts");
    app.state().pirates.forEach((p) => (p.duty = "guard"));
    app.sim.queue([3], { action: "move", shipId: 1, node: tileNode(10, 6) });
    for (let i = 0; i < 240; i++) app.sim.tick();
    app.game.scene.getScene("sea").update(0, 0);
    const p = app.state().pirates[0];
    return [p.x, p.y, p.hp > 0];
  });
  assert.deepEqual(lower, [10, 6, true]);
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/ship-cabins-multideck.png" });
  const damage = await page.evaluate(async () => {
    const app = window.__privateer,
      { cabinSpans } = await import("/src/game/ship-art.ts");
    const ship = app.state().ships[0];
    const count = cabinSpans(ship.tiles).length;
    ship.tiles.filter((t) => t.y === 1).forEach((t) => (t.damage = 100));
    app.sim.refreshStructure(1);
    app.game.scene.getScene("sea").update(0, 0);
    return {
      count,
      remaining: cabinSpans(ship.tiles).filter((r) => r.roofY === 1).length,
    };
  });
  assert.equal(damage.count, 4);
  assert.equal(damage.remaining, 0);
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/ship-cabins-damaged.png" });

  await page.click('[data-action="build"]');
  const blueprint = await page.evaluate(async () => {
    const app = window.__privateer,
      { cabinSpans } = await import("/src/game/ship-art.ts");
    return cabinSpans(app.draft(), true).filter((r) => r.roofY === 1).length;
  });
  assert.equal(blueprint, 2);
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/ship-cabins-blueprint.png" });
  await page.click('[data-action="cancel-build"]');
  assert.equal(
    await page.evaluate(() =>
      window.__privateer
        .state()
        .ships[0].tiles.filter((t) => t.y === 1)
        .every((t) => t.damage === 100),
    ),
    true,
  );

  await page.evaluate(async () => {
    const app = window.__privateer,
      { starterShip, makePirate } = await import("/src/sim/model.ts");
    app.sim.state.ships = [starterShip(), starterShip(2, true)];
    app.sim.state.phase = "encounter";
    app.sim.state.location = 1;
    app.sim.state.pirates = app.sim.state.pirates.filter(
      (p) => p.side === "ally",
    );
    app.sim.state.pirates.forEach((p, i) => {
      p.x = p.previousX = 3 + i * 2;
      p.y = p.previousY = 3;
      p.shipId = 1;
    });
    app.sim.state.pirates.push(
      makePirate(6, 0, "enemy"),
      makePirate(7, 1, "enemy"),
    );
    app.sim.rebuild();
    app.sim.state.ships.forEach((s) => s.revision++);
    app.game.scene.getScene("sea").update(0, 0);
    app.renderUI(true);
  });
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/ship-cabins-battle.png" });
  const beforeRestart = await page.evaluate(
    () => window.__privateer.diagnostics().views,
  );
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() =>
      window.__privateer.game.scene.getScene("sea").scene.restart(),
    );
    await page.waitForFunction(
      () =>
        window.__privateer.diagnostics().views.artwork &&
        window.__privateer.diagnostics().views.actors === 5,
    );
  }
  const afterRestart = await page.evaluate(
    () => window.__privateer.diagnostics().views,
  );
  for (const key of [
    "actors",
    "equipment",
    "grips",
    "subscriptions",
    "textures",
    "sourceImages",
    "shutdownHandlers",
    "destroyHandlers",
  ])
    assert.equal(afterRestart[key], beforeRestart[key]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= 390),
    true,
  );
  await page.screenshot({
    path: "artifacts/ship-cabins-phone.png",
    fullPage: true,
  });
  await page.evaluate(async () => {
    const app = window.__privateer;
    window.__shipReviewDisposed = {
      app,
      scene: app.game.scene.getScene("sea"),
    };
    await app.dispose();
  });
  // Phaser destroys the renderer and scene on the next frame.
  await page.waitForFunction(
    () =>
      document.querySelector("canvas") === null &&
      window.__shipReviewDisposed.scene.actors.size === 0,
  );
  const disposed = await page.evaluate(() => {
    const { app } = window.__shipReviewDisposed;
    const result = {
      views: app.diagnostics().views,
      graphs: app.sim.graphs.size,
    };
    delete window.__shipReviewDisposed;
    return result;
  });
  for (const key of ["actors", "equipment", "grips", "subscriptions"])
    assert.equal(disposed.views[key], 0);
  assert.equal(disposed.graphs, 0);
  assert.deepEqual(errors, []);
  const report = {
    roofMovement: "passed",
    editorCancelCommitReload: "passed",
    multideckMovement: "passed",
    destroyedRoof: "passed",
    damagedBlueprint: "passed",
    sceneRestarts: 10,
    compactLayout: "passed",
    disposal: "passed",
    views: afterRestart,
    errors,
  };
  await writeFile(
    "artifacts/ship-browser-report.json",
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
