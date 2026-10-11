import {
  Furniture,
  FURNISHINGS,
  FURNITURE_PLACED_CAP,
  Ship,
  Tile,
  Station,
  LIMITS,
  tileNode,
} from "./model";
import { Navigation, intact } from "./navigation";

export function furnitureSupported(tiles: readonly Tile[], item: Furniture) {
  if (!Object.hasOwn(FURNISHINGS, item.kind)) return false;
  for (let x = item.x; x < item.x + FURNISHINGS[item.kind].width; x++)
    if (
      !tiles.some(
        (t) =>
          t.kind === "hull" && t.x === x && t.y === item.y + 1 && intact(t),
      )
    )
      return false;
  return true;
}
/** Non-blocking props still require distinct, supported and reachable floor footprints. */
export function validateFurniture(
  ship: Ship,
  tiles: Tile[],
  stations: readonly Station[],
  items: readonly Furniture[],
  blueprint = false,
): string | null {
  if (!Array.isArray(items) || items.length > FURNITURE_PLACED_CAP)
    return "At most 32 furnishings fit aboard.";
  const actual = blueprint ? tiles.map((t) => ({ ...t, damage: 0 })) : tiles;
  const graph = new Navigation({ ...ship, tiles: actual });
  const base = graph.nearest(3, 3);
  const used = new Set(stations.map((s) => tileNode(s.x, s.y)));
  for (const item of items as readonly Furniture[]) {
    if (
      !item ||
      !Object.hasOwn(FURNISHINGS, item.kind) ||
      !Number.isInteger(item.x) ||
      !Number.isInteger(item.y) ||
      item.x < 0 ||
      item.y < 0 ||
      item.y >= LIMITS.height ||
      item.x + FURNISHINGS[item.kind].width > LIMITS.width
    )
      return "Invalid furnishing or footprint outside the ship grid.";
    if (!furnitureSupported(actual, item))
      return "Furnishings need a surviving floor under their entire footprint.";
    for (let x = item.x; x < item.x + FURNISHINGS[item.kind].width; x++) {
      const node = tileNode(x, item.y);
      if (used.has(node)) return "Furnishings and stations cannot overlap.";
      if (!graph.connected(base, node))
        return "Furnishings need a reachable deck.";
      used.add(node);
    }
  }
  return null;
}
