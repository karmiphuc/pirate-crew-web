# UX, controls, and assets

## Screens

Start/resume; port preparation; ship editor; crew/equipment panel; world map/travel preview; encounter; loot summary; settings. Keep phase transitions apparent. A compact HUD shows gold, food, ammo, morale warnings, selected crew, and pause state.

## Desktop controls

Left click selects or activates; drag selects multiple crew; right click issues a contextual order; Shift queues orders; Space pauses/resumes; Escape closes a panel or opens pause settings. Offer visible buttons for essential actions and document shortcuts. UI clicks must not pass through to the game world.

## Feedback and accessibility

Show selection outlines, destinations, current tasks, unreachable markers, health, and group order results. Hovering a station explains required resources and worker eligibility. Do not encode danger or status only through color. DOM menus support keyboard focus and readable text scaling. Reduce motion disables screen shake and intense flashes. Separate music/effects controls.

These are MVP accessibility requirements; full nonvisual gameplay support is not claimed.

## First expedition tutorial

Guide recruitment, supplies, a valid ship edit, route preview, pause, boarding, retreat, loot, return, and saving. Advance from demonstrated actions, not only dismissed text. Permit replay and skip. First encounter avoids hidden lethal prerequisites.

## Art and audio inventory

Original or suitably licensed modular pirate body/outfit sprites; idle/walk/attack/hurt/death animations; hull/deck/ladder/sail parts; station sprites; melee/ranged weapons; port and island tiles; sea/background layers; status/action icons; restrained combat effects; interface sounds; sea ambience and original/licensed music.

Use one coherent grid and sprite scale, validated in the first visual prototype. Render sprites with nearest-neighbor sampling and integer-aligned camera positions. UI typography should remain legible rather than enforcing tiny pixel text everywhere.

Maintain asset provenance with creator, source, license, modifications, and attribution requirements. Record applicable reuse permission before using reference-game assets; remake intent does not itself supply an asset license. Maintain [attribution](../attribution.md). Placeholder art is acceptable for the first slice and must be identified as such.

## Acceptance scenarios

- All essential actions are discoverable through visible controls.
- Failed commands explain the relevant remedy.
- UI input never accidentally issues world orders.
- Tutorial can be completed without prior Pixel Piracy knowledge.
- Muting and reduced-motion settings persist across reloads.

## Rendering and teardown requirements

Use dirty DOM updates and bounded notifications rather than rebuilding management panels every frame. Panel close releases external listeners, observers, timers, and view bindings. Atlas ownership is application-wide; encounter views do not delete shared assets. Profile decoded image/audio memory and canvas backing scale. Context loss and failed asset loads have explicit recovery UI. See [performance contract](performance-and-lifecycle.md).
