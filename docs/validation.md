# Validation plan

## Automated checks to introduce during implementation

Use unit/headless scenario tests for deterministic commands, inventory transactions, topology, scheduling, damage, and save validation. Use a small browser smoke suite for new campaign → encounter → return → save/reload. Choose tooling when scaffolding; Vitest and Playwright are initial candidates.

Prioritize risks over superficial coverage percentages:

| Risk | Scenario |
| --- | --- |
| Unreachable workers | Remove sole ladder; ensure task releases and message appears |
| Broken boarding | Destroy endpoint before and during traversal; check recovery |
| Duplicate rewards | Resolve/reload/retry command; reward applies once |
| Save loss | Fail transaction; recover previous checkpoint |
| Dead references | Kill worker/target; no reserved station or stale order remains |
| Hidden time | Hide tab and resume; tick and needs remain unchanged |
| Invalid generation | Batch seeded maps; required nodes reachable |
| Long-session degradation | Repeated encounters; entity/cache/effect counts return to bounds |

## Performance targets

Provisional desktop targets: 60 FPS rendering in ordinary play, at least 30 FPS in worst supported scenes, simulation p95 under 5 ms per tick. Measure on a recorded baseline laptop with browser, hardware, build, crew/enemy counts, and scene complexity stated. Start the stress scene with twelve allies and twelve enemies, then profile the final boss scene. These targets are not measured results.

Run a 30-minute ordinary gameplay soak plus at least 50 enter/resolve/leave encounter cycles and 100 open/close panel cycles after asset warm-up. Return to the same port state between snapshots. Diagnostic forced GC is allowed for comparable heap snapshots, but the ordinary soak must also pass without it. Inspect retained paths and detached DOM; do not infer leaks solely from the rising side of normal GC sawtooth usage. Reference: [Chrome memory tools](https://developer.chrome.com/docs/devtools/memory-problems).

After disposal, encounter-owned enemy/task/path/view counts must be zero; listener/observer/timer counts return to their activation baseline; shared assets stay at a fixed warmed baseline. Track dynamic texture/render-target/audio counts separately from heap. No linear growth in retained encounter objects is acceptable. Report retained bytes and owners; set an absolute asset/process-memory budget only after the baseline hardware and real assets are known.

Record p50/p95/p99 frame intervals, main-thread tick durations, worst stalls, long tasks, allocation hotspots, path queue latency, and save duration. Initial routine-play p95 frame interval target is ≤20 ms at 60 Hz; worst supported scene p95 ≤34 ms and no repeated game-caused >100 ms stalls. Keep simulation p95 <5 ms/tick; investigate every recurring >50 ms game-caused task. These are provisional targets, measured in production builds with profiler overhead recorded and loading/saving phases reported separately.

## Playtest protocol

Observe at least five unfamiliar players through the first expedition. Record assistance needed, command misunderstanding, supply surprises, encounter completion, and upgrade choice. Initial target: four of five finish without developer help; revise tutorial/system clarity if they cannot. Small samples guide iteration, not statistical proof.

## Release gate

All MVP acceptance gates pass, critical data-loss/stuck-crew bugs are resolved, supported browsers are recorded, assets have provenance, and README run instructions work from a clean checkout. Repeat checks only when changes or unresolved failures justify them.

## Early robustness gate

B01/B02 must provide counters and a teardown harness before gameplay scope expands. Test scene restart, partial asset initialization failure, old async callbacks, pool reuse, reservation cleanup, save ordering, quota errors, two writable tabs, and context loss/recovery. Confirm exact lifecycle APIs against the pinned Phaser version.

For pathfinding, invalidate many paths at once and verify operation caps, deterministic ordering, pending feedback, and bounded queue latency. For allocation, compare warmed idle/combat/transition traces; do not demand zero allocation throughout the app. Any additional pool/index/worker requires a before/after trace at supported scale and matching correctness scenarios.
