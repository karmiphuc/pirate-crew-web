# Attribution and intended use

User direction recorded 2026-10-05: personal-use remake of Pixel Piracy, offered free for noncommercial use with proper attribution. This states project intent, not a third-party license or a conclusion that any particular reuse is permitted.

## Reference-game credit

Pixel Piracy is the reference game. Historical development is credited to Quadro Delta (Vitali Kirpu and Alexander Poysky), with Re-Logic associated with the original publishing; the current [Steam listing](https://store.steampowered.com/app/264140/Pixel_Piracy/) credits Vitali Kirpu. Our browser project is unofficial; no endorsement is claimed. Credit actual reused materials according to their specific terms rather than assuming all rights belong to one party.

## Asset/code register

| Material | Creator/source | License or permission | Changes | Required credit | Included? |
| --- | --- | --- | --- | --- | --- |
| Pixel Piracy game reference | Linked Steam page and research sources | Reference for design research; no game assets/code imported | Proposed robustness changes | Reference-game credit | Reference only |
| Project documentation | Authored for this project | Distribution license undecided | See local commit history | To be decided | Yes |
| Procedural pixel art and scenery | Drawn in `src/game/pirate-art.ts` and `src/game/scene.ts` for this project | Project distribution license undecided | Original integer-raster character atlases, cute appearance variants and idle-blink frames, hulls, sails, palms, sand/rock shoreline, station props, chart | Project credit | Yes |
| Coastal backdrop | Generated for this project using OpenAI Image Gen, 2026-10-07 | Project distribution license undecided; no reference-game image supplied | Unaltered generated image encoded as WebP; open-sea frame cropped at runtime | Project credit; [generation brief](design/visual-review.md) | Yes: `src/game/assets/harbour.webp` |
| Phaser 3.90.0 | Phaser Studio / npm `phaser` | MIT; preserve package license when distributing | No vendor modifications | [Bundled license notices](../public/THIRD_PARTY_NOTICES.txt) | Yes |
| Synthesized sound effects | Generated in `src/app/sound.ts` for this project | Project distribution license undecided | Original oscillator envelopes, no sampled recordings | Project credit | Yes |
| Future audio/fonts/materials | Record individual origin | Record compatible license/permission before inclusion | Record modifications | Copy exact required credit | No external audio/font assets |

Prefer original or compatible licensed materials for the prototype. Preserve license notices alongside actual included assets and expose credits in-game when implemented. Final project licensing must distinguish our own material from third-party material.

Free/noncommercial use and attribution alone do not automatically establish permission for third-party content. Reference: [U.S. Copyright Office reuse FAQ](https://www.copyright.gov/help/faq/faq-fairuse.html). No legal determination of this specific remake is made here.
