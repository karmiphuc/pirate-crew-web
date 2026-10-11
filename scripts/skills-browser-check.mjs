import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const base = process.env.GAME_URL ?? "http://127.0.0.1:5199";
const server = process.env.GAME_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5199",
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
        books: s.bookStock,
        items: s.itemStock,
        crew: s.pirates.map((p) => ({
          id: p.id,
          hp: p.hp,
          maxHp: p.maxHp,
          damage: p.damage,
          xp: p.xp,
          level: p.level,
          points: p.trainingPoints,
          spent: p.skillPointsSpent,
          skills: p.skills,
          ranks: p.skillRanks,
          duty: p.duty,
        })),
        selected: a.selected(),
      };
    });
  const click = async (action, kind) => {
    await page.click(`[data-action="${action}"][data-kind="${kind}"]`);
    await idle();
  };
  const close = () => page.click('[data-action="close"]');
  const failed = async (action, kind) => {
    const before = await snapshot();
    await page.evaluate(() => {
      const a = window.__privateer;
      window.__bookWrite = a.writer.backend.write;
      a.writer.backend.write = async () => {
        throw new Error("Injected book quota failure");
      };
    });
    await click(action, kind);
    assert.deepEqual(await snapshot(), before);
    await page.evaluate(() => {
      window.__privateer.writer.backend.write = window.__bookWrite;
      delete window.__bookWrite;
    });
  };
  await page.goto(base);
  await readyApp();
  const baselineViews = await page.evaluate(
    () => window.__privateer.diagnostics().views,
  );
  const initial = await snapshot();
  await page.click('[data-action="shop"]');
  await failed("buy-book", "swim");
  await click("buy-book", "swim");
  assert.equal((await snapshot()).gold, initial.gold - 60);
  await failed("sell-book", "swim");
  await close();
  await page.click('[data-action="hold"]');
  assert.equal(
    await page.locator('[data-book="swim"] .item-count').textContent(),
    "× 1",
  );
  await page
    .locator('[data-book="swim"]')
    .screenshot({ path: "artifacts/skill-books-hold.png" });
  await page.locator('[data-book="swim"] button').click();
  await failed("teach", "swim");
  await click("teach", "swim");
  const learned = await snapshot();
  assert.equal(learned.gold, initial.gold - 60);
  assert.deepEqual(
    [
      learned.books.swim,
      learned.crew[0].ranks.swim,
      learned.crew[0].points,
      learned.crew[0].spent,
      learned.crew[0].duty,
    ],
    [0, 1, 3, 1, "guard"],
  );
  await failed("train-skill", "guard");
  await click("train-skill", "guard");
  await page.locator('[data-action="train-skill"][data-kind="guard"]').focus();
  await page.keyboard.press("Space");
  await idle();
  assert.deepEqual(
    [(await snapshot()).crew[0].ranks.guard, (await snapshot()).crew[0].points],
    [3, 1],
  );
  await close();
  await page.click('[data-action="shop"]');
  await click("buy-item", "feather");
  await close();
  await page.click('[data-action="hold"]');
  await click("use-item", "feather");
  assert.equal((await snapshot()).crew[0].points, 13);
  await close();
  await page.click('[data-action="crew-settings"]');
  await click("train-skill", "guard");
  await click("train-skill", "guard");
  assert.ok(
    await page
      .locator('[data-action="train-skill"][data-kind="guard"]')
      .isDisabled(),
  );
  assert.equal((await snapshot()).crew[0].ranks.guard, 5);
  await page.waitForFunction(() => document.querySelector("#toast").hidden);
  await page
    .locator(".skill-grid")
    .screenshot({ path: "artifacts/skill-books-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".skill-grid").evaluate((grid) => {
    const card = grid.closest(".modal-card");
    card.scrollTop +=
      grid.previousElementSibling.previousElementSibling.getBoundingClientRect()
        .top -
      card.getBoundingClientRect().top -
      24;
  });
  assert.equal(
    await page.evaluate(() =>
      [...document.querySelectorAll(".skill-grid .duty-item")].some(
        (e) => e.scrollWidth > e.clientWidth,
      ),
    ),
    false,
  );
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= 390),
  );
  await page.screenshot({ path: "artifacts/skill-books-phone.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await close();
  await page.click('[data-action="shop"]');
  await click("buy-book", "repair");
  const owned = await snapshot();
  await click("sell-book", "repair");
  assert.equal((await snapshot()).gold, owned.gold + 30);
  assert.ok(
    await page
      .locator('[data-action="sell-book"][data-kind="repair"]')
      .isDisabled(),
  );
  await close();
  const saved = await snapshot();
  await page.reload();
  await readyApp();
  assert.deepEqual(await snapshot(), saved);
  // A supported fixture exercises real ranked work, XP and level rewards through the UI.
  await page.evaluate(async () => {
    const a = window.__privateer,
      { createCampaign } = await import("/src/sim/model.ts"),
      s = createCampaign();
    s.food = 1;
    s.meals = 0;
    s.pirates[1].x = s.pirates[1].previousX = 3;
    s.pirates[1].xp = 28;
    a.replace(s);
    a.selection = [4];
    a.paused = true;
    a.renderUI(true);
  });
  await page.click('[data-action="crew-settings"]');
  await click("train-skill", "cook");
  await close();
  const output = await page.evaluate(() => {
    const a = window.__privateer;
    for (let i = 0; i < 51; i++) a.sim.tick();
    a.renderUI(true);
    return [
      a.state().food,
      a.state().meals,
      a.state().pirates[1].xp,
      a.state().pirates[1].level,
      a.state().pirates[1].trainingPoints,
    ];
  });
  assert.deepEqual(output, [0, 2, 30, 2, 7]);
  const legacy = await page.evaluate(async () => {
    const { checkpoint } = await import("/src/storage/save.ts"),
      s = checkpoint(window.__privateer.state());
    s.schemaVersion = 9;
    s.gold = 2000;
    delete s.bookStock;
    s.pirates.forEach((p) => {
      delete p.skillRanks;
      delete p.skillPointsSpent;
    });
    return s;
  });
  await page.click('[data-action="settings"]');
  await page.setInputFiles("#import-file", {
    name: "legacy-nine.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await idle();
  const migrated = await snapshot();
  assert.equal(migrated.schema, 10);
  assert.equal(migrated.crew[1].points, 7);
  assert.equal(migrated.crew[1].ranks.cook, 1);
  assert.ok(migrated.crew.every((p) => p.spent === 0));
  assert.ok(Object.values(migrated.books).every((n) => n === 0));
  await page.reload();
  await readyApp();
  assert.deepEqual((await snapshot()).crew, migrated.crew);
  await page.click('[data-action="shop"]');
  for (let i = 0; i < 20; i++) {
    await click("buy-book", "clean");
    await click("sell-book", "clean");
  }
  assert.equal((await snapshot()).gold, 1400);
  assert.equal((await snapshot()).books.clean, 0);
  await close();
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      window.__privateer.game.scene.stop("sea");
      window.__privateer.game.scene.start("sea");
    });
    await page.waitForFunction(
      () => window.__privateer.diagnostics().views.subscriptions === 4,
    );
  }
  const finalViews = await page.evaluate(
    () => window.__privateer.diagnostics().views,
  );
  assert.equal(finalViews.textures, baselineViews.textures);
  assert.equal(finalViews.subscriptions, 4);
  assert.equal(finalViews.sourceImages, 0);
  await page.evaluate(async () => {
    const a = window.__privateer;
    window.__bookDisposed = { app: a, scene: a.game.scene.getScene("sea") };
    await a.dispose();
  });
  await page.waitForFunction(() => !document.querySelector("canvas"));
  assert.deepEqual(
    await page.evaluate(() => {
      const { app: a, scene: s } = window.__bookDisposed;
      return [
        a.sim.graphCount,
        a.sim.taskCount,
        s.actors.size,
        s.equipment.size,
        s.grips.size,
        a.diagnostics().views.subscriptions,
      ];
    }),
    [0, 0, 0, 0, 0, 0],
  );
  assert.deepEqual(errors, []);
  const report = {
    version: "0.14.0",
    bookBuySellReadRankWriteFailures: 4,
    ownedFirstConsumption: "passed",
    ownedBooksVisibleInHold: "passed",
    sharedPointsAndKeyboard: "passed",
    rankCapAndReload: "passed",
    realWorkXPAndLevel: "passed",
    schemaNineImport: "passed",
    fortyMarketWrites: "passed",
    phoneOverflow: "passed",
    restarts: 10,
    baselineViews,
    finalViews,
    completeDisposal: "passed",
    errors,
  };
  await writeFile(
    "docs/skill-books-validation-results.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await once(server, "exit");
  }
}
