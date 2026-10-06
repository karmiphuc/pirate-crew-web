# Crew, tasks, and commands

## Pirate model

Stable ID, name, role, traits, health, injury, hunger, morale, experience, skills, equipment, job priorities, current command, and movement state. Initial attributes: vitality, melee proficiency, ranged proficiency, and work proficiency. Numeric ranges and progression curves are provisional.

Recruit cards expose cost, role, key skill, and relevant traits before purchase. Recruiting spends gold exactly once, checks the crew cap, and places the recruit safely aboard or in the port roster.

## Command contract

A command contains sequence number, issuer, selected pirate IDs, action, target, and queue/replace behavior. Validate phase, ownership, life state, target existence, and basic feasibility. Acknowledgement is immediate; later failure remains possible if the world changes.

Each selected pirate receives accepted, queued, rejected, completed, or interrupted status. Display specific reasons such as blocked access, missing ammunition, invalid target, or critical injury. Group results may be partial and must identify affected pirates.

Player orders interrupt routine tasks. Queued orders execute in order. On target death, attack completes rather than retargeting silently; an explicit aggressive stance can later enable automatic retargeting.

## Task scheduling

Shared task board for cooking, repair, healing, cannon operation, and collection. Eligible workers claim tasks using emergency priority, explicit order, job preference, skill, then travel cost. One claim per task slot; release on completion, cancellation, death, or unreachable target.

Idle actors may perform routine work regardless of combat squad label. Reevaluate when state changes, not by rebuilding all assignments every render frame. Use stable tie-breaking and hysteresis to avoid task switching every tick.

## Needs

Hunger rises during active simulation; food reduces it. Port resupply consumes gold rather than granting unlimited free supplies. Low morale reduces work effectiveness; unpaid wages warn before penalties. MVP has no autonomous mutiny that reverses player control.

Critical injury triggers retreat unless hold-position was deliberately selected. This interruption emits a visible reason. Healing requires medical resources and a reachable station or medic. Exact rates belong in content data after balancing.

## Acceptance scenarios

- Missing ladder yields a reachability message, not an idle actor with an active order.
- Two workers cannot consume the same food or repair resource.
- Explicit attack supersedes cooking/repair work and releases its task claim.
- Worker death does not leave a station permanently reserved.
- Group boarding reports accepted and failed members separately.
- A critical retreat override explains itself and can be inspected while paused.

## Scheduling and retention

Enforce bounded commands/tasks/notifications from [performance contract](performance-and-lifecycle.md). Replacing an order clears discarded target/path references. Task assignment uses dirty state with a bounded fallback; target selection starts with simple capped scans. Track pending path work separately from failures. Command previews while paused do not mutate authoritative state; queue validated intent for the next tick and revalidate then.

Store target IDs, not closures capturing full entities/scenes. Task completion/death removes all reverse indexes and claims at a deterministic tick boundary. Only bounded numeric diagnostic traces survive encounter disposal.
