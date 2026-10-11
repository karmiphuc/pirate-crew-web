import type { Tile } from "../sim/model";
import { PIRATE_HEIGHT, PIRATE_WIDTH } from "./pirate-art";

// A three-cell cabin needs a 56px actor, a 14px cornice and 8px of headroom.
// Horizontal cells stay narrow so the largest fleet hull still fits the camera.
export const SHIP_CELL_WIDTH = 18;
export const SHIP_CELL_HEIGHT = 26;
export const SHIP_ORIGIN_Y = 248;
export const CABIN_CEILING_DEPTH = 14;
export const MIN_CABIN_HEADROOM = 8;

/** Bound the decorative jump arc by the nearest beam over the actor's full width. */
export function cabinJumpHeight(
  tiles: readonly Tile[],
  x: number,
  feetRow: number,
) {
  let height = 12;
  for (const tile of tiles) {
    if (
      tile.kind !== "hull" ||
      (tile.damage ?? 0) >= 100 ||
      tile.y >= feetRow - 1 ||
      Math.abs(tile.x - x) > PIRATE_WIDTH / (2 * SHIP_CELL_WIDTH) + 0.5
    )
      continue;
    height = Math.min(
      height,
      (feetRow - tile.y) * SHIP_CELL_HEIGHT -
        CABIN_CEILING_DEPTH -
        PIRATE_HEIGHT -
        MIN_CABIN_HEADROOM,
    );
  }
  return Math.max(0, height);
}
