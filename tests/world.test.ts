import { expect, it } from "vitest";
import { generateWorld, WORLD_NODE_COUNT } from "../src/sim/world";
import { createCampaign, islandTerrain, tileNode } from "../src/sim/model";
import { Simulation } from "../src/sim/engine";
import { Navigation } from "../src/sim/navigation";
import { checkpoint, validateSave } from "../src/storage/save";

it("1000 seeds generate distinct, bounded charts with an affordable starter and all four lords", () => {
  const shapes = new Set();
  for (let seed = 1; seed <= 1000; seed++) {
    const world = generateWorld(seed);
    expect(world).toEqual(generateWorld(seed));
    expect(world).toHaveLength(WORLD_NODE_COUNT);
    expect(world.filter((n) => n.kind === "boss")).toHaveLength(4);
    expect(world.filter((n) => n.kind === "port")).toHaveLength(1);
    expect(world[0].kind).toBe("port");
    expect([world[1].kind, world[1].danger]).toEqual(["pirate", 1]);
    expect([world[2].kind, world[2].danger]).toEqual(["island", 1]);
    expect(new Set(world.map((n) => n.id)).size).toBe(WORLD_NODE_COUNT);
    expect(
      world.every(
        (n) =>
          n.id >= 0 &&
          n.id < 64 &&
          n.x >= 8 &&
          n.x <= 92 &&
          n.y >= 17 &&
          n.y <= 81,
      ),
      `chart bounds for seed ${seed}`,
    ).toBe(true);
    let minimumSeparation = Infinity;
    for (let i = 0; i < world.length; i++)
      for (let j = i + 1; j < world.length; j++)
        minimumSeparation = Math.min(
          minimumSeparation,
          Math.hypot(world[i].x - world[j].x, world[i].y - world[j].y),
        );
    expect(
      minimumSeparation,
      `node spacing for seed ${seed}`,
    ).toBeGreaterThanOrEqual(12);
    shapes.add(JSON.stringify(world.map((n) => [n.x, n.y, n.seed])));
  }
  expect(shapes.size).toBe(1000);
});

it("new campaigns use their seed without advancing authoritative RNG; checkpoints preserve their map", () => {
  const a = createCampaign(42),
    b = createCampaign(43);
  expect(a.world).toEqual(generateWorld(42));
  expect(a.rng).toBe(42);
  expect(a.world).not.toEqual(b.world);
  a.world[12].cleared = true;
  expect(validateSave(checkpoint(a)).world).toEqual(a.world);
  const old: any = checkpoint(a);
  old.schemaVersion = 6;
  old.world = old.world.slice(0, 10);
  delete old.itemStock;
  const original = structuredClone(old);
  expect(validateSave(old).world).toEqual(old.world);
  expect(old).toEqual(original);
});

it("seeded islands remain connected from rail to chest with all guard spawns supported", () => {
  const widths = new Set();
  for (let seed = 0; seed < 512; seed++) {
    const ship = islandTerrain("Fixture", seed),
      g = new Navigation(ship);
    widths.add(Math.max(...ship.tiles.map((t) => t.x)) + 1);
    expect(g.connected(tileNode(0, 3), tileNode(15, 3))).toBe(true);
    for (let i = 0; i < 4; i++)
      expect(g.positionSupported(9 + i * 2, 3)).toBe(true);
    expect(ship.tiles.length).toBeLessThan(100);
    expect(ship.tiles).toEqual(islandTerrain("Fixture", seed).tiles);
  }
  expect(widths.size).toBeGreaterThan(4);
});

it("every generated destination has a route and cleared extra encounters grant no repeat loot", () => {
  const s = createCampaign(42),
    sim = new Simulation(s);
  for (const node of s.world) {
    const cost = sim.routeCost(node.id)!;
    expect(cost.ticks).toBeLessThanOrEqual(300);
    expect(cost.wages).toBe(9);
    if (node.id === 1 || node.id === 2) {
      expect(cost.food).toBeLessThanOrEqual(s.food);
      expect(cost.wages).toBeLessThanOrEqual(s.gold);
    }
  }
  s.world[10].cleared = true;
  const inventory = structuredClone(s.itemStock);
  expect(sim.sail(10)).toBe(true);
  for (let i = 0; i < 200; i++) sim.tick();
  expect(s.phase).toBe("victory");
  expect(s.ships).toHaveLength(1);
  expect(sim.finishEncounter()).toBe(false);
  expect(s.itemStock).toEqual(inventory);
  sim.dispose();
  expect(sim.graphCount).toBe(0);
});
