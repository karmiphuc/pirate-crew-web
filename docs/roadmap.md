# Build roadmap

This is a dependency-ordered backlog, not a delivery commitment. Initial estimates assume one experienced full-time developer and modest asset requirements: prototype 2–4 weeks, full loop another 4–6, demo polish another 4–8. A broader game could take 6–12+ months. Re-estimate after the prototype.

| Work package | Depends on | Deliverable and completion evidence |
| --- | --- | --- |
| B01 Scaffold | None | Pinned TypeScript/Phaser/Vite, browser/hardware baseline, scope counters, scene restart/disposal and context-loss harness, clean-checkout run |
| B02 Simulation core | B01 | Bounded ticks/queues, seed, commands/events, deterministic scenario, minimal save writer and failure/order/two-tab harness |
| B03 Ship editor | B02 | Grid draft/commit, inventory transaction, visible validation |
| B04 Navigation | B03 | Deck/ladder graph, invalidation, bounded retries, safe crew positioning |
| B05 Crew commands/tasks | B04 | Selection, movement, orders, task claims, reasoned feedback |
| B06 Boarding and combat | B05 | One enemy ship, attacks, pause, retreat, damaged-access scenarios |
| B07 Port and needs | B05 | Recruitment, shops, food/morale/wages, operating-cost preview |
| B08 Map and travel | B06, B07 | Seeded graph, route choice, travel consumption, one island |
| B09 Integrated saves and lifecycle | B02–B08 | Integrate early save writer with all systems; checkpoint barriers, import/export, hidden-tab pause, recovery and teardown scenarios |
| B10 First slice validation | B09 | Complete expedition and recorded unfamiliar-player observations |
| B11 Content and progression | B10 | Three enemy templates, two islands, four pirate lords, meaningful upgrades |
| B12 Demo polish | B11 | Tutorial, settings, assets, stress/soak checks, all MVP gates |

## Next concrete implementation task

The runnable loop and v0.2 systems are implemented. Next: block-level hull health/destruction and damaged navigation; then fishing/swimming, traits and item loot, procedural region generation, and closer sprite/UI/audio matching against a named reference build. Continue browser/storage/lifecycle verification for each addition.

## Checkpoints

- Prototype gate: editor + reliable navigation + observable commands + measured bounded work and cleanup + basic storage failure safety.
- Slice gate: one complete expedition with safe save/reload.
- MVP gate: content breadth and all acceptance criteria.

Update documentation and decisions as experiments produce evidence. Do not mark a work package done based only on a visual mockup or a compiling scaffold.

## First implementation checkpoint

Version 0.1.0 delivers the expedition loop plus substantial portions of B01–B09 and authored B11 content. Lifecycle/save/navigation tests run early. Work packages are not marked fully complete: station tasks, combat topology destruction, procedural map generation, broad browser/hardware profiling, and unfamiliar-player validation remain. See [implementation status](implementation-status.md).

## Fidelity checkpoint 0.2

Delivered station duties and claims, skill books, owned weapon choices/armor, movable stations, hull combat/repair/sinking, safe explicit plunder/capture, walkable islands and guards, four pirate lords, original effects, and schema-1 migration. See [fidelity tracker](fidelity.md) for the remaining gaps. No claim of full original-game equivalence is made.
