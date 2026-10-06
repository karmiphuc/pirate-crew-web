# Repository instructions

## Current phase

This repository contains a runnable first playable game plus design and build specifications. See `docs/implementation-status.md` for delivered behavior and explicitly deferred systems. Follow the MVP and roadmap when implementation is requested. Keep the README honest about runnable features.

## Source of truth

- `docs/mvp.md`: release scope and acceptance gates.
- `docs/game-design.md`: player experience and design principles.
- `docs/specs/`: system behavior and acceptance scenarios.
- `docs/architecture.md`: engineering boundaries.
- `docs/decisions/`: consequential decisions and their status.
- `docs/open-questions.md`: unresolved assumptions.

When changing scope or behavior, update the affected documents together. Separate observed reference-game facts from original proposed mechanics. Balance values and performance budgets are provisional until measured.

## Engineering expectations

Keep simulation independent of Phaser, browser APIs, wall-clock time, and UI. Inject seeded randomness and translate input into validated commands. Prefer small, explicit systems over framework-heavy abstractions. Never serialize renderer objects into saves.

Prioritize navigation reliability, command feedback, save safety, and a complete expedition loop. Use meaningful tests for those risks; avoid tests that only mirror implementation. Do not add multiplayer, accounts, or a backend to the MVP.

Follow the user's personal-use remake direction: any intended sharing is free/noncommercial and attributed. Use original or properly licensed assets and record provenance; reference-game code/assets require an applicable reuse permission. Maintain `docs/attribution.md`. Do not commit credentials, exported player saves, or generated build output.

## Robustness and performance baseline

Follow `docs/specs/performance-and-lifecycle.md` and decision 0002. Every resource has a named lifetime owner and idempotent disposer. Scene shutdown is not assumed to release global caches or external subscriptions. Bound all queues/caches/search work. Never silently drop authoritative events or rely on garbage-collection timing.

Start with simple bounded data structures; additional pooling, spatial indexing, workers, or ECS require measured benefit. No full-world render clones. Introduce lifecycle counters, storage failure/order harnesses, and allocation/frame-time checks before adding content. Record runtime evidence; documentation review alone cannot prove performance.
