# Pre-implementation review

Date: 2026-10-05. Scope: review of documentation and primary browser/engine documentation. No game code exists, so runtime performance and robustness are not yet verified.

## Findings and corrections

| Priority | Gap in original baseline | Correction |
| --- | --- | --- |
| High | Scene/encounter cleanup had no owner or release sequence | Explicit application/campaign/activation/encounter ownership and idempotent disposal |
| High | Pooling was prescribed without evidence and could retain prior worlds | Pool only demonstrated high-churn resources; bounded capacity and complete reset |
| High | Queues, caches, graphs, and work could grow without limits | Concrete provisional capacities and defined overflow behavior |
| High | Damage could cause a burst of simultaneous path searches | Coalesced revisions, bounded deterministic expansion scheduling |
| High | Save requests could finish out of order or leave a tab using stale campaign state | Single writer, generations, transition barriers, transaction-complete acknowledgement |
| High | Two browser tabs could overwrite the same campaign | Single writable-tab ownership; others read-only until safe acquisition |
| Medium | Renderer snapshots implied potential whole-world copies every frame | Same-thread read-only records, bounded interpolation, projected DOM UI updates |
| Medium | Spatial queries/incremental graph updates were premature complexity at 24 actors | Simple bounded scans and affected-ship rebuild first; optimize from profiles |
| Medium | Average FPS and heap plateau could conceal stalls, retained scenes, and GPU growth | Tail frame/tick metrics, snapshots/retainers, scope counts, render resource accounting |
| Medium | Save/lifecycle validation arrived after most features | Bring storage and teardown harness into B01/B02; integrate throughout |
| Medium | Boarding fallback undefined if no origin deck survives | Explicit terminal vessel-loss recovery; no teleport into an invalid tile |

## Decision

Proceed only with the instrumented prototype stage when implementation is requested. Broader gameplay/content work depends on the lifecycle/navigation/save gates. Keep TypeScript + Phaser + Vite, single-thread simulation, abstract travel, and no backend. Pin the engine version and verify its disposal APIs before relying on them.

The new [performance and lifecycle contract](specs/performance-and-lifecycle.md) and [decision 0002](decisions/0002-performance-and-lifetimes.md) supersede vague optimization guidance in the initial baseline. All limits are proposed defaults; they must be measured before increasing content scope.

## Remaining implementation evidence

- Exact browser and baseline hardware matrix.
- Pinned Phaser version lifecycle tests, including restart and context loss.
- Bounded pathfinding under simultaneous destruction.
- Allocation and retained-resource measurements across repeated encounters.
- Single-writer/save failure/multiple-tab tests.
- Input feel at 20 Hz with interpolation.

No runtime benchmark results or leak-free claim are made by this review.
