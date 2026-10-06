# First playable implementation

Version: 0.3.0. Date: 2026-10-06. Previous baseline: 0.2.0.

## Delivered

TypeScript 5.9.3, Phaser 3.90.0, Vite 7.3.6; a single-thread renderer-independent simulation; new procedural pixel sprites and ship scenery; DOM management panels; authored ten-node chart with four pirate lords; real-time cannon/melee/pistol battles with pause; recruitment, supplies, upgrades, morale/hunger, wages, experience; ship/station editing and deck/ladder navigation; functional worker claims for cooking/cleaning/repair/medicine/gunnery; skill books, owned weapon lockers, armor; hull combat and localized plank wear/targeted repairs; fishing that supplies the galley; four recruit traits with visible previews; explicit plunder/capture; island landing, guard combat and chest collection; escape; campaign victory; two-frame walking sprites and original synthesized effects; versioned IndexedDB checkpoints and JSON backups.

## Architecture evidence

- Authoritative state never depends on sprite position or physics timing.
- Fixed 20 Hz ticks, at most two catch-up ticks/frame, bounded time accumulator.
- Navigation searches are incrementally advanced with at most four searches and 2,048 expansions/tick; current ship graphs only.
- Command capacity 64, orders eight/actor, twelve allies/enemies, notices 64. Work claims are keyed by ship/duty; at most one worker per slot and one task per actor. Orders, death, refits, capture, teardown, and disposal release claims/searches. Direct commands interrupt work.
- Encounter teardown removes enemy entities, graphs, searches, paths, commands, and sprite bindings. Scene shutdown removes both paired shutdown/destroy handlers and external subscriptions.
- No universal object pool, worker, ECS, spatial index, or per-frame world clone. Typed buffers serve bounded BFS scratch and timing samples only.
- Four shared sprite atlases provide idle/walk frames and are created once; static ship/background graphics redraw on layout/phase changes. No per-frame generated textures or post-processing.
- Saves serialize through one writer with backpressure and transaction-complete acknowledgement. Mutation freezes during required writes. Port purchase failures restore pre-purchase state; departure writes precede combat.
- Web Locks guards the browser save writer. Startup falls back to a previous valid checkpoint; invalid imports preserve current state.
- Hidden-tab events pause and clear catch-up time. Context loss pauses, context restoration requires explicit resume. Generation/closed checks prevent stale application callbacks from reviving disposed simulation.

## Current fidelity and scope limits

| Planned system | Current behavior |
| --- | --- |
| Task board / station workers | Delivered duties with exclusive claims and skilled workers at reachable stations. Emergency priority and critical-injury retreat are still deferred |
| Ship destruction / damaged boarding paths | Hull damage, localized plank wear, sinking, targeted repair, and port layout invalidation delivered. Per-block destruction and damaged combat topology deferred |
| Boarding edge reservations and rope animation | One transfer per tick, valid deck endpoints; abstract crossing with no physical rope simulation |
| Equipment instances and roles | Three owned weapon choices per pirate, armor, skill books and direct training; full item/drop inventory and proficiency stats deferred |
| Seeded procedural world templates | Authored ten-node topology with stored seeds; seeded combat RNG; procedural topology generator deferred |
| Island exploration | Two walkable islands with an unguarded or guarded chest; explicit landing, collection, return, and rewards. Town inhabitants, wildlife and broader terrain deferred |
| Audio | Original synthesized effects; one lazily unlocked application AudioContext, maximum eight voices, immediate mute/background stop, explicit disposal. Music/voices deferred |
| Auto-save on every arrival / arbitrary combat save | Departure and victory checkpoints plus purchases/manual safe saves; combat saves rejected |
| Ship capture | Delivered: return all survivors, replace the home hull/stations, rebuild navigation, keep crew IDs and loadouts; no salvage timber for capture |
| Abandon crew confirmation | Escape refuses while surviving allies remain away from home; abandonment not supported |
| UI selection | Individual/group commands; canvas Shift-click adds members, crew cards select individually |

These limitations keep the implementation reviewable and playable without pretending the entire reference game's content or every proposed MVP gate is complete.

## Validation

`npm test`: 69 scenarios including connected upper decks, severed ladders, invalid edits, exact move completion, complete expedition, no duplicate island loot, deterministic battles, queue caps, failure feedback, captain death/checkpoint, escape safety, prepared boss victory, 50 simulation encounter cycles, idempotent disposal, malformed saves, ordered writes, injected quota failure, immutable snapshots, and subscription release. Expanded scenarios cover work-slot races, work interruption/death, resource-limited repairs/healing/cooking, skill books, owned loadouts, armor caps, hull sinking, explicit once-only prize handling, capture, guarded islands, fractional waypoint completion, station relocation, and bounded schema-1 migration. Version 0.3 adds fishing/galley supply and reserve limits, cancellation of unfinished catches, trait effects on movement/work/needs, fixed repair targets under incoming hits, refit wear preservation, reachable work components, and immutable v1/v2 migration with malformed trait/wear rejection.

`npm run build`: TypeScript and production build pass. `npm run format:check` checks readable source formatting. Dependency audit covers dev and production packages; initial older tooling was updated to patched versions.

The Chromium integration script tests fishing skill purchase and real galley supply, visible recruit traits and schema-3 saves, skill/equipment purchases, canvas station relocation, naval combat, explicit plunder, island landing/chest/return, ship capture and reload through visible controls, reload persistence, a second save tab, invalid and valid refits, 100 panel cycles, ten scene restarts, 50 rendered encounter fixture cycles, storage-failure rollback, audio mute/voice caps/context closure, WebGL context loss/restoration, and application disposal. It records frame/tick percentiles, heap/DOM counters, texture counts, and subscriptions to `artifacts/browser-report.json`.

Visibility testing in the integration script is synthetic; it verifies the handler, not every browser's real background/BFCache behavior. Encounter fixture cycles accelerate simulation but allow real render/cleanup frames. Heap comparisons use diagnostic forced GC; this is not the proposed 30-minute ordinary-GC soak.

## Remaining evidence

A real baseline laptop/GPU; Chrome/Firefox/Safari browser matrix; full 30-minute ordinary-GC soak; retained-object heap-snapshot inspection; repeated context loss on hardware; blocked/corrupted IndexedDB across browsers; large/high-DPI scene input feel; unfamiliar-player observations. Content expansion should follow these checks and the remaining system contracts.

## Measured Chromium run

See [machine-readable report](validation-results.json). Version 0.3 development build, headless Chromium with SwiftShader software rendering, 1440 × 1080 viewport. Latest scoped sample: frame p95 48.34 ms, tick p95 0.1 ms. Retained JS heap after diagnostic GC: 8,426,440 → 8,361,472 bytes across 50 rendered encounter cycles; listeners 72 → 72, textures 7 → 7, task/claim/search counters zero after cleanup. There were no page errors. Full UI fishing/galley, traits, purchase/combat/plunder/island/capture/reload flow passed, along with mute/voice cap and final AudioContext closure.

This supports bounded cleanup for this fixture; it does not establish the 60 FPS hardware target, GPU memory recovery, or a 30-minute unforced-GC soak. DOM node samples varied 339 → 366 while listeners remained stable; these counts are recorded, not presented as proof that every detached object has been excluded. Production root/project-path hosting checks pass with the diagnostic hook absent, recruitment/save reload, ten-node chart, third-party notices, and no page errors.

## Published CI evidence

Source version 0.2 was published in [commit b77bcd3](https://github.com/karmiphuc/pirate-crew-web/commit/b77bcd36abf81fea3ffa0c282e2ebd102fcd4880). [GitHub Actions run 37464965027](https://github.com/karmiphuc/pirate-crew-web/actions/runs/37464965027) passed npm installation, formatting, all 51 tests, production build, and the root/project-path Chromium hosting smoke. Deployment stopped at `configure-pages` because the repository Pages site is not enabled. Source publication and build validation are complete; no live Pages deployment is claimed.

## Version 0.3 published CI evidence

Source version 0.3 was published in [commit ce6e4dd](https://github.com/karmiphuc/pirate-crew-web/commit/ce6e4dd5e9601c3e2d1c06a655ec56c0926a07d3). [GitHub Actions run 37472166471](https://github.com/karmiphuc/pirate-crew-web/actions/runs/37472166471) completed the build job successfully: locked dependency installation, formatting, all 69 tests, production build, root/project-path Chromium checks, and upload of the static Pages artifact. The deployment job then failed at Pages configuration with `Get Pages site failed` / HTTP 404. The owner still needs Settings → Pages → GitHub Actions. No live site is claimed. This confirms that build verification/artifact delivery succeeds independently of hosting activation.
