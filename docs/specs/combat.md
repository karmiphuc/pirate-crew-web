# Combat and encounter outcomes

## Encounter phases

Setup → cannon exchange → boarding enabled → resolution → loot → departure. Phase transitions are explicit. The MVP permits limited cannon targeting before boarding, with a clear UI cue when boarding is available. Timing/range values are provisional.

## Weapons and damage

Weapon definitions include type, range, cooldown ticks, damage, accuracy, and resource use. Simulation checks target existence, hostility, range, line of sight, and ammunition. Use injected seeded RNG for random hit outcomes. Damage events contain attacker, target, amount, cause, and tick for feedback and debugging.

Apply health changes consistently; emit death once; release tasks and invalidate commands targeting the dead actor. Avoid permanent particle/corpse entities. Corpses are bounded visual effects unless explicitly needed for an objective.

## Role behavior

Boarders close to melee distance. Ranged fighters seek clear shots and maintain distance where possible. Gunners claim cannons and consume ammo. Medics prioritize critical allies. Repairers restore reachable damaged stations/structure using parts. A specialist should have a measurable advantage at its role without making the task impossible for all others.

Enemy templates differ in composition and behavior: ranged-heavy defenders, aggressive boarders, and protected gunners. The boss combines a clear mechanic with telegraphed counterplay rather than only multiplying health.

## Retreat and failure

Retreat orders return selected survivors home through valid access. Encounter escape becomes available after the home crew is accounted for; abandoned crew require an explicit confirmation in game with names and consequences. Captain death ends the run attempt and offers the pre-encounter checkpoint in standard mode.

Victory is resolved once the required hostile actors/objectives are defeated. Loot is calculated once and applied through an idempotent resolution transaction. Ship capture is delivered in v0.2 after survivors return home; surrender and negotiation remain deferred.

## Acceptance scenarios

- Pause freezes cooldowns, damage, movement, and needs.
- Ranged attacks cannot hit through blocking structure.
- Cannon use spends ammo once per shot and requires an eligible operator.
- Retreat never removes a still-active pirate silently.
- Death and loot events cannot execute twice on reload or repeated input.
- At least two crew compositions produce visibly different tactical behavior.

## Tick consistency and capacity

Resolve damage/death from a stable current-tick effect list; defer entity-table removal until iteration finishes. Selection/task/path indexes must observe the same committed death state. Initial hits resolve on ticks; projectile visuals do not determine outcomes. Summons count toward the actor cap.

Critical outcome events cannot be dropped to improve FPS. Unexpected overflow faults and pauses processing without saving a partial tick. Cosmetic particles/notifications may coalesce or drop under the [performance contract](performance-and-lifecycle.md). Resolution persists a compact encounter outcome, never the full defeated scene.

## Version 0.2 implementation

Combat now enters an unsafe `aftermath` phase after hostile crew defeat or hull disablement. No rewards or cleared flag are applied yet. Living allies must return to ship 1 before `finishEncounter` applies gold/supplies/experience once and removes encounter objects. An intact ship can instead replace the home hull and stations; destroyed hulls and islands cannot be captured. Home sinking or captain death ends the attempt and preserves the departure checkpoint.

Cannoneers path to the station and complete 40 work ticks before consuming ammunition. Hull damage is aggregate, not per-block destruction. Enemy broadsides require a living, unengaged defender. Weapon choice controls range, cooldown, and damage; armor mitigates damage with a minimum of one. Island encounters require reaching the chest after guards fall, then returning the crew and taking spoils. Exact rates are authored balance, not verified original formulas.
