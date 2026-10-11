# Owned cabin furnishings

Version 0.10.0, 2026-10-11. Original pixel fittings and a bounded construction inventory added to the modular cabin renderer.

## Reference and scope

The [community Ship Parts catalogue](https://pixelpiracy.fandom.com/wiki/Ship_Parts) lists lamps, wooden tables and purchased/recovered ship parts. The [historical Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=208987734) lists decorative beds/pillows. These sources establish content categories; they do not verify current-build prices, light effects or crew behavior. The browser artwork, prices, footprints and inventory rules are authored here.

Bunks, mess tables and brass lanterns are decorative. They do not block crew movement, provide healing/morale bonuses or implement sleeping/lighting simulation. Interactive furnishings, the broader original catalogue and non-construction item drops remain gaps.

## Player flow and reviewed runtime

1. **Starter cabins — furnished.** New campaigns and newly spawned enemy vessels include a bunk, table and lantern. Bedding, a tabletop chart/cup and brass glass/pole use the same integer pixels and timber palette as the vessel, behind existing crew/item/finger layers.

![New starter interior](../images/furnished-starter.webp)

2. **Harbour market — owned stock.** Buy individual pieces: bunk 35 gold, table 25, lantern 15. Sell owned stock for half the purchase price rounded down. Each kind has a stock cap of 64. Full stock rejects purchases and returning removed pieces; selling frees room. Sales reject empty stock, non-port phases and overflow of gold storage. Save failure rolls purchases/sales back through the existing checkpoint transaction.

3. **Ship builder — placement and return.** Select a fitting and click its floor cell. Bunk/table span two floor cells; lantern spans one. Clicking either cell of an existing piece removes it from the draft and returns its planned stock. The toolbar previews remaining stock without mutating campaign inventory. A ship has at most 32 placed pieces. Every footprint must have an intended floor, a reachable standing cell and no overlap with another fitting or station. Fittings do not add collision nodes. Invalid drafts remain editable with a reason; cancel does not spend stock/timber. Apply validates and commits hull, stations, furnishings and inventory together. Failed storage restores the campaign and keeps the editable draft for retry.

![Runtime extended-cabin refit](../images/furnished-refit.webp)

4. **Damage, plunder and capture — bounded ownership.** Unsupported runtime props hide until their floors are repaired, retaining the intended piece in the blueprint. The builder marks unsupported props with a red floor line so they can be corrected or removed. Plunder recovers supported enemy fittings once; full stacks sell that salvage at the stated half price with a notice. Capture transfers placed pieces as independent plain records without also awarding them to stock. Escape/island rewards do not grant ship furniture.

5. **Compact builder and teardown — checked with limits.** The toolbar wraps at desktop/intermediate widths and moves beneath the canvas on narrow screens, preserving an unobscured deck. Phone artwork/target scale remains a camera/input limitation. [Compact capture](../images/furnishing-builder-phone.webp). Ten scene restarts keep ten textures, the same actor/item/grip counts and four scene subscriptions. Disposal releases the active draft lists, their scene references and existing Graphics owner. No furniture sprites, textures, timers, particles or global view caches are added.

## State and bounds

Schema 6 adds a three-key stock record and bounded furniture records `{kind,x,y}` to the ship. Schema 1–5 migration is immutable: earlier saves receive empty stock/placements and preserve their existing hull/map. Existing ships are not silently furnished or expanded. Validation checks exact stock keys, finite bounded integer counts, enums, footprints, support, station overlap and reachability against intended blueprint geometry. Runtime wear can hide a fitting; safe saves preserve its intended location. Serialization sanitizes plain records and copies stock/placements independently.

Refit computes per-kind counts before changing any authoritative field. Moving an owned piece is free. New placements consume owned stock; removals return stock once. Validation or insufficient timber/stock leaves the hull, fittings and inventory unchanged. Bounded salvage applies before encounter disposal and uses the existing resolved/world flags against repeated reward.

## Validation

136 unit/navigation/storage/lifecycle scenarios include malformed stock/footprints, over-cap lists, inventory/refit atomicity, sale limits, immutable legacy migration/snapshots, damage, capture/plunder/no duplicate reward, explicit overflow salvage sales, and fifty remove/place cycles with one graph. The focused browser harness checks visible purchases/sale, purchase/refit quota rollback, invalid floor rejection, draft cancellation, application/reload, removal-to-stock, ten scene restarts, wrapping at 1000/390 pixels and delayed Phaser disposal with active drafts.

The full browser expedition/lifecycle stress, sea movement, ship refit and root/project-path production hosting checks also pass. [Focused results](../furniture-validation-results.json), [ship checks](../ship-validation-results.json), [sea checks](../sea-validation-results.json), and [main measured sample](../validation-results.json). The full stress sample precedes the final sale control, narrow builder placement and draft-disposal release; the final unit/focused harness and production checks cover those edits. Accelerated fixtures and diagnostic forced GC are scoped evidence, not a real-device frame-rate guarantee or ordinary-GC soak.
