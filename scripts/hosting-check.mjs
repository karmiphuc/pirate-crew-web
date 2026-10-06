import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { chromium } from "playwright";

// A strict static server: no SPA fallback that could hide broken asset URLs.
const root = resolve("dist");
let mount = "/";
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".txt": "text/plain",
};
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!path.startsWith(mount)) throw new Error("Outside hosted project");
    path = "/" + path.slice(mount.length);
    if (path.endsWith("/")) path += "index.html";
    const file = resolve(root, `.${path}`);
    if (!file.startsWith(root + sep)) throw new Error("Invalid path");
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] ?? "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_BUNDLED_CHROMIUM
      ? undefined
      : (process.env.CHROMIUM_PATH ?? "/usr/bin/chromium"),
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const path of ["/", "/pirate-crew-web/"]) {
    mount = path;
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("requestfailed", (request) =>
        errors.push(`Failed ${request.url()}`),
      );
      page.on("response", (response) => {
        if (response.status() >= 400)
          errors.push(`${response.status()} ${response.url()}`);
      });
      await page.goto(origin + path);
      await page.waitForFunction(() =>
        document
          .querySelector("#save-state")
          ?.textContent.includes("Logbook ready"),
      );
      assert.equal(
        await page.evaluate(() => typeof window.__privateer),
        "undefined",
      );
      assert.equal(await page.locator("canvas").count(), 1);
      await page.click('[data-action="recruit"]');
      await page.waitForFunction(
        () =>
          document.querySelectorAll(".crew-card").length === 4 &&
          document
            .querySelector("#save-state")
            ?.textContent.includes("Voyage saved"),
      );
      await page.reload();
      await page.waitForFunction(
        () => document.querySelectorAll(".crew-card").length === 4,
      );
      await page.click('[data-action="map"]');
      assert.equal(await page.locator(".map-node").count(), 7);
      const notices = await context.request.get(
        origin + path + "THIRD_PARTY_NOTICES.txt",
      );
      assert.equal(notices.status(), 200);
      assert.match(await notices.text(), /Phaser/);
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${path}: assets, WebGL startup, recruitment, save reload, map, notices; no browser errors`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
