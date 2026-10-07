import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.GAME_URL ?? "http://127.0.0.1:5185";
const server = process.env.GAME_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5185",
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
      /* Wait for the owned server. */
    }
    if (server && server.exitCode !== null)
      throw new Error("Development server exited before startup");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("Development server did not become ready");
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
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const diagnostics = () =>
    page.evaluate(() => window.__privateer.diagnostics());
  const state = () => page.evaluate(() => window.__privateer.state());
  await page.goto(base);
  await page.waitForFunction(
    () => window.__privateer?.diagnostics().lock === "owned",
  );
  await page.waitForTimeout(600);
  assert.equal((await state()).phase, "port");
  // Pixel-art source must have hard opaque edges, not antialiased vector contours.
  const rasterArt = await page.evaluate(() => {
    const textures = window.__privateer.game.textures;
    return Array.from({ length: 4 }, (_, role) => {
      const texture = textures.get(`pirate-${role}`);
      const source = texture.getSourceImage();
      const pixels = source
        .getContext("2d")
        .getImageData(0, 0, source.width, source.height).data;
      let softEdges = 0;
      for (let i = 3; i < pixels.length; i += 4)
        if (pixels[i] !== 0 && pixels[i] !== 255) softEdges++;
      return {
        width: source.width,
        height: source.height,
        frames: texture.getFrameNames().length,
        softEdges,
      };
    });
  });
  for (const atlas of rasterArt) {
    assert.equal(atlas.width, 96);
    assert.equal(atlas.height, 120);
    assert.equal(atlas.frames, 9);
    assert.equal(atlas.softEdges, 0);
  }
  const itemArt = await page.evaluate(() => {
    const texture = window.__privateer.game.textures.get("pirate-equipment");
    const source = texture.getSourceImage();
    const pixels = source
      .getContext("2d")
      .getImageData(0, 0, source.width, source.height).data;
    let softEdges = 0;
    for (let i = 3; i < pixels.length; i += 4)
      if (pixels[i] !== 0 && pixels[i] !== 255) softEdges++;
    return {
      width: source.width,
      height: source.height,
      frames: texture.getFrameNames().sort(),
      softEdges,
    };
  });
  assert.deepEqual(itemArt, {
    width: 96,
    height: 40,
    frames: ["cutlass", "pistol", "sabre"],
    softEdges: 0,
  });
  // Renderer fixture: idle blink follows the simulation clock and reduced motion disables it.
  await page.evaluate(() => {
    const app = window.__privateer,
      scene = app.game.scene.getScene("sea"),
      s = app.sim.state;
    const captain = s.pirates.find((p) => p.role === "captain");
    const tick = s.tick,
      paused = app.paused,
      motion = app.lowMotion;
    app.paused = true;
    app.lowMotion = false;
    s.tick = (110 - ((captain.id * 11) % 110)) % 110;
    scene.update(0, 0);
    if (scene.actors.get(captain.id).frame.name !== "blink-0")
      throw new Error("Idle blink must render");
    app.lowMotion = true;
    scene.update(0, 0);
    if (scene.actors.get(captain.id).frame.name !== "idle-0")
      throw new Error("Reduced motion must disable blink");
    s.tick = tick;
    app.paused = paused;
    app.lowMotion = motion;
    scene.update(0, 0);
  });
  // A stopped character keeps the direction of its last step, including its held item.
  await page.evaluate(() => {
    const app = window.__privateer,
      scene = app.game.scene.getScene("sea"),
      p = app.sim.state.pirates[0];
    const previousX = p.previousX,
      targetId = p.targetId,
      paused = app.paused;
    app.paused = true;
    p.targetId = null;
    p.previousX = p.x + 0.1;
    scene.update(0, 0);
    if (!scene.actors.get(p.id).flipX || !scene.equipment.get(p.id).flipX)
      throw new Error("Leftward step must face left");
    p.previousX = p.x;
    scene.update(0, 0);
    if (!scene.actors.get(p.id).flipX || !scene.equipment.get(p.id).flipX)
      throw new Error("Idle must retain last direction");
    p.previousX = p.x - 0.1;
    scene.update(0, 0);
    if (scene.actors.get(p.id).flipX || scene.equipment.get(p.id).flipX)
      throw new Error("Rightward step must face right");
    p.previousX = previousX;
    p.targetId = targetId;
    app.paused = paused;
    scene.update(0, 0);
  });
  const portraitSize = () =>
    page.evaluate(() => {
      const portrait = document.querySelector(".portrait"),
        body = portrait.querySelector("i"),
        item = portrait.querySelector(".held-item");
      const size = (el) => [
        el.getBoundingClientRect().width,
        el.getBoundingClientRect().height,
      ];
      return {
        portrait: size(portrait),
        body: size(body),
        item: size(item),
        bodyAtlas: getComputedStyle(body).backgroundSize,
        itemAtlas: getComputedStyle(item).backgroundSize,
      };
    });
  assert.deepEqual(await portraitSize(), {
    portrait: [64, 80],
    body: [64, 80],
    item: [64, 80],
    bodyAtlas: "192px 240px",
    itemAtlas: "192px 80px",
  });
  await page.screenshot({ path: "artifacts/harbour.png", fullPage: true });
  await page.click('[data-action="recruit"]');
  await page.waitForFunction(
    () =>
      window.__privateer.state().pirates.length === 4 &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
  await page.click('[data-action="shop"]');
  const foodBefore = (await state()).food;
  await page.click('[data-action="buy"][data-kind="food"]');
  await page.waitForFunction(
    (food) => window.__privateer.state().food === food + 10,
    foodBefore,
  );
  await page.click('[data-action="close"]');
  // Purchase skills and equipment through the actual panel, then persist them.
  await page.click('[data-action="select"][data-id="3"]');
  await page.click('[data-action="crew-settings"]');
  await page.click('[data-action="teach"][data-kind="repair"]');
  await page.waitForFunction(
    () =>
      window.__privateer.state().pirates[0].skills.includes("repair") &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
  await page.click('[data-action="duty"][data-kind="guard"]');
  await page.evaluate(() => {
    const scene = window.__privateer.game.scene.getScene("sea"),
      id = window.__privateer.state().pirates[0].id;
    window.__visualBody = scene.actors.get(id);
    window.__visualItem = scene.equipment.get(id);
  });
  await page.click('[data-action="equip"][data-kind="sabre"]');
  await page.waitForFunction(
    () =>
      window.__privateer.state().pirates[0].weapon === "sabre" &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
  await page.waitForFunction(() => {
    const app = window.__privateer,
      scene = app.game.scene.getScene("sea"),
      id = app.state().pirates[0].id;
    return scene.equipment.get(id).frame.name === "sabre";
  });
  assert.equal(
    await page.locator(".crew-card.selected .held-item.sabre").count(),
    1,
  );
  // Renderer-only fixture switches all existing loadouts without spending campaign resources.
  await page.evaluate(() => {
    const app = window.__privateer,
      scene = app.game.scene.getScene("sea"),
      pirate = app.sim.state.pirates[0];
    const paused = app.paused,
      weapon = pirate.weapon;
    app.paused = true;
    for (const next of ["pistol", "cutlass", "sabre"]) {
      pirate.weapon = next;
      scene.update(0, 0);
      const body = scene.actors.get(pirate.id),
        item = scene.equipment.get(pirate.id);
      if (body !== window.__visualBody || item !== window.__visualItem)
        throw new Error("Equipment switch must reuse body and item views");
      if (
        item.frame.name !== next ||
        item.x !== body.x ||
        item.flipX !== body.flipX ||
        Math.abs(item.y - body.y) > 1
      )
        throw new Error("Equipment layer must follow loadout and pose");
    }
    pirate.weapon = weapon;
    app.paused = paused;
    scene.update(0, 0);
    delete window.__visualBody;
    delete window.__visualItem;
  });
  await page.click('[data-action="armor"]');
  await page.waitForFunction(
    () =>
      window.__privateer.state().pirates[0].armor === 4 &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
  await page.screenshot({ path: "artifacts/duties.png", fullPage: true });
  await page.click('[data-action="close"]');
  await page.click('[data-action="build"]');
  assert.equal(await page.isVisible("#build-tools"), true);
  // Test invalid editor commit without changing the authoritative vessel.
  await page.evaluate(() => {
    const app = window.__privateer;
    app.draftTiles.push({ x: 30, y: 4, kind: "hull" });
  });
  await page.click('[data-action="apply-build"]');
  assert.match(
    await page.locator("#toast").textContent(),
    /Connect every part/,
  );
  await page.click('[data-action="cancel-build"]');
  await page.click('[data-action="build"]');
  await page.evaluate(() => {
    window.__privateer.draftTiles.push({ x: 18, y: 4, kind: "hull" });
  });
  await page.click('[data-action="station-food"]');
  const canvas = await page.locator("canvas").boundingBox();
  await page.mouse.click(
    canvas.x + ((230 + 4 * 18 + 9) * canvas.width) / 1280,
    canvas.y + ((300 + 3 * 18 + 9) * canvas.height) / 540,
  );
  await page.click('[data-action="apply-build"]');
  await page.waitForFunction(
    () =>
      window.__privateer.state().ships[0].revision === 1 &&
      window.__privateer
        .state()
        .ships[0].stations.find((t) => t.kind === "food").x === 4,
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
    () => window.__privateer.state().phase === "aftermath",
    {},
    { timeout: 45000 },
  );
  await page.click('[data-action="select-all"]');
  await page.click('[data-action="retreat"]');
  await page.waitForFunction(
    () =>
      window.__privateer
        .state()
        .pirates.every(
          (p) => p.side === "enemy" || p.hp <= 0 || p.shipId === 1,
        ),
    {},
    { timeout: 20000 },
  );
  await page.click('[data-action="plunder"]');
  await page.waitForFunction(
    () =>
      window.__privateer.state().phase === "victory" &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
  assert.equal((await state()).ships.length, 1);
  assert.equal((await diagnostics()).graphs, 1);
  assert.equal((await diagnostics()).searches, 0);
  await page.screenshot({ path: "artifacts/victory.png", fullPage: true });
  await page.click('#scene-banner [data-action="map"]');
  await page.click('[data-action="destination"][data-id="2"]');
  await page.click('[data-action="sail"]');
  await page.waitForFunction(
    () => window.__privateer.state().phase === "encounter",
    {},
    { timeout: 20000 },
  );
  await page.click('[data-action="select-all"]');
  await page.click('[data-action="board"]');
  await page.waitForFunction(
    () =>
      window.__privateer
        .state()
        .pirates.filter((p) => p.side === "ally")
        .every((p) => p.shipId === 2),
    {},
    { timeout: 20000 },
  );
  await page.click('[data-action="collect"]');
  await page.waitForFunction(
    () => window.__privateer.state().phase === "aftermath",
    {},
    { timeout: 20000 },
  );
  await page.screenshot({ path: "artifacts/island.png", fullPage: true });
  await page.click('[data-action="retreat"]');
  await page.waitForFunction(
    () => window.__privateer.state().pirates.every((p) => p.shipId === 1),
    {},
    { timeout: 20000 },
  );
  await page.click('[data-action="plunder"]');
  await page.waitForFunction(
    () =>
      window.__privateer.state().phase === "victory" &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
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
  // A second encounter exercises the actual capture control and checkpoint.
  await page.click('[data-action="map"]');
  await page.click('[data-action="destination"][data-id="3"]');
  await page.click('[data-action="sail"]');
  await page.waitForFunction(
    () => window.__privateer.state().phase === "encounter",
    {},
    { timeout: 20000 },
  );
  await page.click('[data-action="select-all"]');
  await page.click('[data-action="board"]');
  await page.waitForFunction(
    () => window.__privateer.state().phase === "aftermath",
    {},
    { timeout: 45000 },
  );
  await page.click('[data-action="select-all"]');
  await page.click('[data-action="retreat"]');
  await page.waitForFunction(
    () =>
      window.__privateer
        .state()
        .pirates.every(
          (p) => p.side === "enemy" || p.hp <= 0 || p.shipId === 1,
        ),
    {},
    { timeout: 20000 },
  );
  await page.click('[data-action="capture"]');
  await page.waitForFunction(
    () =>
      window.__privateer.state().phase === "victory" &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
  assert.match((await state()).ships[0].name, /captured/);
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
  const checkpointGold = (await state()).gold;
  await page.reload();
  await page.waitForFunction(
    () => window.__privateer?.diagnostics().lock === "owned",
  );
  assert.equal((await state()).gold, checkpointGold);
  assert.match((await state()).ships[0].name, /captured/);
  // Verify traits and fishing through the management UI, then exercise the galley loop.
  assert.equal((await state()).schemaVersion, 4);
  assert.deepEqual((await state()).pirates[3].traits, ["swift"]);
  await page.click('[data-action="select"][data-id="6"]');
  await page.click('[data-action="crew-settings"]');
  assert.match(
    await page.locator("#modal").textContent(),
    /Swift: Moves 20% faster/,
  );
  await page.screenshot({ path: "artifacts/crew-traits.png", fullPage: true });
  await page.click('[data-action="close"]');
  await page.click('[data-action="select"][data-id="3"]');
  await page.click('[data-action="crew-settings"]');
  await page.click('[data-action="teach"][data-kind="fish"]');
  await page.waitForFunction(
    () =>
      window.__privateer.state().pirates[0].skills.includes("fish") &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
  await page.screenshot({ path: "artifacts/fishing-duty.png", fullPage: true });
  await page.click('[data-action="close"]');
  await page.evaluate(() => {
    const sim = window.__privateer.sim;
    sim.state.food = 0;
    sim.state.meals = 0;
    for (let tick = 0; tick < 500; tick++) sim.tick();
  });
  assert.ok((await state()).notices.some((n) => /caught a fish/.test(n.text)));
  assert.ok((await state()).meals > 0);
  await page.click('[data-action="crew-settings"]');
  await page.click('[data-action="duty"][data-kind="guard"]');
  await page.waitForFunction(
    () =>
      window.__privateer.state().pirates[0].duty === "guard" &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
  await page.click('[data-action="close"]');
  // Authoritative destruction fixtures also exercise real scenery redraw and ownership cleanup.
  await page.evaluate(() => {
    const sim = window.__privateer.sim,
      s = sim.state,
      captain = s.pirates[0];
    s.ships[0].tiles.find((t) => t.x === 10 && t.y === 4).damage = 100;
    sim.refreshStructure(1);
    captain.x = captain.previousX = 9;
    captain.y = captain.previousY = 3;
    sim.queue([captain.id], { action: "move", shipId: 1, node: 3 * 64 + 14 });
    for (let i = 0; i < 80; i++) sim.tick();
    if (captain.x !== 14 || captain.y !== 3 || captain.hp <= 0)
      throw new Error("Safe gap crossing failed");
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "artifacts/damaged-deck.png", fullPage: true });
  await page.evaluate(() => {
    const sim = window.__privateer.sim,
      s = sim.state,
      captain = s.pirates[0];
    captain.x = captain.previousX = 3;
    captain.y = captain.previousY = 3;
    sim.assignDuty(captain.id, "repair");
    s.ships[0].tiles.find((t) => t.x === 3 && t.y === 4).damage = 100;
    sim.refreshStructure(1);
    for (let i = 0; i < 100; i++) sim.tick();
    if (captain.hp <= 0 || captain.y !== 3 || sim.fallingCount !== 0)
      throw new Error("Fall and restoration recovery failed");
    sim.rest();
    sim.assignDuty(captain.id, "guard");
  });
  assert.equal((await diagnostics()).falls, 0);
  // Port repairs must recover an unsafe supported-but-isolated crew position before saving.
  await page.evaluate(() => {
    const sim = window.__privateer.sim,
      p = sim.state.pirates[0];
    p.x = p.previousX = 3;
    p.y = p.previousY = 3;
    sim.state.ships[0].tiles.find((t) => t.x === 3 && t.y === 4).damage = 100;
    sim.refreshStructure(1);
    for (let i = 0; i < 5; i++) sim.tick();
  });
  await page.click('[data-action="rest"]');
  await page.waitForFunction(
    () =>
      window.__privateer.state().pirates[0].y === 3 &&
      window.__privateer.diagnostics().saveWrites === 0,
  );
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
  assert.equal(restart.views.textures, 9);
  assert.equal(restart.views.actors, (await state()).pirates.length);
  assert.equal(restart.views.equipment, restart.views.actors);
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
      s.ships[0].hp = s.ships[0].maxHp;
      s.meals = 30;
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
      app.sim.finishEncounter();
    });
    await page.waitForFunction(
      () =>
        window.__privateer.state().phase === "victory" &&
        window.__privateer.diagnostics().saveWrites === 0,
    );
    await page.waitForFunction(
      () =>
        window.__privateer.diagnostics().views.actors ===
        window.__privateer.state().pirates.filter((p) => p.hp > 0).length,
    );
    const d = await diagnostics();
    assert.equal(d.graphs, 1);
    assert.equal(d.searches, 0);
    assert.equal(d.tasks, 0);
    assert.equal(d.claims, 0);
    assert.equal(d.falls, 0);
    assert.ok(d.audioVoices <= 8);
    assert.equal(d.views.actors, 4);
    assert.equal(d.views.equipment, 4);
    assert.equal(d.views.textures, 9);
  }
  // Muting immediately releases every owned voice; scene restarts retain one app audio owner.
  await page.click('[data-action="settings"]');
  await page.click('[data-action="sound"]');
  assert.equal(
    await page.evaluate(() => window.__privateer.sound.enabled),
    false,
  );
  assert.equal((await diagnostics()).audioVoices, 0);
  await page.click('[data-action="sound"]');
  assert.equal(
    await page.evaluate(() => window.__privateer.sound.enabled),
    true,
  );
  await page.click('[data-action="close"]');
  await page.waitForTimeout(400);
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
    opaquePixelArt: "passed",
    idleBlinkAndReducedMotion: "passed",
    dynamicEquipmentLayers: "passed",
    idleFacingAndIntegerPortraits: "passed",
    skillAndEquipmentPurchases: "passed",
    fishingAndGalley: "passed",
    traitsAndSchema4: "passed",
    destroyedDeckAndRepair: "passed",
    unsafePortRepairRecovery: "passed",
    islandExplorationAndReturn: "passed",
    explicitPlunder: "passed",
    captureAndReload: "passed",
    audioMuteAndVoiceCap: "passed",
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
  await page.setViewportSize({ width: 700, height: 900 });
  assert.deepEqual(await portraitSize(), {
    portrait: [32, 40],
    body: [32, 40],
    item: [32, 40],
    bodyAtlas: "96px 120px",
    itemAtlas: "96px 40px",
  });
  await page.screenshot({ path: "artifacts/compact.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.deepEqual(await portraitSize(), {
    portrait: [64, 80],
    body: [64, 80],
    item: [64, 80],
    bodyAtlas: "192px 240px",
    itemAtlas: "192px 80px",
  });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= 375),
    true,
  );
  await page.screenshot({ path: "artifacts/phone.png", fullPage: true });
  await page.evaluate(async () => {
    const app = window.__privateer,
      audioContext = app.sound.context,
      scene = app.game.scene.getScene("sea");
    await app.dispose();
    window.__disposedScene = scene;
    if (audioContext && audioContext.state !== "closed")
      throw new Error("Audio context must close on disposal");
    if (app.sound.activeCount !== 0)
      throw new Error("Audio voices must release on disposal");
  });
  // Phaser schedules game destruction on its next frame, after dispose resolves.
  await page.waitForFunction(
    () =>
      document.querySelector("canvas") === null &&
      window.__disposedScene.equipment.size === 0 &&
      window.__disposedScene.actors.size === 0,
  );
  await page.evaluate(() => {
    delete window.__disposedScene;
  });
  assert.equal(await page.locator("canvas").count(), 0);
  assert.equal(errors.length, 0);
  await writeFile(
    "artifacts/browser-report.json",
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
