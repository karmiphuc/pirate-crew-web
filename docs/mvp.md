# First playable scope

Status: proposed build baseline; balance and content counts remain provisional.

## Required experience

Start in port, recruit at least one pirate, modify a valid starter ship, purchase supplies, choose a route, complete travel, board an enemy, collect loot, return to port, buy an upgrade, save, and resume.

## Included

- Desktop browser, mouse and keyboard, single player.
- One port with recruitment, supplies, equipment, and ship parts.
- Starter ship plus grid editor, connected hull, ladders, cannon, food/cooking and medical stations.
- Starting crew of three; first slice supports five; later MVP ceiling of twelve player pirates subject to profiling.
- Individual and group selection, pause, order feedback, move/attack/board/retreat and station tasks.
- Health, hunger, morale, wages, healing, and basic experience progression.
- Seeded small map: one region, three enemy ship templates, two island encounters, four pirate lords.
- Melee and ranged equipment; a limited cannon exchange before boarding.
- Gold and parts loot; return to port; equipment and station upgrades.
- IndexedDB saves, previous checkpoint recovery, export/import, hidden-tab pause.
- First-expedition tutorial and settings for sound, motion, and readable UI scale.

## Deferred

Multiplayer, accounts, cloud saves, mobile/portrait layouts, full buoyancy/flooding, pets, farming, large crafting trees, procedural quests, fleets, negotiation/surrender, and permadeath mode. The full concept can revisit these after the slice passes.

## Acceptance gates

| ID | Gate |
| --- | --- |
| MVP-01 | A new player completes the full loop without developer intervention |
| MVP-02 | Every player command is acknowledged; failed commands show a specific reason |
| MVP-03 | Ship editor prevents committing invalid layouts and preserves the previous layout |
| MVP-04 | Boarding, retreat, and damaged access never leave pirates silently stuck |
| MVP-05 | All required stations affect gameplay and are reachable on the starter ship |
| MVP-06 | Save/reload preserves crew, ship, inventory, route, and encounter outcomes |
| MVP-07 | Hidden tabs do not advance hunger, wages, or combat |
| MVP-08 | A full simulated campaign has bounded entity and effect counts |
| MVP-09 | A recorded baseline laptop meets the measured performance budget |
| MVP-10 | Tutorial covers supplies, route risk, pause, boarding, retreat, loot, and saving |

## First slice versus final MVP

The slice proves the loop using one enemy layout and one island. The final MVP adds the remaining templates and boss only after navigation, saving, and command feedback pass. A first playable now exists; see [implementation status](implementation-status.md) for the delivered subset and remaining gates.

## Robustness gates added by review

| ID | Gate |
| --- | --- |
| MVP-11 | Encounter/scene/panel disposal returns owned counters to baseline after repeated cycles |
| MVP-12 | Runtime and imported content obey explicit collection/work limits |
| MVP-13 | Save ordering, required checkpoint barriers, quota failure, and exclusive writable-tab behavior pass |
| MVP-14 | Stale callbacks, initialization failure, and WebGL context loss have safe recovery paths |
| MVP-15 | Frame-time tails and allocation/retained-resource evidence satisfy the performance contract |

The [performance and lifecycle contract](specs/performance-and-lifecycle.md) defines the initial budgets. Implementation must not represent these gates as passed until runtime evidence exists.
