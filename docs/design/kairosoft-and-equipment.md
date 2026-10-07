# Compact pixel crew and independent equipment

Version 0.7.0, 2026-10-07.

## Reference study

Inspected three official screenshots from Kairosoft’s [High Sea Saga DX Steam listing](https://store.steampowered.com/app/2431880/High_Sea_Saga_DX/): harbour, ship interior, and creature-management scenes. Observed compact faces, distinct hair/clothing outlines, and small shading clusters that remain readable at game scale. These are visual observations, not specifications of Kairosoft’s rendering or equipment implementation.

Our interpretation uses smaller eye marks, an indigo/brown outline that separates crew from teal scenery, collar/sleeve highlights, clothing shadows, and dark boot soles. Rounded stepped faces, readable costumes, native-scale sprites, hard pixel edges, and restrained walk/blink animation remain. The side-view camera remains appropriate to our ship navigation. No Kairosoft screenshot pixels, sprites, or code are included or traced.

## Body and item separation

![Six unarmed body variants followed by one captain with three equipment overlays](../images/crew-equipment.png)

The first six figures show original body art without equipment. The last three use the same captain body with cutlass, sabre, and pistol overlays. This preview is enlarged from the running game’s textures without smoothing.

Weapons are no longer baked into role artwork. Four body atlases contain only characters. One shared 96 × 40 equipment atlas contains three named 32 × 40 frames. The renderer selects the item from the authoritative pirate `weapon` field; the role does not select it. Body and equipment have separate sprite objects, share position/facing, and apply the same one-pixel walking offset. Roster portraits use the same independent texture layer and equipped item.

The existing purchase/equip commands, combat rules, owned-item checks, and saves are unchanged. This change does not introduce an unequip command; source bodies are unarmed, while game characters display their equipped item.

## Ownership and validation

The application texture manager owns the shared atlas: 15 KiB of additional decoded RGBA pixels, nine total Phaser textures. Each scene owns exactly one item view per living pirate, bounded by the existing twelve allied and twelve enemy crew limits. Death, stale-actor removal, scene shutdown, and disposal release item views; shutdown also removes its portrait CSS variable. No new animation timer, per-actor texture, or item cache is created.

Browser checks switch one character through all three weapons, verify the body/item object identities are retained, validate positioning and facing, and check the sabre portrait after a real equipment command. Hard-edge source checks, repeated scene activation and fifty rendered encounters cover atlas reuse and cleanup. Application disposal must leave both actor and equipment maps empty. Current measurements are recorded in [implementation status](../implementation-status.md) and [the machine-readable report](../validation-results.json).
