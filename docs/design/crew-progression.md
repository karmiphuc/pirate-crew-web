# Crew attributes and command groups

Version 0.13.0 contract, 2026-10-11. Target: the **current Steam release**, as selected by the user. This increment implements additional reference categories; it does not establish full parity.

## Evidence and limits

The [505 Games manual](https://dlassets-ssl.xboxlive.com/public/content/e5a27a6c-f320-4b3f-8751-42ff7ea5f4b0/GameManual/d9df5d6f-349d-4104-a19d-6c83c0fdc8d3/en-US/index.html) describes earned character points, attributes and crew groups. The [2014 community guide](https://steamcommunity.com/sharedfiles/filedetails/?id=208987734) identifies STR, VIT, INT, DEX, AGI and LUCK and group orders. Its version and formulas are historical. Search-indexed [crew guidance](https://pixelpiracy.fandom.com/wiki/Your_Crew) and [old-stat guidance](https://pixelpiracy.fandom.com/wiki/Old_Stats) disagree on numerical effects. They inform categories, not verified current balance. A newer search result, “How to Arm your Crew & Understand Attacks” (guide 3345407633), was checked and excluded: it belongs to Horizon’s Gate, app 1224290, rather than Pixel Piracy, app 264140. Exact installed Steam build, point gains, stat curves, attack rules and group count remain unmeasured.

## Authored progression

Six explicit numeric attributes start at zero, each capped at 100. New allies receive four initial points; each subsequently earned level grants four more. The existing cumulative XP thresholds, +2 base damage and +8 maximum health per level remain. The spendable pool caps at 400, and saves reject total spent plus unspent points above four times the pirate’s level. Training costs one point, requires a living ally in port, and does not spend gold. Books and paid weapon training remain separate systems; skill ranks are still deferred.

| Attribute | Current browser effect |
| --- | --- |
| STR | +1 melee damage per point |
| VIT | +4 maximum and current health per point, preserving missing health; maximum health remains capped at 1,000 |
| INT | +1% awarded XP per point, rounded down once per award |
| DEX | +1 ranged damage per point |
| AGI | +1% attack rate per point; interval is `ceil(base ticks × 100 / (100 + AGI))` |
| LUCK | +0.5% critical chance per point; critical hits multiply pre-armor damage by 1.5, rounded down |

Strength and Dexterity derive from the base damage and active weapon; they never inflate the saved base or stack after reload. Agility affects attack intervals, rather than deck speed, and is quantized to the existing 20 Hz simulation. The renderer uses that same interval to keep the attack and foreground fingers registered. Luck consumes an extra seeded roll only for an actual attack with positive Luck. Zero Luck keeps the old RNG sequence; blocked shots consume neither damage nor critical rolls. Accuracy, dodge, knockback, separate weapon reloads, handgun ammunition and full reference stat interactions remain gaps. No unbounded critical effects, particles or event history are retained.

## Groups and selection

Four persistent groups use numeric labels and restrained flag colors. New starters place captain/boarders in group 1, the cannoneer in group 2 and the cook in group 3. Reassignment changes neither duties nor queued orders. Assignments are port transactions; successful reassignment keeps the inspected pirate individually selected so the inspector stays usable when their old group empties. Failed writes restore the whole checkpoint and prior selection mode. Dialog Space activation keeps native summary/button behavior; outside dialogs/refits Space retains tactical pause. Group controls beneath the ship select living allies; shortcuts 1–4 work outside management/refit/input fields, with Q selecting all. Individual or Shift-canvas selections leave group mode. Active group selection follows living membership. Empty groups remain empty and display guidance; movement/boarding cannot fall back to the captain. The existing command queue copies selected IDs so subsequent selection changes do not rewrite queued orders. Cannon firing and ship-wide services retain their existing global controls.

The inspector presents a collapsible “Attributes & crew group” panel above carried gear, preserving immediate access to equipment. Its summary exposes unspent points; training keeps the panel open. Attribute cards show names, actual values, exact effects and labeled one-point controls. Groups show numeric labels and pressed state in addition to color. The six cards use two columns on desktop and one on a narrow viewport. The accepted crew art, weapon layers, native size and cabin headroom are unchanged.

## Persistence and lifetime

Schema 9 explicitly stores six attributes, the point counter and one group enum. Immutable schema-8 migration sets zero attributes/points and group 1, preserves prior health, damage, XP, map, stock, loadouts and owned gear, and grants no retroactive points. Schemas 1–7 continue through the existing migration chain. Malformed old slots/stock remain rejected. New envelopes reject missing/extra keys, fractional/out-of-range values, invalid groups and unearned budgets; sanitization copies fields without sharing mutable attribute objects.

There are no new textures, sprites, timers, listeners, pools or scene subscriptions. Attribute formulas run at attack/XP boundaries. Group scans are bounded by 24 actors and run only with the existing small UI projection, not by cloning the world each frame. A closed inspector retains no cards. Resource disposal remains owned by Application/Simulation/SeaScene.

## Validation

Unit tests exercise real attack damage/spacing/seeded criticals, multi-level XP and point awards, non-stacking reloads, preserved injuries, rejected unsafe training, actual member orders, copied selections, empty groups and immutable/malformed migration. `npm run test:progression:browser` checks visible transactions, injected write failures, earned points from a purchased feather, reload, modal hotkey guards, empty groups, actual canvas movement, forty group changes, ten scene restarts and final disposal.

208 unit scenarios pass, including 22 new progression scenarios. The focused browser run passes three injected training/group write failures, four attribute spends, a purchased Feather’s real 101 XP and twelve earned points, reload, active-group rollback, modal shortcut guards, native keyboard activation of the attribute summary and training button, actual group-selected canvas movement, forty group changes, ten restarts, schema-eight import/reload and disposal. Faster critical shots use an 11-tick pistol interval and the actual attack frame in both directions, with body/item/finger flip states matching. Textures remain ten, scene subscriptions four, original source images zero; final actor/item/grip counts match three living crew. [Focused evidence](../progression-focus-v13-results.json).

Reviewed unretouched captures: [desktop attribute panel](../images/progression-desktop.webp), [phone inspector](../images/progression-phone.webp), [phone groups and equipment](../images/progression-phone-groups.webp), [crew roster and group controls](../images/progression-groups.webp). The narrow inspector scrolls within its existing modal, with no page/card horizontal overflow. Phone captures are viewports at two scroll positions, avoiding a misleading screenshot of an element taller than its scroll container. They are lossless encodings of actual browser output. Numeric group labels and pressed states do not rely on color alone; this is a targeted check, not a complete accessibility audit.

Current Steam equivalence and hardware/browser-matrix performance remain unverified.

[Fleet/hosting regression evidence](../progression-regression-results.json) includes seventeen native-size actors with minimum 26-pixel cabin clearance, both directions, ladders, panned selection/movement, boarding, capture/reload and lower cannon access. Those functional harnesses overlapped; their redraw timing is not an isolated frame benchmark. Root and repository-path production smoke checks pass. Dependency audit reports zero vulnerabilities.

The isolated final full browser run passes expedition, skill/equipment trades, damage/repair, fishing/galley, island return, plunder/capture/reload, exclusive saves, quota rollback, art failure/reload, context loss, audio and complete disposal. Fifty rendered encounters, one hundred panel cycles and ten restarts retain 75 listeners and ten textures; diagnostic-GC JS heap changes from 10,567,456 to 9,823,988 bytes. Scoped frame p95 is 40 ms, tick p95 0.1 ms and stalls zero in Chromium SwiftShader at 1440 × 1080. A no-living-crew case shows explicit selection guidance. [Final full report](../progression-lifecycle-results.json). This does not prove hardware 60 FPS, a 30-minute ordinary-GC soak, retained-object/GPU analysis or broad browser coverage.

Version 0.14.0 adds [book stock, skill ranks and earned work XP](skill-books.md); its schema-ten budget includes lifetime book spends. The evidence above describes the archived version-0.13.0 run.
