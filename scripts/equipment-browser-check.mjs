import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Own the server by default; GAME_URL uses a server owned by the caller.
const base = process.env.GAME_URL ?? "http://127.0.0.1:5197";
const server = process.env.GAME_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5197",
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
  const snapshot = () =>
    page.evaluate(() => {
      const s = window.__privateer.state();
      return {
        gold: s.gold,
        stock: s.itemStock,
        crew: s.pirates.map((p) => ({
          id: p.id,
          weapon: p.weapon,
          melee: p.meleeWeapon,
          ranged: p.rangedWeapon,
          owned: p.ownedWeapons,
          accessory: p.accessory,
          accessories: p.ownedAccessories,
        })),
      };
    });
  const click = async (action, kind) => {
    await page.click(`[data-action="${action}"][data-kind="${kind}"]`);
    await idle();
  };
  const fail = () =>
    page.evaluate(() => {
      const a = window.__privateer;
      window.__gearWrite = a.writer.backend.write;
      a.writer.backend.write = async () => {
        throw new Error("Injected equipment quota failure");
      };
    });
  const restore = () =>
    page.evaluate(() => {
      window.__privateer.writer.backend.write = window.__gearWrite;
      delete window.__gearWrite;
    });
  await page.click('[data-action="shop"]');
  for (const kind of ["boots", "diaper", "pistol"])
    await click("buy-item", kind);
  await page.click('[data-action="close"]');
  await page.click('[data-action="select"][data-id="3"]');
  await page.click('[data-action="crew-settings"]');
  assert.equal(await page.locator(".loadout-slot").count(), 3);
  const before = await snapshot();
  await fail();
  await click("equip-accessory", "boots");
  assert.deepEqual(await snapshot(), before);
  await restore();
  await click("equip-accessory", "boots");
  await click("equip", "pistol");
  let s = await snapshot();
  assert.equal(s.crew[0].melee, "cutlass");
  assert.equal(s.crew[0].ranged, "pistol");
  assert.equal(s.crew[0].accessory, "boots");
  assert.equal(s.stock.boots, 0);
  assert.equal(s.stock.pistol, 0);
  const contrast = await page.evaluate(() => {
    const lum = (rgb) =>
      rgb
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((c) => {
          c /= 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        })
        .reduce((v, c, i) => v + c * [0.2126, 0.7152, 0.0722][i], 0);
    return [
      ...document.querySelectorAll(
        ".loadout-slot h4,.loadout-slot p,.slot-label",
      ),
    ].map((e) => {
      const a = lum(getComputedStyle(e).color),
        b = lum(getComputedStyle(e.closest(".loadout-slot")).backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  });
  assert.ok(Math.min(...contrast) >= 4.5);
  await page.waitForFunction(() => document.querySelector("#toast").hidden);
  await page.locator(".modal-card").evaluate((el) => (el.scrollTop = 0));
  await page
    .locator("#modal")
    .screenshot({ path: "artifacts/equipment-loadout.png" });
  for (const [action, kind] of [
    ["stow-weapon", "ranged"],
    ["equip-accessory", "diaper"],
    ["equip-accessory", "none"],
  ]) {
    const before = await snapshot();
    await fail();
    await click(action, kind);
    assert.deepEqual(await snapshot(), before);
    await restore();
  }
  await click("stow-weapon", "ranged");
  assert.equal((await snapshot()).crew[0].weapon, "cutlass");
  assert.equal(
    await page.isDisabled('[data-action="stow-weapon"][data-kind="melee"]'),
    true,
  );
  await click("equip", "pistol");
  const gold = (await snapshot()).gold;
  for (let i = 0; i < 50; i++) {
    await click("equip-accessory", "diaper");
    await click("equip-accessory", "none");
    await click("equip-accessory", "boots");
  }
  s = await snapshot();
  assert.equal(s.gold, gold);
  assert.equal(s.stock.diaper, 0);
  assert.deepEqual(s.crew[0].accessories, ["boots", "diaper"]);
  assert.deepEqual(s.crew[1].accessories, []);
  await page.click('[data-action="close"]');
  await page.reload();
  await page.waitForFunction(
    () => window.__privateer?.diagnostics().views.artwork,
  );
  await page.evaluate(() => (window.__privateer.paused = true));
  assert.deepEqual(await snapshot(), s);
  const views = await page.evaluate(
    () => window.__privateer.diagnostics().views,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-action="select"][data-id="3"]');
  await page.click('[data-action="crew-settings"]');
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= 390),
  );
  await page
    .locator("#modal")
    .screenshot({ path: "artifacts/equipment-phone.png" });
  await page.click('[data-action="close"]');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const legacy = await page.evaluate(async () => {
    const { checkpoint } = await import("/src/storage/save.ts");
    const s = checkpoint(window.__privateer.state());
    s.schemaVersion = 7;
    delete s.itemStock.boots;
    delete s.itemStock.diaper;
    for (const p of s.pirates) {
      delete p.meleeWeapon;
      delete p.rangedWeapon;
      delete p.accessory;
      delete p.ownedAccessories;
    }
    return s;
  });
  await page.click('[data-action="settings"]');
  await page.setInputFiles("#import-file", {
    name: "legacy-seven.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await idle();
  assert.equal(
    await page.evaluate(() => window.__privateer.state().schemaVersion),
    10,
  );
  const migrated = await snapshot();
  assert.equal(migrated.crew[0].ranged, "pistol");
  assert.equal(migrated.crew[0].melee, null);
  assert.deepEqual(migrated.crew[0].accessories, []);
  assert.equal(migrated.stock.rum, legacy.itemStock.rum);
  await page.click('[data-action="select"][data-id="3"]');
  await page.click('[data-action="crew-settings"]');
  await click("equip", "cutlass");
  await page.click('[data-action="close"]');
  await page.click('[data-action="map"]');
  await page.click('[data-action="destination"][data-id="1"]');
  await page.click('[data-action="sail"][data-id="1"]');
  await idle();
  const combat = await page.evaluate(() => {
    const a = window.__privateer;
    a.paused = true;
    for (let i = 0; i < 200; i++) a.sim.tick();
    const s = a.state(),
      p = s.pirates[0],
      e = s.pirates.find((p) => p.side === "enemy");
    s.pirates = [p, e];
    p.x = p.previousX = 5;
    p.y = p.previousY = e.y = e.previousY = 3;
    e.x = e.previousX = 9;
    e.shipId = 1;
    p.cooldown = e.cooldown = 0;
    e.hp = e.maxHp = 1000;
    e.damage = 0;
    s.ships[1].cannonCooldown = 1000;
    a.sim.tick();
    a.game.scene.getScene("sea").update(0, 0);
    a.renderUI(true);
    return { weapon: p.weapon, cooldown: p.cooldown, hp: e.hp };
  });
  assert.equal(combat.weapon, "pistol");
  assert.equal(combat.cooldown, 22);
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/equipment-ranged.png" });
  const melee = await page.evaluate(() => {
    const a = window.__privateer,
      p = a.state().pirates[0],
      e = a.state().pirates[1];
    e.x = e.previousX = p.x + 0.8;
    for (let i = 0; i < 22; i++) a.sim.tick();
    a.game.scene.getScene("sea").update(0, 0);
    a.renderUI(true);
    return { weapon: p.weapon, cooldown: p.cooldown, hp: e.hp };
  });
  assert.equal(melee.weapon, "cutlass");
  assert.equal(melee.cooldown, 15);
  assert.ok(melee.hp < combat.hp);
  const registration = await page.evaluate(() => {
    const a = window.__privateer,
      scene = a.game.scene.getScene("sea"),
      p = a.state().pirates[0],
      target = a.state().pirates[1],
      checks = [];
    for (const dx of [-0.8, 0.8]) {
      target.x = p.x + dx;
      p.cooldown = 0;
      a.sim.tick();
      scene.update(0, 0);
      const body = scene.actors.get(p.id),
        item = scene.equipment.get(p.id),
        grip = scene.grips.get(p.id);
      checks.push({
        left: body.flipX,
        item: item.flipX,
        grip: grip.flipX,
        frame: item.frame.name,
      });
    }
    return checks;
  });
  assert.deepEqual(
    registration.map((r) => [r.left, r.item, r.grip]),
    [
      [true, true, true],
      [false, false, false],
    ],
  );
  assert.ok(registration.every((r) => r.frame === "cutlass-attack"));
  await page
    .locator(".voyage")
    .screenshot({ path: "artifacts/equipment-melee.png" });
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.__privateer.game.scene.start("sea"));
    await page.waitForFunction(
      () => window.__privateer.diagnostics().views.subscriptions === 4,
    );
  }
  const finalViews = await page.evaluate(
    () => window.__privateer.diagnostics().views,
  );
  assert.equal(finalViews.textures, views.textures);
  assert.equal(finalViews.subscriptions, views.subscriptions);
  assert.equal(finalViews.sourceImages, 0);
  await page.evaluate(async () => {
    const a = window.__privateer;
    window.__gearDisposed = { app: a, scene: a.game.scene.getScene("sea") };
    await a.dispose();
  });
  await page.waitForFunction(
    () =>
      !document.querySelector("canvas") &&
      window.__gearDisposed.scene.actors.size === 0,
  );
  assert.deepEqual(
    await page.evaluate(() => {
      const { app, scene } = window.__gearDisposed;
      return [
        app.sim.graphCount,
        app.sim.pendingCount,
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
    dualWeaponOwnership: "passed",
    equipStowAccessoryQuotaRollback: "passed",
    nonDuplicatingStow: "passed",
    accessoryChanges: 150,
    reloadSchema9: "passed",
    visibleLegacyImport: "passed",
    actualPistolToMelee: "passed",
    bidirectionalGrips: "passed",
    slotTextContrastMinimum: Math.min(...contrast),
    compactOverflow: "passed",
    sceneRestarts: 10,
    disposal: "passed",
    views: finalViews,
    errors,
  };
  await writeFile(
    "artifacts/equipment-browser-report.json",
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
