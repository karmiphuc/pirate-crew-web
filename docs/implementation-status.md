# First playable implementation

Version: 0.1.0. Date: 2026-10-05.

## Delivered

TypeScript 5.9.3, Phaser 3.90.0, Vite 7.3.6; a single-thread renderer-independent simulation; new procedural pixel sprites and ship scenery; DOM management panels; original seven-node chart; real-time cannon/melee/pistol battles with pause; recruitment, supplies, upgrades, morale/hunger, wages, experience; ship editing and deck/ladder navigation; escape; boss victory; versioned IndexedDB checkpoints and JSON backups.

## Architecture evidence

- Authoritative state never depends on sprite position or physics timing.
- Fixed 20 Hz ticks, at most two catch-up ticks/frame, bounded time accumulator.
- Navigation searches are incrementally advanced with at most four searches and 2,048 expansions/tick; current ship graphs only.
- Command capacity 64, orders eight/actor, twelve allies/enemies, notices 64.
- Encounter teardown removes enemy entities, graphs, searches, paths, commands, and sprite bindings. Scene shutdown removes both paired shutdown/destroy handlers and external subscriptions.
- No universal object pool, worker, ECS, spatial index, or per-frame world clone. Typed buffers serve bounded BFS scratch and timing samples only.
- Shared sprite textures are created once; static ship/background graphics redraw on layout/phase changes. No per-frame generated textures or post-processing.
- Saves serialize through one writer with backpressure and transaction-complete acknowledgement. Mutation freezes during required writes. Port purchase failures restore pre-purchase state; departure writes precede combat.
- Web Locks guards the browser save writer. Startup falls back to a previous valid checkpoint; invalid imports preserve current state.
- Hidden-tab events pause and clear catch-up time. Context loss pauses, context restoration requires explicit resume. Generation/closed checks prevent stale application callbacks from reviving disposed simulation.

## Deliberate departures from the planned MVP

| Planned system | Current behavior |
| --- | --- |
| Task board / station workers | Deferred; food consumption is automatic, medicine is player-triggered, cannon needs an available home-ship pirate |
| Ship destruction / damaged boarding paths | Port layout invalidation implemented; hull damage and combat topology destruction deferred |
| Boarding edge reservations and rope animation | One transfer per tick, valid deck endpoints; abstract crossing with no physical rope simulation |
| Equipment instances and roles | Role-dependent melee/pistol attacks and direct weapon training; no full equipment inventory |
| Seeded procedural world templates | Authored seven-node topology with stored seeds; seeded combat RNG; procedural topology generator deferred |
| Island exploration | Two immediately resolved treasure/supply stops |
| Audio | Not included; Phaser audio disabled to avoid unnecessary audio-resource ownership in this slice |
| Auto-save on every arrival / arbitrary combat save | Departure and victory checkpoints plus purchases/manual safe saves; combat saves rejected |
| Abandon crew confirmation | Escape refuses while surviving allies remain away from home; abandonment not supported |
| UI selection | Individual/group commands; canvas Shift-click adds members, crew cards select individually |

These limitations keep the implementation reviewable and playable without pretending the entire reference game's content or every proposed MVP gate is complete.

## Validation

`npm test`: 24 scenarios including connected upper decks, severed ladders, invalid edits, exact move completion, complete expedition, no duplicate island loot, deterministic battles, queue caps, failure feedback, captain death/checkpoint, escape safety, prepared boss victory, 50 simulation encounter cycles, idempotent disposal, malformed saves, ordered writes, injected quota failure, immutable snapshots, and subscription release.

`npm run build`: TypeScript and production build pass. `npm run format:check` checks readable source formatting. Dependency audit covers dev and production packages; initial older tooling was updated to patched versions.

The Chromium integration script tests the complete loop through visible controls, reload persistence, a second save tab, invalid and valid refits, 100 panel cycles, ten scene restarts, 50 rendered encounter fixture cycles, storage-failure rollback, WebGL context loss/restoration, and application disposal. It records frame/tick percentiles, heap/DOM counters, texture counts, and subscriptions to `artifacts/browser-report.json`.

Visibility testing in the integration script is synthetic; it verifies the handler, not every browser's real background/BFCache behavior. Encounter fixture cycles accelerate simulation but allow real render/cleanup frames. Heap comparisons use diagnostic forced GC; this is not the proposed 30-minute ordinary-GC soak.

## Remaining evidence

A real baseline laptop/GPU; Chrome/Firefox/Safari browser matrix; full 30-minute ordinary-GC soak; retained-object heap-snapshot inspection; repeated context loss on hardware; blocked/corrupted IndexedDB across browsers; large/high-DPI scene input feel; unfamiliar-player observations. Content expansion should follow these checks and the remaining system contracts.

## Measured Chromium run

See [machine-readable report](validation-results.json). Headless Chromium with SwiftShader software rendering, 1440 × 1080 viewport; development build, normal browser precision. Latest sample: frame p95 30 ms, tick p95 0.1 ms. Retained JS heap after diagnostic GC: 8006496 → 8003672 bytes across 50 rendered encounter cycles; listeners 72 → 72 and shared textures 7 → 7. No page errors were observed. This supports bounded cleanup for this fixture; it does not establish the 60 FPS hardware target, GPU memory recovery, or a 30-minute unforced-GC soak.

Production smoke check also passed: production diagnostic hook absent, recruitment, world chart, treasure voyage, and no browser page errors. Dependency notices are included in the static output.
