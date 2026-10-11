# Attribution and intended use

User direction recorded 2026-10-05: personal-use remake of Pixel Piracy, offered free for noncommercial use with proper attribution. This states project intent, not a third-party license or a conclusion that any particular reuse is permitted.

## Reference-game credit

Pixel Piracy is the reference game. Historical development is credited to Quadro Delta (Vitali Kirpu and Alexander Poysky), with Re-Logic associated with the original publishing; the current [Steam listing](https://store.steampowered.com/app/264140/Pixel_Piracy/) credits Vitali Kirpu. Our browser project is unofficial; no endorsement is claimed. Credit actual reused materials according to their specific terms rather than assuming all rights belong to one party.

## Asset/code register

| Material | Creator/source | License or permission | Changes | Required credit | Included? |
| --- | --- | --- | --- | --- | --- |
| Pixel Piracy game reference | Linked Steam page and research sources | Reference for design research; no game assets/code imported | Proposed robustness changes | Reference-game credit | Reference only |
| Kairosoft High Sea Saga DX visual reference | [Official Steam screenshots](https://store.steampowered.com/app/2431880/High_Sea_Saga_DX/), Kairosoft Co.,Ltd | Reference study only; no assets/code imported | [Observed proportions and shading](design/kairosoft-and-equipment.md) inform original art | Kairosoft reference credit | Reference only |
| Project documentation | Authored for this project | Distribution license undecided | See local commit history | To be decided | Yes |
| Procedural pixel art and scenery | Authored in `src/game/pirate-art.ts`, `src/game/equipment-art.ts`, `src/game/ship-art.ts` and `src/game/scene.ts` for this project | Project distribution license undecided | Original integer-raster character atlases, Integer-pixel character conversion and pose adaptations, independent equipped weapons, foreground fingers, character-specific sword/aim/recoil arms and combat frames, panelled cabin walls, decorative doors/windows, carved roof rails, pixel hulls/sails/station props, original bunks/table charts/cups/brass lanterns, palms, sand/rock shoreline, station props, chart, interpolated boarding ropes, rescue lines and submerged-actor presentation | Project credit | Yes |
| Crew source art | Generated for this project using OpenAI Image Gen, 2026-10-07 | Project distribution license undecided; no third-party image supplied | Unchanged original PNG; six regions converted at startup into hard-edge 38-colour cells and five animation states | Project credit; [source and adaptation](design/painted-pixel-crew.md) | Yes: `src/game/assets/crew-source.png` |
| Coastal backdrop | Generated for this project using OpenAI Image Gen, 2026-10-07 | Project distribution license undecided; no reference-game image supplied | Unaltered generated image encoded as WebP; open-sea frame cropped at runtime | Project credit; [generation brief](design/visual-review.md) | Yes: `src/game/assets/harbour.webp` |
| Phaser 3.90.0 | Phaser Studio / npm `phaser` | MIT; preserve package license when distributing | No vendor modifications | [Bundled license notices](../public/THIRD_PARTY_NOTICES.txt) | Yes |
| Synthesized sound effects | Generated in `src/app/sound.ts` for this project | Project distribution license undecided | Original oscillator envelopes, no sampled recordings | Project credit | Yes |
| Future audio/fonts/materials | Record individual origin | Record compatible license/permission before inclusion | Record modifications | Copy exact required credit | No external audio/font assets |

Prefer original or compatible licensed materials for the prototype. Preserve license notices alongside actual included assets and expose credits in-game when implemented. Final project licensing must distinguish our own material from third-party material.

Free/noncommercial use and attribution alone do not automatically establish permission for third-party content. Reference: [U.S. Copyright Office reuse FAQ](https://www.copyright.gov/help/faq/faq-fairuse.html). No legal determination of this specific remake is made here.

Version 0.10.1's sloop/brig/flagship blueprints in `src/sim/ship-templates.ts`, multi-mast rigging and repeated cabin windows are original project-authored geometry/art. [Fleet review](design/ship-fleet.md) distinguishes that interpretation from the reference screenshot and records browser screenshots generated from our own runnable game. No reference-game artwork or blueprints were imported.

Version 0.10.2 roomier doors, windows, fittings, mast/sail proportions and camera/facing code are newly authored from the existing original pixel renderer. No additional reference-game assets were imported. Roomier screenshots are unretouched browser captures encoded as lossless WebP; the accepted crew/background sources and their recorded provenance remain unchanged.

Version 0.11.0's consumable/gear icons in `src/ui/item-icons.ts` are original integer SVG drawings. The eighteen-location generator, island geometry, loot selection and prices/effects are project-authored. The 505 Games manual and community item descriptions are linked as category references in the [item/world review](design/loot-and-seeded-world.md), with conflicting and older-version evidence identified. No game assets or executable code were imported. New screenshots are unretouched captures encoded as lossless WebP.

Version 0.12.0 equipment-slot icons (cutlass, Boots of Mobility, Diaper), UI, geometry-based shot checks and slot/ownership/passive code are original project work. The linked manual/older community guide inform mechanic categories only; prices and adapted combat/dirt rules are explicitly authored. Crew/background asset sources are unchanged. No third-party sprites, source or screenshots are included in the build.

Version 0.13.0 attributes, point budgets, seeded critical rules, group UI and migration are original project work. The manual and historically dated guides identify categories only; numerical rules are expressly authored and current Steam equivalence remains unmeasured. A misidentified newer guide was excluded after checking its game/app ID. Accepted crew/background assets and provenance remain unchanged; new UI screenshots are unretouched browser captures.

Version 0.14.0 integer-pixel book icons, skill stock/rank/point rules, work-XP balance, controls and rendered-body targeting are original project work. The developer’s March 31, 2023 Steam announcement confirms matching-book skill leveling; historical guides and a dated review inform learning costs/work-XP categories without establishing current balance. No original game code or assets were imported. New captures are unretouched browser output encoded as lossless WebP; accepted art provenance is unchanged. See the [source distinctions](design/skill-books.md).
