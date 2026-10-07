# First playable implementation

Version: 0.6.2. Date: 2026-10-07. Previous baseline: 0.6.1.

## Delivered

TypeScript 5.9.3, Phaser 3.90.0, Vite 7.3.6; a single-thread renderer-independent simulation; original expressive pirate sprites, weathered ship scenery and an illustrated coastal backdrop; DOM management panels; authored ten-node chart with four pirate lords; real-time cannon/melee/pistol battles with pause; recruitment, supplies, upgrades, morale/hunger, wages, experience; ship/station editing and deck/ladder navigation; functional worker claims for cooking/cleaning/repair/medicine/gunnery; skill books, owned weapon lockers, armor; hull combat, destroyed planks, short-gap crossing, lower-deck falls and targeted structural restoration; fishing that supplies the galley; four recruit traits with visible previews; explicit plunder/capture; island landing, guard combat and chest collection; escape; campaign victory; two-frame walking sprites and original synthesized effects; versioned IndexedDB checkpoints and JSON backups.

## Architecture evidence

- Authoritative state never depends on sprite position or physics timing.
- Fixed 20 Hz ticks, at most two catch-up ticks/frame, bounded time accumulator.
- Navigation searches are incrementally advanced with at most four searches and 2,048 expansions/tick; current ship graphs only.
- Command capacity 64, orders eight/actor, twelve allies/enemies, notices 64. Work claims are keyed by ship/duty; at most one worker per slot and one task per actor. Orders, death, refits, capture, teardown, and disposal release claims/searches. Direct commands interrupt work.
- Encounter teardown removes enemy entities, graphs, searches, paths, commands, and sprite bindings. Scene shutdown removes both paired shutdown/destroy handlers and external subscriptions.
- No universal object pool, worker, ECS, spatial index, or per-frame world clone. Typed buffers serve bounded BFS scratch and timing samples only.
- Four shared 96 × 120 sprite atlases provide idle/walk/blink frames and are created once; one shared backdrop texture supplies harbour and cropped open-sea frames; static ship/background graphics redraw on layout/phase changes. No per-frame generated textures or post-processing.
- Saves serialize through one writer with backpressure and transaction-complete acknowledgement. Mutation freezes during required writes. Port purchase failures restore pre-purchase state; departure writes precede combat.
- Web Locks guards the browser save writer. Startup falls back to a previous valid checkpoint; invalid imports preserve current state.
- Hidden-tab events pause and clear catch-up time. Context loss pauses, context restoration requires explicit resume. Generation/closed checks prevent stale application callbacks from reviving disposed simulation.

## Current fidelity and scope limits

| Planned system | Current behavior |
| --- | --- |
| Task board / station workers | Delivered duties with exclusive claims and skilled workers at reachable stations. Emergency priority and critical-injury retreat are still deferred |
| Ship destruction / damaged boarding paths | Hull damage, plank destruction, sinking, targeted structural restoration, path invalidation, one-gap jumps and falls delivered. Swimming/rescue and general rigid-body destruction deferred |
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

`npm test`: 92 scenarios including connected upper decks, severed ladders, invalid edits, exact move completion, complete expedition, no duplicate island loot, deterministic battles, queue caps, failure feedback, captain death/checkpoint, escape safety, prepared boss victory, 50 simulation encounter cycles, idempotent disposal, malformed saves, ordered writes, injected quota failure, immutable snapshots, and subscription release. Expanded scenarios cover work-slot races, work interruption/death, resource-limited repairs/healing/cooking, skill books, owned loadouts, armor caps, hull sinking, explicit once-only prize handling, capture, guarded islands, fractional waypoint completion, station relocation, and bounded schema-1 migration. Version 0.3 adds fishing/galley supply and reserve limits, cancellation of unfinished catches, trait effects on movement/work/needs, fixed repair targets under incoming hits, refit wear preservation, reachable work components, and immutable v1/v2 migration with malformed trait/wear rejection.

`npm run build`: TypeScript and production build pass. `npm run format:check` checks readable source formatting. Dependency audit covers dev and production packages; initial older tooling was updated to patched versions.

The Chromium integration script tests fishing skill purchase and real galley supply, visible recruit traits and schema-3 saves, skill/equipment purchases, canvas station relocation, naval combat, explicit plunder, island landing/chest/return, ship capture and reload through visible controls, reload persistence, a second save tab, invalid and valid refits, 100 panel cycles, ten scene restarts, 50 rendered encounter fixture cycles, storage-failure rollback, audio mute/voice caps/context closure, WebGL context loss/restoration, and application disposal. It records frame/tick percentiles, heap/DOM counters, texture counts, and subscriptions to `artifacts/browser-report.json`.

Visibility testing in the integration script is synthetic; it verifies the handler, not every browser's real background/BFCache behavior. Encounter fixture cycles accelerate simulation but allow real render/cleanup frames. Heap comparisons use diagnostic forced GC; this is not the proposed 30-minute ordinary-GC soak.

## Remaining evidence

A real baseline laptop/GPU; Chrome/Firefox/Safari browser matrix; full 30-minute ordinary-GC soak; retained-object heap-snapshot inspection; repeated context loss on hardware; blocked/corrupted IndexedDB across browsers; large/high-DPI scene input feel; unfamiliar-player observations. Content expansion should follow these checks and the remaining system contracts.

## Measured Chromium run

See [machine-readable report](validation-results.json). Version 0.6.2 development build, Chromium SwiftShader software rendering, 1440 × 1080 viewport. Scoped sample: frame p95 41.65 ms, tick p95 0.1 ms, zero stalls. Diagnostic-GC retained JS heap: 10,709,444 → 8,832,744 bytes across 50 rendered encounters; listeners 75 → 75, textures 8 → 8. All expedition, management, destruction, persistence, context and audio scenarios pass with no page errors. Atlas validation confirms all character alpha values are 0 or 255 and nine frames per 96 × 120 atlas. Idle blink and reduced-motion suppression pass.

This fixture supports bounded cleanup but does not establish 60 FPS on hardware or a 30-minute ordinary-GC soak. The software-rendered frame p95 is slower than the prior scoped sample; these are not controlled hardware comparisons. Heap snapshots and browser/hardware coverage remain outstanding. Production root and repository-path checks pass with diagnostics absent.

## Published CI evidence

Source version 0.2 was published in [commit b77bcd3](https://github.com/karmiphuc/pirate-crew-web/commit/b77bcd36abf81fea3ffa0c282e2ebd102fcd4880). [GitHub Actions run 37464965027](https://github.com/karmiphuc/pirate-crew-web/actions/runs/37464965027) passed npm installation, formatting, all 51 tests, production build, and the root/project-path Chromium hosting smoke. Deployment stopped at `configure-pages` because the repository Pages site is not enabled. Source publication and build validation are complete; no live Pages deployment is claimed.

## Version 0.3 published CI evidence

Source version 0.3 was published in [commit ce6e4dd](https://github.com/karmiphuc/pirate-crew-web/commit/ce6e4dd5e9601c3e2d1c06a655ec56c0926a07d3). [GitHub Actions run 37472166471](https://github.com/karmiphuc/pirate-crew-web/actions/runs/37472166471) completed the build job successfully: locked dependency installation, formatting, all 69 tests, production build, root/project-path Chromium checks, and upload of the static Pages artifact. The deployment job then failed at Pages configuration with `Get Pages site failed` / HTTP 404. The owner still needs Settings → Pages → GitHub Actions. No live site is claimed. This confirms that build verification/artifact delivery succeeds independently of hosting activation.

## Version 0.4 movement and structure

Damage 100 removes a hull plank's support but keeps its bounded blueprint slot. Geometry changes replace only that ship's current graph, increment its revision, and release stale searches, work claims and paths. Short jumps require surviving endpoints and clear headroom; wider gaps report an unreachable route. Unsupported actors fall vertically to a surviving deck/ladder; drops beyond one cell cost health. No surviving support means loss overboard; swimming is still deferred. Repairs require a local reachable work site and raise crew occupying a restored plank onto its new deck.

Destroyed station access disables work. Sailing, escape and prize handling refuse unsafe or disconnected home crew; capture rejects an inaccessible prize layout. Schema 4 preserves destroyed blueprint slots and validates actual crew support. Schema 3 maximum wear migrates to 99 to retain its previously solid floors. Fall tracking belongs to the simulation and releases on landing, death, cleanup and disposal. No particle pools, per-frame textures or additional world caches were introduced.

Port rest uses a transient rollback snapshot so an isolated/falling crew member can be recovered before the new checkpoint is written. Failed writes restore both prior campaign state and fall origin, preserving drop penalties. Player and enemy cannons both stop when station support is destroyed.

The final scoped Chromium run precedes the additional legacy diagonal-corner migration normalization and guide text; those final changes were checked by the 92-test suite, TypeScript/build and production hosting smoke. The renderer/simulation ownership and movement code are the same as the recorded stress run.

## Version 0.4 published CI evidence

[Source commit c374ac7](https://github.com/karmiphuc/pirate-crew-web/commit/c374ac7a32c16f93917c1ba499f7ccfa91702b76) contains the version 0.4 implementation. [GitHub Actions run 37575251396](https://github.com/karmiphuc/pirate-crew-web/actions/runs/37575251396) passed the build job: locked installation, formatting, 92 tests, TypeScript/Vite build, root/project-path Chromium hosting checks, and static artifact upload. Deployment configuration failed with `Get Pages site failed` / HTTP 404 because Pages is not enabled. Build/artifact delivery is complete; no live deployment is claimed.

## Version 0.5 visual direction and resource ownership

Shaped tricorns, headwraps, bandanas, faces, coats, boots and visible weapons replace identical rectangular bodies. DOM portraits use the same four atlases as the scene. Plank grain, staggered seams, cloth folds, rigging, brass cannon details and curved palms replace flat placeholder scenery. The simulation, hit-supported deck geometry and save schema remain unchanged.

The 1931 × 813 backdrop is 390,592 bytes as WebP (about 382 KiB), with roughly 6 MiB of decoded RGBA pixels before driver overhead. Its harbour/open-sea crop shares one global application texture; it is not recreated per actor, encounter or frame. Eight total Phaser textures are expected across restarts. Scene-owned portrait CSS variables are removed on shutdown and restored on activation. No particles, shaders, texture-per-actor caches or new animation timers were introduced. Static scenery still redraws on relevant revisions rather than on every tick.

See [visual review and provenance](design/visual-review.md). This is a substantial original art pass, not a reproduction of the Steam game's assets or a completed 1:1 remake. Island shore outlines and some station props remain simple; richer character animation is still deferred.

The recorded full integration run precedes the final compact-layout CSS adjustment that hides the long hint at 750 pixels and below. This adjustment was checked with a fresh 700-pixel capture, TypeScript/build and production hosting checks; simulation and renderer code are unchanged from the recorded stress run.

## Version 0.5 published CI evidence

[Source commit 4f7ad10](https://github.com/karmiphuc/pirate-crew-web/commit/4f7ad10381efd9058793202f23723f008a9c2094) contains the original art overhaul. [GitHub Actions run 37577096341](https://github.com/karmiphuc/pirate-crew-web/actions/runs/37577096341) passed its build job: locked installation, formatting, 92 tests, production build, Chromium root/project-path hosting checks and static artifact upload. Deployment failed at `configure-pages` with `Get Pages site failed` / `Not Found` because the repository Pages site is not enabled. The owner must select Settings → Pages → GitHub Actions; no live site is claimed.

## Version 0.6 visual refinement

[Visual review](design/visual-refinement.md) records fresh captures, improvements and remaining limits. Three ID-derived non-captain appearance variants reuse four shared atlases; decoded atlas pixels increase by about 80 KiB, with no texture-count growth or schema change. Static sandy/rocky shore edges, sparse vegetation, foam, hull contact shadows, barrel hoops and medical-case straps replace remaining placeholder details. Island headline and desktop roster height are corrected. Final frame selection uses preallocated names and skips redundant frame changes. No simulation, navigation or save-format behavior changed.

## Version 0.6 published CI evidence

[Source commit 8c02ebf](https://github.com/karmiphuc/pirate-crew-web/commit/8c02ebf4d7044bb7eb73f3f22dd6d4fd2338c487) contains the visual refinement. [GitHub Actions run 37584996112](https://github.com/karmiphuc/pirate-crew-web/actions/runs/37584996112) passed the build job: locked installation, formatting, 92 tests, production build, root/project-path Chromium hosting checks and static artifact upload. Deployment still fails at Pages configuration because the repository Pages site is not enabled; no live deployment is claimed.

## Version 0.6.1 raster character correction

[Pixel crew review](design/pixel-crew.md) records the user's rejected soft outlined style and its replacement with integer-pixel original sprite art. Native actor scale, nearest-neighbour portraits, adjusted health bars/selection rings/click height and unchanged bounded atlases align the foreground with pixel art. The accepted background and simulation are unchanged.

## Version 0.6.2 cute crew iteration

[Art iteration notes](design/cute-crew.md) record the larger faces, rounded stepped cheeks/jaws, eye glints, tiny smiles, shorter bodies/boots, softened palette and one-pixel walk bounce. Shared idle-blink frames follow the existing tick clock and respect reduced motion. Four atlases grow by 60 KiB decoded RGBA, with unchanged eight-texture/four-subscription targets. The accepted background, native actor scale, input targeting, navigation, simulation and save format remain unchanged.
