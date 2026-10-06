# World generation, travel, and economy

## World model

Seeded graph of nodes with region, encounter type, danger tier, discovery state, routes, and persistent outcome. Generate authored templates with controlled variation. Store mutable outcomes; revisiting a defeated encounter cannot duplicate its reward.

First region includes a starter port, two island encounter templates, three enemy ship templates, and one boss. Validate connectivity and guarantee a low-risk early route with reachable resupply. Provide at least two viable route choices before the boss.

## Travel

Preview travel duration, estimated food demand, scheduled wages, and known hazards. Mark estimates as estimates when hidden encounters can extend travel. The MVP does not dynamically inject impossible mandatory fights into the tutorial route.

Travel advances a finite number of simulation ticks, allowing visible crew tasks and needs. Arrival changes campaign phase explicitly. Hidden tabs and player pause stop travel. Use abstract speed derived from vessel and crew data; full steering/wind physics is deferred.

## Resource transactions

Gold, food portions, ammunition, medical supplies, repair parts, and owned construction parts. Transactions validate quantities and costs before atomic application; never permit negative inventory or double purchases from repeated input.

Recruitment and station upgrades have upfront costs. Crew wages and food impose recurring costs. Repair and healing consume stock. Rewards should allow recovery from the introductory encounter without guaranteeing unlimited expansion.

## Progression

Experience earned for encounter contributions and objective completion; avoid idle sailing as the primary leveling strategy. Role upgrades change performance and unlock a small set of skills. Initial boss readiness should have multiple viable equipment/crew combinations.

## Acceptance scenarios

- A fixed seed reproduces the same initial map for the same generator version.
- A seed batch has no disconnected required boss or missing starter port.
- The introductory expedition is affordable from starting resources.
- Travel preview and actual consumption agree in a route without interruptions.
- Reloading a cleared node does not replenish loot.
- Buying more recruits visibly increases the next route's operating costs.

## Balance work

Prototype rates in content files. Track gold earned/spent, food runway, wages, casualties, encounter time, and route choices in local developer instrumentation. Do not add external analytics in the MVP.

## Bounded generation and retained state

Validate map, grid, graph, actor, and equipment capacities from [performance contract](performance-and-lifecycle.md). Generate/validate content at setup boundaries; use bounded attempts and a known valid starter fallback if procedural choices fail. Never retry generation indefinitely.

Unvisited encounters retain template IDs and seeds, not instantiated actors/views. Completed encounters retain compact reward/outcome flags. Loot capacity is checked before commit with explicit sell/discard choices; no reward may disappear silently. Inventory and world outcome schemas enforce the same limits as runtime collections.
