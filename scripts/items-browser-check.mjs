import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Own the server by default; GAME_URL uses a server owned by the caller.
const base = process.env.GAME_URL ?? "http://127.0.0.1:5195";
const server = process.env.GAME_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5195",
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
  const snapshot = () =>
    page.evaluate(() => ({
      gold: window.__privateer.state().gold,
      stock: window.__privateer.state().itemStock,
      crew: window.__privateer.state().pirates.map((p) => ({
        id: p.id,
        hp: p.hp,
        hunger: p.hunger,
        morale: p.morale,
        level: p.level,
        xp: p.xp,
        weapon: p.weapon,
        ownedWeapons: p.ownedWeapons,
      })),
    }));
  const idle = () =>
    page.waitForFunction(
      () =>
        !window.__privateer.busy &&
        window.__privateer.diagnostics().saveWrites === 0,
    );
  const trade = async (action, kind) => {
    await page.click(`[data-action="${action}"][data-kind="${kind}"]`);
    await idle();
  };
  const failWrites = () =>
    page.evaluate(() => {
      const app = window.__privateer;
      window.__itemWrite = app.writer.backend.write;
      app.writer.backend.write = async () => {
        throw new Error("Injected item quota failure");
      };
    });
  const restoreWrites = () =>
    page.evaluate(() => {
      window.__privateer.writer.backend.write = window.__itemWrite;
      delete window.__itemWrite;
    });
  await page.click('[data-action="shop"]');
  for (const kind of ["rum", "rum", "elixir", "elixir", "feather", "sabre"])
    await trade("buy-item", kind);
  await trade("sell-item", "rum");
  assert.deepEqual((await snapshot()).stock, {
    rum: 1,
    elixir: 2,
    boneMeal: 0,
    feather: 1,
    sabre: 1,
    pistol: 0,
    boots: 0,
    diaper: 0,
  });
  assert.equal((await snapshot()).gold, 276);
  const before = await snapshot();
  await failWrites();
  await trade("buy-item", "elixir");
  assert.deepEqual(await snapshot(), before);
  await restoreWrites();
  await failWrites();
  await trade("sell-item", "rum");
  assert.deepEqual(await snapshot(), before);
  await restoreWrites();
  await page.click('[data-action="close"]');
  await page.evaluate(() => {
    const p = window.__privateer.state().pirates[0];
    p.hp = 60;
    p.morale = 40;
    p.hunger = 30;
    window.__privateer.renderUI(true);
  });
  await page.click("#hold-button");
  await page.waitForFunction(() => document.querySelector("#toast").hidden);
  await page.locator("#modal").screenshot({ path: "artifacts/items-hold.png" });
  const contrast = await page.evaluate(() => {
    const luminance = (rgb) => {
      const channels = rgb
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((c) => {
          c /= 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    return [...document.querySelectorAll(".hold-item h3,.hold-recipient")].map(
      (el) => {
        const style = getComputedStyle(el),
          bg = getComputedStyle(el.closest(".hold-item") ?? el).backgroundColor,
          a = luminance(style.color),
          b = luminance(bg);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      },
    );
  });
  assert.ok(
    Math.min(...contrast) >= 4.5,
    "Inventory headings/stats are unreadable",
  );
  const hurt = await snapshot();
  await failWrites();
  await trade("use-item", "elixir");
  assert.deepEqual(await snapshot(), hurt);
  await restoreWrites();
  await trade("use-item", "elixir");
  await trade("use-item", "rum");
  assert.deepEqual(
    await page.evaluate(() => {
      const s = window.__privateer.state(),
        p = s.pirates[0];
      return [p.hp, p.morale, s.itemStock.elixir, s.itemStock.rum];
    }),
    [78, 75, 1, 0],
  );
  await page.click('[data-action="hold-crew"][data-id="4"]');
  await trade("use-item", "feather");
  assert.equal((await snapshot()).crew[1].level, 4);
  assert.equal(
    await page
      .locator('[data-action="use-item"][data-kind="elixir"]')
      .isDisabled(),
    true,
  );
  await page.click('[data-action="close"]');
  await page.click('[data-action="crew-settings"]');
  const gearGold = (await snapshot()).gold;
  assert.match(
    await page.locator('[data-action="equip"][data-kind="sabre"]').innerText(),
    /Equip from hold/,
  );
  await trade("equip", "sabre");
  assert.equal((await snapshot()).gold, gearGold);
  assert.equal((await snapshot()).stock.sabre, 0);
  assert.equal((await snapshot()).crew[1].weapon, "sabre");
  await page.click('[data-action="close"]');
  await idle();
  const saved = await snapshot();
  await page.reload();
  await page.waitForFunction(
    () => window.__privateer?.diagnostics().views.artwork,
  );
  await page.evaluate(() => {
    window.__privateer.paused = true;
    window.__privateer.state().pirates.forEach((p) => (p.duty = "guard"));
  });
  assert.deepEqual(await snapshot(), saved);
  assert.equal(
    await page.evaluate(() => window.__privateer.state().schemaVersion),
    8,
  );
  // Real arrival and one-time prize use fixture defeated foes to isolate inventory ownership.
  const loot = await page.evaluate(async () => {
    const app = window.__privateer,
      { encounterLoot } = await import("/src/sim/items.ts");
    if (!app.sim.sail(3)) throw new Error("Departure rejected");
    for (let i = 0; i < 200; i++) app.sim.tick();
    app
      .state()
      .pirates.filter((p) => p.side === "enemy")
      .forEach((p) => (p.hp = 0));
    app.sim.tick();
    app.game.scene.getScene("sea").update(0, 0);
    app.renderUI(true);
    return encounterLoot(app.state().world[3]);
  });
  assert.equal(await page.locator("#loot-preview").isVisible(), true);
  await page
    .locator("#loot-preview")
    .screenshot({ path: "artifacts/items-prize.png" });
  // Combat use is immediate and does not write an unsafe encounter checkpoint.
  await page.evaluate(() => {
    const app = window.__privateer,
      p = app.state().pirates[0];
    p.hp = 50;
    app.renderUI(true);
  });
  await page.click("#hold-button");
  const usesBefore = (await snapshot()).stock.elixir;
  await trade("use-item", "elixir");
  assert.equal((await snapshot()).stock.elixir, usesBefore - 1);
  await page.click('[data-action="close"]');
  const stockBefore = (await snapshot()).stock;
  await page.click('[data-action="plunder"]');
  await idle();
  const claimed = await snapshot();
  for (const kind of Object.keys(loot))
    assert.equal(claimed.stock[kind], stockBefore[kind] + loot[kind]);
  await page.evaluate(() => {
    if (window.__privateer.sim.finishEncounter())
      throw new Error("Duplicate claim");
  });
  assert.deepEqual(await snapshot(), claimed);
  await page.reload();
  await page.waitForFunction(
    () => window.__privateer?.diagnostics().views.artwork,
  );
  await page.evaluate(() => (window.__privateer.paused = true));
  assert.deepEqual(await snapshot(), claimed);
  await page.click("#hold-button");
  await page
    .locator("#modal")
    .screenshot({ path: "artifacts/items-after-loot.png" });
  await page.click('[data-action="close"]');
  const viewsBefore = await page.evaluate(
    () => window.__privateer.diagnostics().views,
  );
  for (let i = 0; i < 50; i++) {
    await page.click("#hold-button");
    await page.click('[data-action="close"]');
  }
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
  const views = await page.evaluate(
    () => window.__privateer.diagnostics().views,
  );
  for (const key of [
    "actors",
    "equipment",
    "grips",
    "textures",
    "subscriptions",
    "sourceImages",
  ])
    assert.equal(views[key], viewsBefore[key]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click("#hold-button");
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= 390),
    true,
  );
  assert.equal(await page.locator('[data-action="use-item"]').count(), 4);
  await page
    .locator("#modal")
    .screenshot({ path: "artifacts/items-phone.png" });
  await page.click('[data-action="close"]');
  await page.evaluate(async () => {
    const app = window.__privateer;
    window.__itemsDisposed = { app, scene: app.game.scene.getScene("sea") };
    await app.dispose();
  });
  await page.waitForFunction(
    () =>
      !document.querySelector("canvas") &&
      window.__itemsDisposed.scene.actors.size === 0,
  );
  assert.deepEqual(
    await page.evaluate(() => {
      const { app } = window.__itemsDisposed,
        d = app.diagnostics();
      delete window.__itemsDisposed;
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
    textContrastMinimum: Math.min(...contrast),
    purchasesAndSales: "passed",
    purchaseSaleAndUseQuotaRollback: "passed",
    targetedUseAndNoWaste: "passed",
    recoveredWeaponTransfer: "passed",
    saveReloadSchema8: "passed",
    battleUseAndOnceOnlyLoot: "passed",
    prizeReload: "passed",
    holdPanelCycles: 50,
    sceneRestarts: 10,
    compactOverflow: "passed",
    disposal: "passed",
    views,
    errors,
  };
  await writeFile(
    "artifacts/items-browser-report.json",
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
