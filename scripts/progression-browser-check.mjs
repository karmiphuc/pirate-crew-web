import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const base = process.env.GAME_URL ?? "http://127.0.0.1:5198";
const server = process.env.GAME_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5198",
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
      throw new Error("Owned server exited");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("Server unavailable");
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
  const readyApp = async () => {
    await page.waitForFunction(
      () =>
        window.__privateer?.diagnostics().lock === "owned" &&
        window.__privateer?.diagnostics().views.artwork,
    );
    await page.evaluate(() => {
      window.__privateer.paused = true;
      window.__privateer.renderUI(true);
    });
  };
  const idle = () =>
    page.waitForFunction(
      () =>
        !window.__privateer.busy &&
        window.__privateer.diagnostics().saveWrites === 0,
    );
  const snapshot = () =>
    page.evaluate(() => {
      const a = window.__privateer,
        s = a.state();
      return {
        schema: s.schemaVersion,
        gold: s.gold,
        stock: s.itemStock,
        crew: s.pirates.map((p) => ({
          id: p.id,
          hp: p.hp,
          maxHp: p.maxHp,
          damage: p.damage,
          attributes: p.attributes,
          points: p.trainingPoints,
          group: p.group,
          level: p.level,
          xp: p.xp,
          melee: p.meleeWeapon,
          ranged: p.rangedWeapon,
        })),
        selected: a.selected(),
      };
    });
  const click = async (action, kind) => {
    await page.click(`[data-action="${action}"][data-kind="${kind}"]`);
    await idle();
  };
  const fault = () =>
    page.evaluate(() => {
      const a = window.__privateer;
      window.__progressWrite = a.writer.backend.write;
      a.writer.backend.write = async () => {
        throw new Error("Injected training quota failure");
      };
    });
  const recover = () =>
    page.evaluate(() => {
      window.__privateer.writer.backend.write = window.__progressWrite;
      delete window.__progressWrite;
    });
  await page.goto(base);
  await readyApp();
  const baselineViews = await page.evaluate(
    () => window.__privateer.diagnostics().views,
  );
  await page.click('[data-action="crew-settings"]');
  assert.equal(await page.locator(".progression-panel[open]").count(), 0);
  await page.locator(".progression-panel summary").focus();
  await page.keyboard.press("Space");
  assert.equal(await page.locator(".progression-panel[open]").count(), 1);
  assert.equal(await page.locator(".attribute-card").count(), 6);
  const before = await snapshot();
  await fault();
  await click("train-attribute", "vit");
  assert.deepEqual(await snapshot(), before);
  await recover();
  await page
    .locator('[data-action="train-attribute"][data-kind="vit"]')
    .focus();
  await page.keyboard.press("Space");
  await idle();
  await click("train-attribute", "str");
  await click("train-attribute", "dex");
  await click("train-attribute", "int");
  let saved = await snapshot();
  assert.deepEqual(
    [saved.crew[0].maxHp, saved.crew[0].hp, saved.crew[0].points],
    [94, 94, 0],
  );
  assert.equal(
    await page.locator('[data-action="train-attribute"]:disabled').count(),
    6,
  );
  assert.equal(await page.locator(".progression-panel[open]").count(), 1);
  await click("assign-group", "4");
  const grouped = await snapshot();
  await fault();
  await click("assign-group", "2");
  assert.deepEqual(await snapshot(), grouped);
  await recover();
  // Hotkeys must leave the recipient alone while a modal is open.
  await page.keyboard.press("Digit2");
  assert.deepEqual((await snapshot()).selected, grouped.selected);
  await page.click('[data-action="close"]');
  await page.click('[data-action="shop"]');
  await click("buy-item", "feather");
  await page.click('[data-action="close"]');
  await page.click('[data-action="hold"]');
  await click("use-item", "feather");
  saved = await snapshot();
  assert.deepEqual(
    [saved.crew[0].level, saved.crew[0].xp, saved.crew[0].points],
    [4, 101, 12],
  );
  await page.click('[data-action="close"]');
  await page.reload();
  await readyApp();
  assert.deepEqual(await snapshot(), saved);
  assert.equal(saved.schema, 10);
  await page.keyboard.press("Digit1");
  assert.deepEqual((await snapshot()).selected, []);
  assert.match(
    await page.locator("#crew-summary").innerText(),
    /no living crew/,
  );
  await page.keyboard.press("KeyB");
  assert.equal(
    await page.evaluate(() => window.__privateer.sim.commandCount),
    0,
  );
  await page.keyboard.press("Digit4");
  assert.deepEqual((await snapshot()).selected, [3]);
  // Actual canvas pointer: the selected group alone receives the deck order.
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const rect = await page.locator("canvas").boundingBox();
  const point = await page.evaluate(async () => {
    const scene = window.__privateer.game.scene.getScene("sea"),
      { HOME_X, TILE, TILE_HEIGHT, SHIP_Y } = await import(
        "/src/game/scene.ts"
      );
    return {
      x: HOME_X + 10.5 * TILE - scene.cameras.main.scrollX,
      y: SHIP_Y + 3.5 * TILE_HEIGHT - scene.cameras.main.scrollY,
    };
  });
  await page.mouse.click(
    rect.x + (point.x * rect.width) / 1280,
    rect.y + (point.y * rect.height) / 640,
  );
  const commanded = await page.evaluate(() => {
    const a = window.__privateer;
    a.sim.tick();
    const result = a
      .state()
      .pirates.map((p) => [p.id, p.orders[0]?.action ?? null]);
    for (let i = 0; i < 120; i++) a.sim.tick();
    a.renderUI(true);
    return { orders: result, x: a.state().pirates[0].x };
  });
  assert.deepEqual(commanded.orders, [
    [3, "move"],
    [4, null],
    [5, null],
  ]);
  assert.equal(commanded.x, 10);
  // Capture the actual inspector, and repeated group transactions without new view owners.
  await page.click('[data-action="crew-settings"]');
  await page.click(".progression-panel summary");
  const beforeGroupFault = await snapshot();
  await fault();
  await click("assign-group", "2");
  assert.deepEqual(await snapshot(), beforeGroupFault);
  assert.equal(
    await page.locator('#crew-group-4[aria-pressed="true"]').count(),
    1,
  );
  await recover();
  await page.waitForFunction(() => document.querySelector("#toast").hidden);
  await page
    .locator(".progression-panel")
    .screenshot({ path: "artifacts/progression-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= 390),
  );
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll(".attribute-card")].some(
      (e) => e.scrollWidth > e.clientWidth,
    ),
  );
  assert.equal(overflow, false);
  // Capture the viewport, since the narrow inspector intentionally scrolls.
  await page.locator(".modal-card").evaluate((e) => {
    e.scrollTop = 0;
  });
  await page.screenshot({ path: "artifacts/progression-phone.png" });
  await page.locator(".group-assignment").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/progression-phone-groups.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (let i = 0; i < 40; i++) await click("assign-group", i % 2 ? "4" : "2");
  await page.click('[data-action="close"]');
  await page
    .locator(".crew-panel")
    .screenshot({ path: "artifacts/progression-groups.png" });
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.__privateer.game.scene.start("sea"));
    await page.waitForFunction(
      () => window.__privateer.diagnostics().views.subscriptions === 4,
    );
  }
  const finalViews = await page.evaluate(
    () => window.__privateer.diagnostics().views,
  );
  assert.equal(finalViews.textures, baselineViews.textures);
  assert.equal(finalViews.subscriptions, baselineViews.subscriptions);
  assert.equal(finalViews.sourceImages, 0);
  // Visible old-envelope import preserves evolved health/damage/loadouts, grants no points.
  const legacy = await page.evaluate(async () => {
    const { checkpoint } = await import("/src/storage/save.ts"),
      s = checkpoint(window.__privateer.state());
    s.schemaVersion = 8;
    for (const p of s.pirates) {
      delete p.attributes;
      delete p.trainingPoints;
      delete p.group;
    }
    return s;
  });
  await page.click('[data-action="settings"]');
  await page.setInputFiles("#import-file", {
    name: "legacy-eight.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await idle();
  const migrated = await snapshot();
  assert.equal(migrated.schema, 10);
  assert.deepEqual(
    [
      migrated.crew[0].maxHp,
      migrated.crew[0].damage,
      migrated.crew[0].points,
      migrated.crew[0].group,
    ],
    [118, 18, 0, 1],
  );
  assert.ok(
    migrated.crew.every((p) =>
      Object.values(p.attributes).every((v) => v === 0),
    ),
  );
  await page.reload();
  await readyApp();
  assert.deepEqual(await snapshot(), migrated);
  const criticalPoses = await page.evaluate(async () => {
    const a = window.__privateer,
      scene = a.game.scene.getScene("sea");
    const { createCampaign, makePirate } = await import("/src/sim/model.ts");
    const s = createCampaign(1),
      p = s.pirates[0],
      e = makePirate(6, 0, "enemy");
    p.x = p.previousX = 7;
    p.rangedWeapon = "pistol";
    p.ownedWeapons.push("pistol");
    p.weapon = "pistol";
    p.attributes.agi = p.attributes.luck = 100;
    p.level = 100;
    p.trainingPoints = 0;
    e.shipId = 1;
    e.hp = e.maxHp = 1000;
    s.phase = "encounter";
    s.pirates = [p, e];
    s.nextId = 7;
    a.replace(s);
    const poses = [];
    for (const left of [true, false]) {
      e.x = e.previousX = left ? 3 : 11;
      e.cooldown = 100;
      p.cooldown = 0;
      s.rng = 1;
      a.sim.tick();
      scene.update(0, 0);
      const body = scene.actors.get(p.id),
        item = scene.equipment.get(p.id),
        grip = scene.grips.get(p.id);
      poses.push({
        left,
        status: p.status,
        cooldown: p.cooldown,
        frame: item.frame.name,
        facing: [body.flipX, item.flipX, grip.flipX],
      });
    }
    return poses;
  });
  for (const pose of criticalPoses) {
    assert.equal(pose.status, "Critical shot");
    assert.equal(pose.cooldown, 11);
    assert.equal(pose.frame, "pistol-attack");
    assert.deepEqual(pose.facing, [pose.left, pose.left, pose.left]);
  }
  await page.evaluate(async () => {
    const a = window.__privateer;
    window.__progressDisposed = { app: a, scene: a.game.scene.getScene("sea") };
    await a.dispose();
  });
  await page.waitForFunction(() => !document.querySelector("canvas"));
  assert.deepEqual(
    await page.evaluate(() => {
      const { app, scene } = window.__progressDisposed;
      return [
        app.sim.graphCount,
        app.sim.commandCount,
        scene.actors.size,
        scene.equipment.size,
        scene.grips.size,
        app.diagnostics().views.subscriptions,
      ];
    }),
    [0, 0, 0, 0, 0, 0],
  );
  assert.deepEqual(errors, []);
  const report = {
    version: "0.14.0",
    attributeSpendingAndLevelRewards: "passed",
    trainingAndGroupQuotaRollback: "passed",
    inspectorOpenState: "passed",
    schema10Reload: "passed",
    emptyGroupNoFallback: "passed",
    modalShortcutGuard: "passed",
    nativeSummaryAndTrainingSpaceActivation: "passed",
    selectedGroupCanvasOrder: "passed",
    activeGroupFailureSelectionRestore: "passed",
    actualAgilityCriticalPosesBothDirections: criticalPoses,
    immutableSchema8ImportReload: "passed",
    compactOverflow: "passed",
    groupTransactions: 40,
    sceneRestarts: 10,
    disposal: "passed",
    views: finalViews,
    errors,
  };
  await writeFile(
    "artifacts/progression-browser-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  if (server && server.exitCode === null && server.signalCode === null) {
    const ended = once(server, "exit");
    server.kill("SIGTERM");
    await ended;
  }
}
