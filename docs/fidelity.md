# Fidelity tracker

Updated 2026-10-06 for version 0.3.0. This is a working comparison, not a claim of a verified 1:1 recreation. No Steam installation, original source, or extracted asset bundle is present in the workspace. Original build/version and exact formulas have not been measured. All sprites, scenery, names, sound effects, and balance shipped here are newly authored.

| Reference behavior | Delivered browser behavior | Remaining fidelity gap |
| --- | --- | --- |
| Build a ship from parts | Connected hull/ladder editor; relocate cannon/galley/clinic; validation and timber transaction | Full part catalogue, furnishings, sails, item placement, original editor/UI |
| Hire, equip and level crew | Recruitment, health/hunger/morale, XP/levels, owned cutlass/sabre/flintlock and armor; previewed recruits with four working traits | Original recruit selection, full trait/stats catalogue, original weapon/passive/consumable catalogue and item drops |
| Train cooking/cleaning/repair skills | Books, duties, exclusive station claims, real resources/work, fishing feeding the galley, visible status | Original skill ranks, scheduler priorities, swimming, sailing and other skills |
| Maintain hunger and morale | Cook raw provisions into meals; eat aboard; dirt lowers morale; wages on departure | Rum, toys, other food types, salary schedules and original balance |
| Sail and board enemy ships | Chart, supplies/wages, tactical pause, validated paths, group boarding/return | Physical ropes/jumps, falling/swimming, boarding squads, diverse enemy AI |
| Cannons and ship repairs | Operator reaches cannon, loads, spends ammo, damages hull/crew; timber repairs hull and individual worn planks; sinking fails attempt | Original accuracy/ammo rules, destroyed planks/gaps and combat navigation invalidation (worn planks currently retain support) |
| Plunder and capture | Separate aftermath; all survivors return; once-only rewards or replace home hull/stations | Physical explosion/sinking, loot objects and original capture economics; safer crew-return requirement is intentional |
| Explore islands | Walkable island terrain, guards, a chest requiring movement, safe return and supplies | Town residents, varied wildlife, encounters, terrain and quests |
| Defeat four notorious pirates | Four authored pirate lords; all must be cleared to win a new campaign | Exact original names, layouts, traits, world generation and boss behavior |
| Pixel animation and audio | Side-view pixel sprites with idle/walk frames, terrain, sails, hull cracks, rope, synthesized effects | Original sprite/animation catalogue, UI layout, palette, music and voices |
| Save a campaign | Validated IndexedDB checkpoints, previous backup, export/import, exclusive writer; v1/v2 migration to schema 3 | Original save formats and difficulty/permadeath modes |

The community documentation describes taught skills and ship upkeep, and distinguishes plunder from winning a fight. Those descriptions informed system behavior, not copied prices/formulas or text. Relevant references: [skills](https://pixelpiracy.fandom.com/wiki/Skills), [cooking](https://pixelpiracy.fandom.com/wiki/Cooking), [ship repair](https://pixelpiracy.fandom.com/wiki/Ship_Repair), [plunder](https://pixelpiracy.fandom.com/wiki/Plunder), [Steam game description](https://store.steampowered.com/app/264140/Pixel_Piracy/). Community pages may describe older versions.

The next dependency-sensitive work is destruction of worn planks and safe damaged access. Localized wear is delivered, but does not yet remove structural support. Terrain and original content coverage can then expand without bypassing navigation, persistence, or resource-lifetime tests. Measured evidence belongs in [implementation status](implementation-status.md).
