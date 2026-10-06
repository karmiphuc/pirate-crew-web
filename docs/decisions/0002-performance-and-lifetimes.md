# Decision 0002: Explicit lifetimes and bounded work before optimization

Date: 2026-10-05
Status: adopted for the implementation baseline; numerical limits remain provisional.

## Context

The original docs identified performance risk but lacked owners, caps, overload behavior, and early evidence gates. Broad pooling and sophisticated indexing could increase retained memory and implementation bugs before providing a measured benefit.

## Decision

Use explicit application/campaign/scene-activation/encounter ownership and idempotent disposal. Keep same-thread renderer-independent simulation. Do not deep-clone the world for rendering. Enforce bounded queues, topology, effects, and saves; schedule expensive work by deterministic operation counts. Use simple records, scans, and affected-ship graph rebuilds at MVP scale. Pool only measured churn and bound/reset every pool.

Bring counters, timing, cleanup, and storage failure harnesses into the first prototype. Require frame-time and retained-resource evidence before adding content. See [contract](../specs/performance-and-lifecycle.md).

## Alternatives and consequences

A full ECS, universal object pools, worker simulation, or incremental graph repair may be warranted later, but each adds complexity and must follow a measured bottleneck. Bounded catch-up intentionally slows game time during severe stalls rather than accumulating an endless work backlog. Only optional visuals may be dropped; authoritative effects cannot be silently lost.

JS garbage collection remains automatic. Deterministic release of external resources is our responsibility, and GC timing never controls game outcomes.
