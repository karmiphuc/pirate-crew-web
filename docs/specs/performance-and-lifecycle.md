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
