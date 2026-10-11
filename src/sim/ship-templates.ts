import { Ship, Tile, WorldNode, starterShip } from "./model";

export type FleetHull = "cutter" | "sloop" | "brig" | "flagship";

/** Only reads persisted encounter data; does not consume the campaign RNG. */
export function fleetHull(
  node: Pick<WorldNode, "danger" | "kind" | "seed">,
): FleetHull {
  if (node.danger <= 1) return "cutter";
  if (node.kind === "boss" && node.danger >= 3) return "flagship";
  return (node.seed >>> 0) % 2 === 0 ? "sloop" : "brig";
}

/** Fixed bounded templates, built once on arrival and then owned by the encounter. */
export function encounterShip(
  node: Pick<WorldNode, "danger" | "kind" | "seed" | "name">,
): Ship {
  const ship = starterShip(2, true);
  ship.name = node.name;
  ship.hp = ship.maxHp = 100 + (node.danger - 1) * 20;
  const hull = fleetHull(node);
  if (hull === "cutter") return ship;
  const width = hull === "flagship" ? 24 : 20 + Math.min(2, node.danger - 2);
  const tiles: Tile[] = [];
  const row = (y: number, start: number, end: number, shaft = false) => {
    for (let x = start; x < end; x++)
      if (!shaft || x !== 5) tiles.push({ x, y, kind: "hull" });
  };
  row(1, 0, hull === "flagship" ? 17 : 13, true);
  row(4, 0, width, hull !== "sloop");
  if (hull === "sloop") {
    row(5, 2, width - 2);
    row(6, 4, width - 4);
  } else {
    row(7, 0, width);
    row(8, 2, width - 2);
    ship.furnishings.push(
      { x: 1, y: 6, kind: "bunk" },
      { x: 8, y: 6, kind: "bunk" },
      { x: 12, y: 6, kind: "lantern" },
    );
  }
  for (let y = 1; y <= (hull === "sloop" ? 3 : 6); y++)
    tiles.push({ x: 5, y, kind: "ladder" });
  if (hull === "flagship") {
    // A raised forecastle has its own exterior ladder at the room's edge.
    row(1, 20, 24);
    for (let y = 1; y <= 3; y++) tiles.push({ x: 19, y, kind: "ladder" });
  }
  ship.tiles = tiles;
  ship.stations[0] = {
    x: width - 4,
    y: hull === "sloop" ? 3 : 6,
    kind: "cannon",
  };
  return ship;
}
