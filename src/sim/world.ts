import type { WorldNode } from "./model";

export const WORLD_GENERATOR_VERSION = 1;
export const WORLD_NODE_COUNT = 18;

/** One bounded region. No global RNG, retry loop or instantiated encounters. */
export function generateWorld(inputSeed: number): WorldNode[] {
  let rng = inputSeed >>> 0 || 1;
  const next = () => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return rng >>> 0;
  };
  const slots = Array.from({ length: 18 }, (_, i) => ({
    column: i % 6,
    row: Math.floor(i / 6),
  }));
  const world: WorldNode[] = [];
  const add = (
    id: number,
    name: string,
    kind: WorldNode["kind"],
    danger: number,
    column?: number,
    row?: number,
  ) => {
    const candidates = slots.filter(
      (slot) =>
        column === undefined || (slot.column === column && slot.row === row),
    );
    const slot = candidates[next() % candidates.length];
    slots.splice(slots.indexOf(slot), 1);
    world.push({
      id,
      name,
      kind,
      danger,
      cleared: false,
      seed: next(),
      x: 10 + slot.column * 16 + (next() % 5) - 2,
      y: 20 + slot.row * 29 + (next() % 7) - 3,
    });
  };
  add(0, "Saltwater Harbour", "port", 0, 0, 2);
  add(1, "The Crooked Cutlass", "pirate", 1, 1, 2);
  add(2, "Castaway Cay", "island", 1, 1, 1);
  add(6, "Admiral Blackthorn", "boss", 4, 5, 1);
  add(7, "Captain Ashwake", "boss", 2, 2, 0);
  add(8, "Lady Ironwake", "boss", 3, 4, 0);
  add(9, "Dread Commodore", "boss", 3, 5, 2);
  add(3, "Ratbeard’s Revenge", "pirate", 2);
  add(4, "Whispering Shoals", "island", 2);
  add(5, "The Scarlet Fleet", "pirate", 3);
  const islandNames = [
    "Amber Atoll",
    "Shellback Isle",
    "Gull’s Refuge",
    "Coconut Reach",
  ];
  const pirateNames = [
    "The Rusted Hook",
    "Moonlit Marauders",
    "The Brine Wolves",
    "The Golden Fang",
  ];
  for (let i = 0; i < 8; i++) {
    const kind = i % 2 === 0 ? "island" : "pirate",
      name = (kind === "island" ? islandNames : pirateNames)[Math.floor(i / 2)];
    add(10 + i, name, kind, 1 + (next() % 3));
  }
  return world.sort((a, b) => a.id - b.id);
}
