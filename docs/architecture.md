# Technical architecture

Status: proposed, revised after the [pre-implementation review](pre-implementation-review.md). Pin library versions and verify supported browsers and lifecycle APIs during scaffolding.

## Stack

TypeScript, Phaser, Vite, HTML/CSS menus, IndexedDB persistence. No runtime backend. A minimal DOM interface can be sufficient initially; adding React is a separate decision based on actual UI complexity.

Phaser handles presentation, input adapters, audio, and asset loading. Its [official overview](https://docs.phaser.io/phaser/getting-started/what-is-phaser) documents browser rendering. Browser save and lifecycle references: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

## Proposed module layout

```text
src/
  sim/        state, commands, systems, seeded RNG, events
  content/    validated item, part, enemy, encounter definitions
  game/       Phaser scenes, views, input and audio adapters
  ui/         DOM panels, selectors, accessible controls
  storage/    IndexedDB adapter, schemas, migrations, import/export
  app/        startup, settings, lifecycle integration
```

Simulation imports neither Phaser nor browser APIs. It receives commands and advances by explicit ticks. Same-thread renderers read authoritative records without mutation and use bounded position buffers for interpolation. DOM panels consume small projections and dirty revisions. Do not deep-clone the world each frame. Renderers do not own authoritative health, inventory, movement, or combat outcomes.

## Timing and determinism

Start at 20 simulation ticks per second with movement interpolation, render toward 60 FPS, and verify input feel in the prototype. Accumulate at most 100 ms and execute at most two catch-up steps per frame; discard surplus elapsed wall time and record stalls. Reset the time origin/accumulator on pause or visibility changes. Authoritative ticks are never skipped; game time slows during overload. Pause stops ticks while UI continues responding. Speed controls are deferred.

Use stable entity IDs, canonical iteration order, serializable RNG state, explicit command sequence numbers, and versioned content. Same build/content, initial state, seed, and command log should reproduce outcomes. Do not promise cross-version or cross-platform bit-exact replay before numerical behavior is validated.

## Simulation systems

Command validation → navigation/task assignment → movement → combat/stations → needs/economy → deaths/outcomes → events. Resolve simultaneous effects consistently and process death once. Derived navigation caches rebuild from authoritative layouts; they are not saved.

## Core entities

Campaign, WorldNode, Ship, Tile, Station, Pirate, EquipmentInstance, Task, Command, Encounter. IDs identify ownership and references. Content IDs identify definitions; instances hold mutable health, quantity, cooldowns, and equipment state.

## Performance

Follow the [performance and lifecycle contract](specs/performance-and-lifecycle.md). Start with simple bounded actor scans, full affected-ship graph rebuilds, reusable search scratch buffers, and capped effects. Introduce spatial indexes, incremental topology, additional pools, or workers only for measured bottlenecks. Define ownership and disposal before adding resources. Verify tail frame times, allocation churn, heap retention, DOM/listeners, audio, and GPU resources separately.

## Persistence boundary

Storage accepts validated serializable snapshots. Persist schema/content version, tick, RNG state, campaign phase, entities, resources, and world changes. See [persistence contract](specs/persistence.md). IndexedDB failures must leave an in-memory game usable and allow export.

## Runtime boundary

No account or server is required for gameplay. Treat imported saves as untrusted data: validate sizes, references, IDs, ranges, and schema before replacement. Never interpret save content as HTML or executable code.

## Failure boundaries

Generation tokens invalidate callbacks from old campaigns/scenes. Phase transitions validate before commit; storage barriers precede unsafe encounter entry. Unexpected authoritative invariant failures pause rather than continuing partially resolved combat. Recover from the last valid checkpoint. Only one tab owns writable campaign state.
