import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const base = process.env.GAME_URL ?? "http://127.0.0.1:5194";
const server = process.env.GAME_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5194",
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
    window.__privateer.renderUI(true);
  });
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/fleet-starter.png" });
  const facing = await page.evaluate(async () => {
    const app = window.__privateer,
      scene = app.game.scene.getScene("sea"),
      { tileNode } = await import("/src/sim/model.ts"),
      p = app.state().pirates[0];
    app.state().pirates.forEach((p) => (p.duty = "guard"));
    const directions = new Set();
    let verticalLeft = 0;
    for (const [x, y] of [
      [10, 3],
      [5, 3],
      [5, 0],
    ]) {
      if (
        !app.sim.queue([p.id], {
          action: "move",
          shipId: 1,
          node: tileNode(x, y),
        })
      )
        throw new Error("Movement rejected");
      for (let i = 0; i < 180; i++) {
        app.sim.tick();
        scene.update(0, 0);
        const actor = scene.actors.get(p.id),
          item = scene.equipment.get(p.id),
          grip = scene.grips.get(p.id);
        if (actor.flipX !== item.flipX || actor.flipX !== grip.flipX)
          throw new Error("Detached direction layers");
        const dx = p.x - p.previousX,
          dy = p.y - p.previousY;
        if (Math.abs(dx) > 0.001) {
          if (actor.flipX !== dx < 0) throw new Error("Wrong movement facing");
          directions.add(dx < 0 ? "left" : "right");
        }
        if (
          x === 5 &&
          y === 0 &&
          Math.abs(dx) < 0.001 &&
          Math.abs(dy) > 0.001
        ) {
          if (!actor.flipX) throw new Error("Climb reset left-facing pirate");
          verticalLeft++;
        }
      }
      if (p.x !== x || p.y !== y) throw new Error("Destination not reached");
    }
    if (!scene.actors.get(p.id).flipX || !verticalLeft)
      throw new Error("Stopped direction lost");
    return { directions: [...directions].sort(), verticalLeft };
  });
  assert.deepEqual(facing.directions, ["left", "right"]);
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/roomier-facing-left.png" });
  const weaponFacing = await page.evaluate(() => {
    const app = window.__privateer,
      scene = app.game.scene.getScene("sea"),
      s = app.state(),
      p = s.pirates[0],
      target = s.pirates[1],
      before = structuredClone(p),
      targetBefore = structuredClone(target),
      phase = s.phase;
    const checks = [];
    try {
      s.phase = "encounter";
      p.x = p.previousX = 4;
      p.y = p.previousY = 3;
      p.targetId = target.id;
      for (const weapon of ["cutlass", "sabre", "pistol"])
        for (const left of [true, false]) {
          p.weapon = weapon;
          p.cooldown = 1;
          p.status = weapon === "pistol" ? "Firing pistol" : "Fighting";
          target.x = target.previousX = left ? 2 : 8;
          scene.update(0, 0);
          const body = scene.actors.get(p.id),
            item = scene.equipment.get(p.id),
            grip = scene.grips.get(p.id);
          if ([body, item, grip].some((layer) => layer.flipX !== left))
            throw new Error("Combat direction mismatch");
          checks.push({ weapon, left });
        }
    } finally {
      Object.assign(p, before);
      Object.assign(target, targetBefore);
      s.phase = phase;
      scene.update(0, 0);
    }
    return checks.length;
  });
  assert.equal(weaponFacing, 6);
  const layouts = [];
  const headroom = [];
  const checkHeadroom = async () => {
    const sample = await page.evaluate(async () => {
      const app = window.__privateer,
        scene = app.game.scene.getScene("sea"),
        { cabinSpans } = await import("/src/game/ship-art.ts"),
        { SHIP_CELL_HEIGHT, SHIP_ORIGIN_Y, CABIN_CEILING_DEPTH } = await import(
          "/src/game/ship-metrics.ts"
        );
      scene.update(0, 0);
      const clearances = [];
      for (const p of app.state().pirates.filter((p) => p.hp > 0)) {
        const ship = app.state().ships.find((s) => s.id === p.shipId),
          actor = scene.actors.get(p.id);
        for (const room of cabinSpans(ship.tiles)) {
          if (
            p.x < room.x ||
            p.x >= room.x + room.width ||
            p.y + 1 !== room.floorY
          )
            continue;
          if (actor.scaleY !== 1 || actor.frame.realHeight !== 56)
            throw new Error("Crew resized to conceal cramped rooms");
          clearances.push(
            actor.getBounds().top -
              (SHIP_ORIGIN_Y +
                room.roofY * SHIP_CELL_HEIGHT +
                CABIN_CEILING_DEPTH),
          );
        }
      }
      return clearances;
    });
    assert.ok(sample.length > 0);
    sample.forEach((gap) =>
      assert.ok(gap >= 26, `Hat meets ceiling: ${gap}px clearance`),
    );
    headroom.push(...sample);
  };
  await checkHeadroom();
  for (const fixture of [
    { id: 3, seed: 2, kind: "sloop" },
    { id: 3, seed: 3, kind: "brig" },
    { id: 6, seed: 2, kind: "flagship" },
  ]) {
    const layout = await page.evaluate(async (fixture) => {
      const app = window.__privateer,
        { createCampaign } = await import("/src/sim/model.ts"),
        { fleetHull } = await import("/src/sim/ship-templates.ts"),
        state = createCampaign(42);
      state.world[fixture.id].seed = fixture.seed;
      state.pirates.forEach((p) => (p.duty = "guard"));
      app.replace(state);
      if (!app.sim.sail(fixture.id))
        throw new Error("Fixture departure rejected");
      for (let i = 0; i < 200; i++) app.sim.tick();
      app.game.scene.getScene("sea").update(0, 0);
      app.renderUI(true);
      const ship = state.ships[1];
      if (app.game.scene.getScene("sea").seenEnemyShip !== ship)
        throw new Error(
          "Replacing a same-revision encounter retained stale scenery",
        );
      return {
        kind: fleetHull(state.world[fixture.id]),
        parts: ship.tiles.length,
        depth: Math.max(...ship.tiles.map((t) => t.y)),
        fittings: ship.furnishings.length,
      };
    }, fixture);
    assert.equal(layout.kind, fixture.kind);
    assert.equal(
      await page.evaluate(() => {
        const app = window.__privateer,
          scene = app.game.scene.getScene("sea");
        return app
          .state()
          .pirates.filter((p) => p.side === "enemy" && p.hp > 0)
          .every((p) => scene.actors.get(p.id).flipX);
      }),
      true,
    );
    layouts.push(layout);
    await page.click('[data-action="view-away"]');
    assert.equal(
      await page.getAttribute('[data-action="view-away"]', "aria-pressed"),
      "true",
    );
    const camera = await page.evaluate(() => {
      const scene = window.__privateer.game.scene.getScene("sea");
      return {
        scroll: scene.cameras.main.scrollX,
        zoom: scene.cameras.main.zoom,
      };
    });
    assert.ok(camera.scroll > 0 && Number.isInteger(camera.scroll));
    assert.equal(camera.zoom, 1);
    await checkHeadroom();
    await page.waitForTimeout(100);
    await page
      .locator(".voyage")
      .screenshot({ path: `artifacts/fleet-${fixture.kind}.png` });
  }

  // Use the actual boarding rope and ladders after defeating the fixture enemies.
  const lower = await page.evaluate(async () => {
    const app = window.__privateer,
      { tileNode } = await import("/src/sim/model.ts");
    app
      .state()
      .pirates.filter((p) => p.side === "enemy")
      .forEach((p) => (p.hp = 0));
    app.sim.tick();
    app.sim.queue([3], { action: "board" });
    for (let i = 0; i < 240; i++) app.sim.tick();
    app.sim.queue([3], { action: "move", shipId: 2, node: tileNode(16, 6) });
    for (let i = 0; i < 300; i++) app.sim.tick();
    app.game.scene.getScene("sea").update(0, 0);
    app.renderUI(true);
    const p = app.state().pirates[0];
    return [p.shipId, p.x, p.y, p.hp > 0];
  });
  assert.deepEqual(lower, [2, 16, 6, true]);
  await checkHeadroom();
  // Select an allied pirate through the panned canvas, then issue a real move.
  const canvas = await page.locator("canvas").boundingBox();
  const screen = await page.evaluate(() => {
    const scene = window.__privateer.game.scene.getScene("sea"),
      actor = scene.actors.get(3);
    return { x: actor.x - scene.cameras.main.scrollX, y: actor.y - 28 };
  });
  await page.mouse.click(
    canvas.x + (screen.x * canvas.width) / 1280,
    canvas.y + (screen.y * canvas.height) / 640,
  );
  assert.deepEqual(await page.evaluate(() => window.__privateer.selected()), [
    3,
  ]);
  const move = await page.evaluate(() => {
    const scene = window.__privateer.game.scene.getScene("sea");
    return {
      x: 998 + 18 * 24 + 12 - scene.cameras.main.scrollX,
      y: 244 + 6 * 32 + 16,
    };
  });
  await page.mouse.click(
    canvas.x + (move.x * canvas.width) / 1280,
    canvas.y + (move.y * canvas.height) / 640,
  );
  assert.deepEqual(
    await page.evaluate(() => {
      const app = window.__privateer;
      for (let i = 0; i < 120; i++) app.sim.tick();
      app.game.scene.getScene("sea").update(0, 0);
      const p = app.state().pirates[0];
      return [p.x, p.y];
    }),
    [18, 6],
  );
  await page.click('[data-action="view-crew"]');
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/fleet-lower-cabin.png" });
  await page.evaluate(() => {
    const app = window.__privateer;
    app.sim.queue([3], { action: "retreat" });
    for (let i = 0; i < 350; i++) app.sim.tick();
    app.game.scene.getScene("sea").update(0, 0);
    app.renderUI(true);
  });
  await page.click('[data-action="view-away"]');
  await page.click('[data-action="capture"]');
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-action="view-home"]')
        .getAttribute("aria-pressed") === "true",
  );
  assert.equal(
    await page.locator('[data-action="view-away"]').isVisible(),
    false,
  );
  assert.equal(
    await page.evaluate(() => window.__privateer.state().ships.length),
    1,
  );
  await page.click('[data-action="save"]');
  await page.waitForFunction(
    () =>
      !window.__privateer.busy &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
  await page.reload();
  await page.waitForFunction(
    () => window.__privateer?.diagnostics().views.artwork,
  );
  await page.evaluate(() => {
    window.__privateer.paused = true;
    window.__privateer.renderUI(true);
  });
  assert.deepEqual(
    await page.evaluate(() => {
      const ship = window.__privateer.state().ships[0];
      return [
        ship.name.includes("captured"),
        ship.furnishings.length,
        ship.stations[0].y,
        Math.max(...ship.tiles.map((t) => t.y)),
      ];
    }),
    [true, 6, 6, 8],
  );
  // Victory freezes commands; return to harbour before checking the captured cannon.
  await page.evaluate(() => {
    const app = window.__privateer;
    if (!app.sim.sail(0)) throw new Error("Captured ship cannot depart safely");
    for (let i = 0; i < 120; i++) app.sim.tick();
    app.game.scene.getScene("sea").update(0, 0);
    app.renderUI(true);
  });
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/fleet-captured.png" });

  // A lower-deck cannon must remain accessible after capture, via normal movement.
  assert.deepEqual(
    await page.evaluate(async () => {
      const app = window.__privateer,
        { tileNode } = await import("/src/sim/model.ts"),
        ship = app.state().ships[0],
        station = ship.stations[0];
      app.sim.queue([3], {
        action: "move",
        shipId: 1,
        node: tileNode(station.x, station.y),
      });
      for (let i = 0; i < 350; i++) app.sim.tick();
      const p = app.state().pirates[0];
      return [p.x, p.y];
    }),
    [20, 6],
  );

  const redraw = await page.evaluate(async () => {
    const app = window.__privateer,
      scene = app.game.scene.getScene("sea"),
      samples = [];
    for (let i = 0; i < 100; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      app.state().ships[0].revision++;
      const start = performance.now();
      scene.update(0, 0);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    return { samples: samples.length, p95: samples[94], max: samples.at(-1) };
  });
  const before = await page.evaluate(
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
    assert.equal(after[key], before[key]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= 390),
    true,
  );
  await page.screenshot({ path: "artifacts/fleet-phone.png", fullPage: true });
  await page.evaluate(async () => {
    const app = window.__privateer;
    window.__fleetDisposed = { app, scene: app.game.scene.getScene("sea") };
    await app.dispose();
  });
  await page.waitForFunction(
    () =>
      document.querySelector("canvas") === null &&
      window.__fleetDisposed.scene.actors.size === 0,
  );
  assert.deepEqual(
    await page.evaluate(() => {
      const { app } = window.__fleetDisposed,
        d = app.diagnostics();
      delete window.__fleetDisposed;
      return [
        d.views.actors,
        d.views.equipment,
        d.views.grips,
        d.views.subscriptions,
        app.sim.graphCount,
      ];
    }),
    [0, 0, 0, 0, 0],
  );
  assert.deepEqual(errors, []);
  const report = {
    layouts,
    facing,
    equippedCombatDirections: weaponFacing,
    pannedSelectionAndMove: "passed",
    nativeCameraZoom: 1,
    cabinHeadroomPx: {
      minimum: Math.min(...headroom),
      checkedActors: headroom.length,
      nativeSpriteHeight: 56,
    },
    boardingAndLowerCabin: "passed",
    retreatCaptureReload: "passed",
    capturedCannonAccess: "passed",
    forcedStaticRedrawMs: redraw,
    sceneRestarts: 10,
    compactOverflow: "passed",
    disposal: "passed",
    views: after,
    errors,
  };
  await writeFile(
    "artifacts/fleet-browser-report.json",
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
