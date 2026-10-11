# Performance, ownership, and lifecycle contract

Status: pre-implementation requirements, reviewed 2026-10-05. Numbers below are provisional safety limits, not measurements. Changing a limit requires recording representative profiling evidence and updating import/content validation.

## Ownership instead of relying on GC timing

JavaScript GC reclaims unreachable objects; it cannot repair resources retained by listeners, closures, caches, or a stopped scene. GC timing is not a gameplay primitive. Use explicit teardown for application resources; do not use WeakRef or FinalizationRegistry for tasks, save safety, or resource disposal. Reference: [MDN memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management).

| Owner | Owns | End of lifetime |
| --- | --- | --- |
| Application | Game instance, shared atlases/audio definitions, lifecycle listeners, storage connection | Application disposal |
| Campaign | Authoritative world outcomes, home ship, roster, inventory, counters | New/load campaign replaces prior campaign |
| Encounter | Enemy entities, graphs, reservations, encounter tasks, view bindings | Resolution/escape/failure/load |
| Scene activation | External subscriptions, UI panel bindings, timers, tweens, active sounds | Every shutdown; create fresh on restart |
| Individual entity | Commands, reservations, view association | Death/removal, after current-tick effects settle |
| Diagnostics | Fixed-capacity timing samples and numeric counters | Explicit clear/disposal |

A resource has exactly one disposer. Shared assets stay application-owned rather than being removed by an encounter. Encounter-specific dynamic textures, render targets, audio instances, and caches have an explicit owner and release path. JS heap, DOM, decoded audio, and GPU memory are separate concerns.

Phaser shutdown and destroy are distinct, and textures/caches include global managers. Verify behavior against the exact pinned engine version. Never assume changing scenes frees every reference. Reference: [Phaser scenes](https://docs.phaser.io/phaser/concepts/scenes).

## Teardown sequence

1. Mark the outgoing activation/encounter closed and increment its generation token. Stop accepting new input.
2. Cancel owned asynchronous work where possible. Every eventual callback also checks campaign/activation generation before applying results.
3. Resolve gameplay outcome and surviving-crew placement at a tick boundary, before deleting enemy topology. Never award rewards during view disposal.
4. Release task, landing, station, path, and command references. Remove enemies from entity tables, spatial indexes, selection, and view-ID maps.
5. Detach external event subscriptions; stop owned timers, tweens, sounds, observers, and callbacks; destroy owned views/DOM; release temporary URLs and render resources.
6. Clear scratch buffers, pools, graph caches, diagnostics references, and pending callbacks belonging to this scope. Keep only compact campaign outcomes.

Disposal is idempotent, works after partially failed initialization, and does not trigger a second outcome. Restarting a scene never doubles listeners. Test start→shutdown→restart and failed load→retry, not only final application destroy.

## Allocation strategy

Use straightforward stable-shape records and bounded collections first. Do not impose a full ECS, universal pooling, typed-array storage, worker, or custom allocator without measured need.

Renderer reads authoritative records in the same-thread adapter, without mutating them. Copy previous/current positions into bounded interpolation buffers at simulation boundaries; do not deep-clone the campaign each frame. UI uses small projections with revision/dirty checks and at most 10 Hz routine updates; critical command/save feedback updates immediately.

Reusable pathfinding scratch arrays and bounded effect emitters are reasonable early optimizations. Pool additional objects only when allocation traces show benefit. Pools must reset targets, callbacks, IDs, timers, visibility and active state; enforce capacity; dispose surplus; never retain a previous campaign. Pooling can increase retained memory and is not a leak fix.

Avoid allocation-heavy scans, sorting, formatted strings, JSON serialization, and new closures inside per-actor/per-frame loops unless profiling shows they are harmless at supported scale. Do not log whole game objects during memory tests: developer tools can retain them.

## Provisional bounded capacities

| Resource | Initial bound | Full/overflow behavior |
| --- | --- | --- |
| Actors | 12 allies + 12 enemies per encounter | Reject over-cap content/import; boss minions count toward cap |
| Ship grid | 64 × 24 cells per ship; two ships active | Reject oversized editor draft/import |
| Island graph | 4,096 standing nodes | Reject invalid template/import |
| World | 64 nodes in one region | Reject invalid generator output/import |
| Equipment instances | 256 per campaign | Loot screen requires selling/discarding before commit |
| Queued orders | 8 per actor; 64 incoming input commands | Report queue full; replace superseded pointer previews only |
| Active tasks | 128 per encounter | Merge identical work requests; reject nonessential additions visibly |
| Tick outcome events | 512 records | Cosmetic events may be dropped; critical overflow faults and pauses tick processing |
| UI notifications | 64 recent entries | Coalesce repeated reasons and evict oldest completed notices |
| Cosmetic particles | 256 live | Drop optional effects; never gameplay actors |
| Diagnostic samples | 600 per metric; command trace 1,024 | Overwrite oldest; full replay only as explicit streamed developer capture |
| Save import | 2 MiB file; validated collection caps | Check size before parse; reject safely |
| Save queue | One active write + one pending snapshot | Coalesce pending ordinary saves; protect required transition saves |

Active actor IDs are never reused within a campaign. Store compact roster history only if needed; no dead-actor object archive. Presentation never owns authoritative projectile damage; initial attacks resolve hits on ticks, with visual trajectories as effects.

Authoritative capacity failures are detected before mutation where feasible. An unexpected invariant/event overflow pauses with a recoverable diagnostic; do not truncate authoritative effects silently or persist a partial tick. Keep the last committed safe checkpoint.

## Work budgets and stable scheduling

Start with a 20 Hz simulation (50 ms step) and interpolation for movement. That rate is a prototype hypothesis: assess input feel before adding content. UI acknowledgement is immediate, authoritative command application on the next tick, including pause queues.

Use a 100 ms accumulator ceiling and at most two catch-up steps per rendered frame. Discard surplus wall time, record a stall counter, and allow game time to slow during overload. Reset accumulator/time origin on pause, visibility loss, and resume. Never skip authoritative ticks or compute needs from elapsed wall time.

Path requests run in stable urgency/actor-ID order with at most four searches and 2,048 node expansions total per tick. Searches can resume across ticks with revision checks. Waiting paths expose a pending state. Editor validation pauses play and can yield between bounded chunks. The time profiler observes scheduling; it must not change authoritative search completion based on wall-clock deadlines.

Recompute task assignment on relevant state changes with a bounded 4 Hz fallback; movement/edge safety still checks every tick. Coalesce repeated topology changes per tick. At this scale, start with a full affected-ship graph rebuild and one current revision, rather than complex incremental repair. Block stale paths until a valid graph is ready. Keep at most one search per actor and no unbounded history of old graph revisions.

Simple bounded distance scans at 24 actors are acceptable. Introduce spatial hashing only if measured queries dominate. Use grid traversal for structure line of sight; do not use an all-purpose physics engine for deck movement.

## Rendering and GPU policy

Use shared atlases and limited texture switches; redraw cached ship geometry only on layout/damage revisions. Cull off-camera visuals. Cap initial canvas backing scale at 2× CSS size, observe resize only when dimensions change, and validate the high-DPI pixel cost.

Avoid post-processing, full-screen render textures, per-frame texture generation, and synchronous GPU readback in the MVP. Memory planning must include decoded images and audio, not only download bytes. Reduce cosmetic effects and backing scale when necessary; never reduce simulation correctness to recover FPS. Reference: [WebGL practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).

WebGL context loss pauses play and attempts only an already-valid checkpoint. Restore views/assets from authoritative state after engine restoration; if unsupported, offer reload/recovery rather than continuing invisibly. Asset failures have retry/cancel UI and unwind partial allocations.

## Evidence required

See [validation](../validation.md): frame-time percentiles, tick times, allocation traces, retention paths, scope counters, repeated teardown, ordinary unforced GC runs, and supported-browser save/lifecycle failures. Passing a heap test does not establish GPU or audio cleanup.

## Sea movement owners, version 0.9

The simulation sea map is capped at 24 living actor records. It owns numeric coordinates, tick counters, mode and IDs for origin/destination/line ownership. Cached water landings are invalidated by graph revision. At most one actor lands each tick; crossing starts have a six-tick minimum spacing. Death, gameover, encounter teardown, port recovery and simulation disposal release the records. Scene restart only replaces views. Sea drawing reuses existing sprites/graphics with no new textures, particles, timers or callbacks. Transactional rest rollback keeps bounded copies of these records rather than retaining the old simulation.

The 0.9.1 ship redraw reuses the existing static Graphics owner and its revision/draft invalidation. A 64 × 24 scratch grid and bounded room spans are temporary during redraw; no persistent room/view cache or additional texture is created. Never regenerate cabin art on an ordinary actor tick. Scene restart/disposal must retain the existing ten-texture/four-subscription counts and release actor/item/grip/Graphics owners.

Version 0.10.0 cabin fittings share static ship Graphics commands. At most 32 plain placement records per vessel and three numerical stock counters are retained; blueprint validation scans bounded geometry at commit/save boundaries. No fitting sprite, texture, timer, emitter or global cache exists. Application disposal clears all active draft arrays; scene shutdown clears its draft/station/fitting references. Fifty remove/place cycles must retain one navigation graph and no duplicated stock; focused browser tests inspect delayed Phaser teardown.

Version 0.10.1 constructs one arriving vessel with at most 96 parts and six fittings, without a template-instance cache or campaign RNG consumption. Extra masts/windows share the existing static Graphics owner. Static invalidation retains only two current ship references, replaces them on identity change and clears them on shutdown. A 100-redraw Chromium/SwiftShader sample measures scene-update CPU p95 1.40 ms, maximum 4.50 ms; this excludes GPU completion and is not a frame-rate guarantee. [Evidence](../fleet-validation-results.json).

Version 0.10.2 adds three numeric scene-owned camera bounds/centers and a focus-mode scalar. The existing Phaser camera owns scrolling; focus uses no tween, timer, texture copy or subscription. Shutdown clears cached centers/bounds. Static invalidation computes hull bounds once; a bounded crew scan drives whole-pixel follow. The expanded renderer retains ten textures and four scene subscriptions across ten restarts and releases all body/item/grip owners on disposal. Final forced-redraw CPU p95 0.80 ms/max 1.30 ms in Chromium/SwiftShader excludes GPU completion and does not guarantee real-device FPS. An earlier concurrent run measured p95 2.70 ms/max 21.80 ms. [Evidence and limits](../design/roomier-ships.md).

Version 0.11.0 retains six fixed numeric item counters and eighteen plain world nodes. Prize generation performs at most four draws; region generation uses fixed bounded draws/slot removals, and XP progression loops at most 99 times. Generated encounters exist only at arrival and use existing graph/teardown owners. Hold icons are bounded DOM SVGs owned by the modal; existing event delegation handles actions. No extra Phaser texture, timer, per-frame clone, worker or former-world cache is introduced. Fifty hold cycles/ten restarts/disposal and thousand-seed unit scenarios verify ownership/capacity boundaries; ordinary-GC/GPU evidence remains outstanding.

Version 0.12.0 adds only fixed carried enums and an at-most-two-entry owned accessory array per pirate, plus two shared stock counters. Weapon choice is constant work. Ranged obstruction checks scan the current vessel’s bounded hull cells (at most 1,536 imported blueprint cells; authored vessels at most 96), with numeric slab intersections and no allocations, ray cache or physics object. Accessory effects reuse existing movement/needs ticks. Loadout cards/icons are modal-owned DOM handled by existing delegation. No Phaser texture, sprite, timer, subscription or worker is introduced. Validate failed equip/stow writes, repeated changes, reload and disposal alongside full lifecycle/timing checks.

## Version 0.13.0 progression ownership

Each pirate owns six fixed attribute numbers, one point counter and one group enum. Derived combat/XP effects run at their existing boundaries, with no stacked modifier cache. Four group controls and a six-card inspector reuse delegated Application input; a closed inspector retains no attribute DOM. Group scans are bounded by the 24-actor cap within the existing 100 ms UI refresh. No extra textures, sprites, subscriptions, timers, workers or pools are introduced. Schema migration bounds crew before copying; imported attribute objects are explicitly reconstructed.

## Version 0.14.0 skill and input ownership

Each pirate owns eight fixed rank numbers and one lifetime-spend counter; the campaign owns eight fixed book counters. Progression runs at existing work, attack and sea boundaries. Work progress uses exact integer units (80 per baseline tick), composing rank fifths, half morale and 5/4 Industrious without fractional drift; the longest job stays below 13,000 units. UI cards reuse existing delegated modal input and dispose with the modal. Hit testing scans at most 24 existing body views only on clicks, with no candidate array, bounds cache or new listener. There are no new textures, timers, pools, workers or retained-world snapshots. Repeat trades, scene restarts and full disposal must retain established resource counts.
