# Crew, tasks, and commands

## Pirate model

Stable ID, name, role, traits, health, injury, hunger, morale, experience, skills, equipment, job priorities, current command, and movement state. Current attributes: STR, VIT, INT, DEX, AGI and LUCK with bounded earned points. Exact Steam progression curves and skill ranks remain unmeasured or deferred.

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

## Version 0.2 implementation

Each living ally has one assigned duty and a bounded learned-skill list. Books cost 60 gold in port. Player commands interrupt duty work; reassignment clears pending orders and resumes work. Claims use ship/duty keys; a galley, medical station, or cannon has one worker, and cleaning/repair have one slot each. Work is deterministic and slower below 30 morale. Cooking converts one raw provision into two meals; timber repairs 12 hull health; medicine restores 25 health; cleaning reduces deck dirt. Routine work runs in port and during travel, but port time does not reduce needs.

Pirates retain up to three owned weapons and can switch freely among bought weapons at port. Armor has two purchases up to eight protection. These are authored lightweight loadouts, not the original full inventory. Automatic critical retreat and the planned emergency-priority scheduler remain unimplemented.

## Version 0.3 upkeep and traits

A taught Fisher uses the reachable port-side rail, reserving one ship/duty slot. A catch takes 160 work ticks and adds one raw provision for the galley. Fishing stops at six raw provisions per living ally (inventory hard cap 999). Direct orders discard unfinished catch progress. Fishing and cooking can run concurrently; neither creates meals without the other resource step. All timing and reserve values are authored balance.

New recruits have one previewed trait: Swift (20% movement increase), Industrious (25% work increase), Hearty (one hunger point per needs interval), or Gourmand (three). Ordinary hunger costs two. Effects use simulation ticks; low morale still halves work speed. Existing crew and migrated saves have neutral traits. Trait arrays allow at most two unique known values; opposing food traits are rejected. This is an original small catalogue, not a verified original-game trait list.

Work-site selection uses graph-owned connected-component labels, built once with navigation. Finding a reachable repair/rail site scans the bounded graph without allocating a new path search or keeping extra world caches.

## Version 0.9 sea safety

Swimming is a passive skill purchased in port; it does not occupy a duty slot. The learned-skill cap is eight, including the seven existing duties. Overboard pirates cannot accept ordinary orders or work/fight remotely. Rescue selects a living home crewmate and claims one overboard ally; path failure, a replacement order or death releases the line. During a crossing, new orders are rejected with feedback until landing. [Sea rules](../design/sea-traversal.md).

## Targeted consumables, 0.11.0

Hold use selects one living allied recipient and rejects unsafe sea/fall/transit states. Rum restores morale, Elixir health, bone meal hunger and a feather XP, all clamped. Full-stat/max-level use keeps the item. XP awards cross every earned threshold, bounded by level 100/stat caps. Recovered weapons transfer one shared stock item to one personal locker; switching an owned weapon does not consume another. Simultaneous melee/ranged/accessory slots remain deferred. [Authored values and tests](../design/loot-and-seeded-world.md).

## Carried accessories, 0.12.0

One optional accessory derives effects from its equipped enum, so repeated equip/stow cannot stack bonuses. Boots of Mobility multiply deck/ladder path speed by 1.25, combining with Swift; sea/rope/rescue speed is unchanged. Diaper excludes that living supported home wearer from the hundred-tick dirt contribution. Dead, falling, at-sea and away-vessel pirates add no home dirt. Port-only gear changes are saved atomically and retain individual personal ownership. [Authored values and save rules](../design/crew-loadouts.md).

## Version 0.13.0 attributes and groups

Six bounded STR/VIT/INT/DEX/AGI/LUCK attributes, earned point budgets and four persistent groups follow the [progression contract](../design/crew-progression.md). Training and group assignment require living allies in port; both use atomic checkpoint writes. Group selection filters living members, preserves explicit empty groups and copies IDs into the existing command queue. Direct orders retain existing task interruption; changing group alone preserves duty/orders. Exact Steam formulas, ranked skills and reference point rates remain unmeasured or deferred.
