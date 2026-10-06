# Pixel Privateer

A playable, unofficial browser tribute to Pixel Piracy: build a ship, hire and equip a crew, chart an expedition, fire cannons, board enemy vessels, collect loot, and return to port. Working repository name: `pirate-crew-web`.

The user's intended use is personal, with any sharing free/noncommercial and properly attributed. This build uses newly drawn procedural pixel art; no Steam assets or reference-game code are included.

![Island expedition](docs/images/island-expedition.png)

## Run locally

Requires Node.js 22.12+ (tested with Node 24) and a current desktop browser with WebGL, IndexedDB, and Web Locks.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. Use a local HTTP server or HTTPS; opening `index.html` directly as a file does not provide the required browser storage/lock environment.

```sh
npm test             # headless simulation, save, navigation, and lifetime scenarios
npm run build        # typecheck and production bundle
npm run format:check # source formatting
npm run test:browser # integration + lifecycle checks; owns its dev server
```

The browser script starts and closes its own development server by default. Set `GAME_URL` to use an existing server instead. It uses `/usr/bin/chromium` by default. Set `CHROMIUM_PATH` to another Chromium executable and `GAME_URL` to another dev-server URL if needed. It requires the development build's diagnostic hook; that hook is removed from production.

For a production preview, run `npx vite preview --host 0.0.0.0`. Production output is the static `dist/` directory. The Phaser vendor bundle is separate so gameplay updates can reuse the browser's engine cache.

## GitHub Pages

The game is a static SPA, ready for GitHub Pages. No backend, server rendering, or accounts are needed. Relative asset URLs support both a repository subpath and a custom domain. Menus stay within the page, so no server-side route rewrites are required.

The source is published at [karmiphuc/pirate-crew-web](https://github.com/karmiphuc/pirate-crew-web). The [Pages workflow](.github/workflows/pages.yml) validates, builds, and deploys `dist/` on pushes to `main`. Enable **Settings → Pages → Source → GitHub Actions**; the connected integration cannot change that setting. See [hosting setup and limitations](docs/github-pages.md). A live site is not claimed until deployment succeeds.

Run `npm run build && npm run test:hosting` to test the production bundle at both `/` and `/pirate-crew-web/` using a strict static server. This checks asset requests, game startup, save reload, and the chart without the development diagnostic hook.

## Play

- Recruit at the harbour, buy provisions in the market, and rest at the tavern to heal and repair.
- **Build ship**: add/remove hull or ladder parts, or choose **Move galley/cannon/clinic** to relocate a station. Apply only a connected, reachable refit. Hull additions consume timber atomically.
- **Chart a course**: select a location, inspect food/wages, then set sail. Castaway Cay is an unguarded island; the Crooked Cutlass is the easiest ship battle.
- Click a pirate or crew card to select. Shift-click adds/removes canvas pirates. Click a deck to move, or an enemy to attack. **Select crew → Board ship** sends the whole crew across.
- **Duties & equipment**: assign trained cooks, deck cleaners, shipwrights, doctors, or cannoneers. Buy skill books, owned melee/ranged weapons, and armor in port. Direct orders interrupt work; assigning a duty resumes it.
- Cannoneers walk to the cannon, load, and fire using ammunition. Enemy broadsides damage hull and crew; shipwrights use timber for repairs. Dirty decks lower morale, and raw provisions need cooking.
- **Go ashore** at an island, defeat any guards, then **Collect chest**. After a battle or chest pickup, **Retreat** every survivor, then **Plunder / take spoils**. Choose **Capture ship** to take an intact enemy hull instead. **Break off** leaves without loot.
- **Space** pauses. Movement/boarding orders can be queued while paused; cannon fire and battle healing require resume. **Escape** closes a panel or toggles pause.
- Plunder brings gold, timber, ammunition, and crew experience. Capture replaces your hull and yields no salvage timber. Defeat all four pirate lords to win a new campaign.
- Hotkeys: **Q** select crew, **B** board/land, **R** return, **C** cannon, **F** chest, **P** plunder, **I** crew, **M** map. Settings controls sound effects and reduced motion.
- Checkpoints save at purchases, departure, and victory. Captain death offers the living departure checkpoint. Settings provides restore, previous checkpoint, export/import, and reduced motion.

Only one browser tab can own writable save state. Backgrounding pauses the voyage. A failed purchase save rolls back the purchase; a failed departure save blocks sailing. Export a backup before clearing browser storage.

## Current scope

Version 0.3.0: one harbour, ten map locations, three pirate ship encounters, two explorable islands, four pirate lords, up to twelve allied pirates, functional station duties, skill books, owned weapon loadouts and armor, cooking/cleaning/fishing/repairs/healing, localized plank wear, hull combat, recruit traits and previews, ship capture/plunder, hunger/morale, wages, leveling, tactical pause, refitting, escape, original synthesized sound effects, and local saves. Existing version-1 and version-2 checkpoints migrate without losing their original campaign map.

This is a growing remake, not a verified 1:1 recreation. Art, names, interfaces, terrain, and balance are original. Individual hull-block destruction, full equipment/drop inventories, swimming, rum/toys, the complete trait catalogue, procedural world topology, music/voice lines, pets, and full original content remain. Boarding uses a drawn rope with abstract transfers; navigation uses a deck/ladder graph. The [fidelity tracker](docs/fidelity.md) distinguishes reference behavior, delivered systems, and gaps.

## Robustness and verification

Simulation is renderer-independent, seeded, and fixed at 20 Hz with bounded catch-up and search work. Explicit application/scene/encounter cleanup, capped collections, immutable checkpoint capture, ordered IndexedDB writes, input backpressure, stale-callback checks, and exclusive writable-tab ownership are in place.

See [implementation and measured checks](docs/implementation-status.md), [design/spec index](docs/README.md), [performance contract](docs/specs/performance-and-lifecycle.md), and [attribution](docs/attribution.md). Runtime checks are scoped evidence, not a guarantee of leak-free behavior on every device.

No distribution license for project code/assets has been selected; free/noncommercial intent is recorded separately from third-party permissions.

Version 0.3 management screens: [crew traits](docs/images/crew-traits.png) and [fishing duty](docs/images/fishing-duty.png).
