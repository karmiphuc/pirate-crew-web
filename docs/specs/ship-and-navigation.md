# Ship construction and navigation

## State and placement

Ships use local integer grid coordinates. Part definitions include footprint, collision, walk surface, connection rules, health, cost, and station type. Decorations are distinct from structural tiles.

The editor changes a draft. Commit atomically after checking: at least one connected hull, no footprint overlap, valid support, valid ladder links, accessible required stations, and a safe deck location for each existing pirate. Invalid drafts show affected tiles and reasons without consuming inventory.

Building is allowed only at port in the MVP. Editor and inventory commit together; cancel restores both. Damage can change topology during encounters and is handled by movement revalidation rather than invoking editor rules.

## Navigation graph

Nodes represent valid standing positions on decks, ladders, and station approaches. Edges encode walking, climbing, and boarding transitions, including distance/capacity. Ship and island graphs use local coordinates with scene transforms for presentation.

A layout revision invalidates paths touching changed geometry. A pirate validates the next edge before traversing it. If no valid route exists, stop safely, release the task claim, and emit a failure reason. Bound path retries; never retry continuously without a topology or target change.

## Boarding

Create an explicit connection between valid landing points after range and encounter-phase checks. Queue pirates if the connection is occupied. Reserve a landing cell before traversal. Validate both endpoints at start and completion.

If access is destroyed before traversal, cancel and notify. If destroyed during traversal, the MVP returns the pirate to the surviving origin endpoint; if neither endpoint survives, place at the nearest safe location on the origin ship and apply a documented fall penalty. Drowning simulation is deferred. Keep this recovery deterministic and visible.

Retreat uses a surviving boarding connection or re-establishes one to valid deck points. Encounter cleanup transfers surviving allies home before removing enemy graphs; it must not orphan actor references.

## Acceptance scenarios

- Removing the only ladder makes a station unreachable; editor commit is rejected.
- Cancelling a draft leaves parts and gold unchanged.
- Twelve pirates can board in sequence without shared landing collisions.
- Destroying a destination deck triggers defined recovery and a message.
- A completed encounter returns survivors to valid home-ship positions.
- Repeated layout changes do not leak graph nodes or retain dead targets.

## Bounds and total failure cases

Use graph/search limits and deterministic budgets from [performance contract](performance-and-lifecycle.md). Coalesce topology changes each tick; retain one current graph revision per vessel. Revision-bound paths/searches cannot use stale connectivity. A waiting search differs from an unreachable target in UI.

If boarding recovery finds no safe origin deck, declare vessel loss and end the attempt with checkpoint recovery. Do not teleport to an invalid tile. Re-establishing a retreat connection obeys the same range/end-point rules as boarding; otherwise report blocked escape and offer valid alternatives. Reservations release on death, interruption, topology revision, and encounter disposal.

## Version 0.4 implemented damaged topology

Hull damage at 100 means a destroyed blueprint slot. Navigation ignores that plank while the builder retains its intended position. Graph replacements affect one vessel and clear revision-bound paths, searches and worker claims. A one-cell horizontal gap may be crossed when both landing cells survive and headroom is clear; wider gaps are blocked. The renderer draws a short jump arc while simulation follows the validated edge. Falling checks support before orders/work/combat, descends 0.3 cells per tick to a surviving same-column node, and applies eight damage per cell beyond a one-cell drop. No support means loss overboard. These values are authored, not measured original formulas.

Repairs choose locally reachable candidates instead of scanning all graph nodes per plank. Restoration makes the destroyed slot solid again; crew in the restored cell rise onto its supported surface. Port rest rebuilds all planks and places crew on valid nodes. Boarding chooses a surviving destination landing in its reachable component. Safe campaign transitions require every surviving home crew member to be supported and connected. Swimming and physical ropes remain deferred.
