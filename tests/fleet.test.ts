import { describe, expect, it } from "vitest";
import { createCampaign, tileNode } from "../src/sim/model";
import { encounterShip, fleetHull } from "../src/sim/ship-templates";
import { Navigation, validateLayout } from "../src/sim/navigation";
import { validateFurniture } from "../src/sim/furniture";
import { Simulation } from "../src/sim/engine";
import { checkpoint, validateSave } from "../src/storage/save";
import { cabinSpans, drawPixelShip } from "../src/game/ship-art";
import {
  SHIP_CELL_HEIGHT,
  SHIP_CELL_WIDTH,
  SHIP_ORIGIN_Y,
  CABIN_CEILING_DEPTH,
  MIN_CABIN_HEADROOM,
  cabinJumpHeight,
} from "../src/game/ship-metrics";
import { PIRATE_HEIGHT } from "../src/game/pirate-art";

const step = (sim: Simulation, ticks: number) => {
  for (let i = 0; i < ticks; i++) sim.tick();
};

describe("encounter fleet architecture", () => {
  it("all authored cabins leave headroom for the entire crew frame, including hats", () => {
    const state = createCampaign();
    const ships = [
      state.ships[0],
      ...state.world
        .filter((n) => n.kind === "pirate" || n.kind === "boss")
        .map(encounterShip),
    ];
    for (const ship of ships)
      for (const room of cabinSpans(ship.tiles))
        expect(
          (room.floorY - room.roofY) * SHIP_CELL_HEIGHT -
            CABIN_CEILING_DEPTH -
            PIRATE_HEIGHT,
        ).toBeGreaterThanOrEqual(MIN_CABIN_HEADROOM);
  });
  it("keeps jumping hats below cabin beams while open roofs retain an arc", () => {
    const ship = createCampaign().ships[0];
    expect(cabinJumpHeight(ship.tiles, 3, 4)).toBe(12);
    expect(
      cabinJumpHeight([...ship.tiles, { x: 3, y: 2, kind: "hull" }], 3, 4),
    ).toBe(0);
    expect(cabinJumpHeight(ship.tiles, 3, 1)).toBe(12);
    expect(
      cabinJumpHeight(
        ship.tiles.map((t) => ({ ...t, damage: 100 })),
        3,
        4,
      ),
    ).toBe(12);
  });
  it("keeps the affordable first encounter and campaign RNG unchanged", () => {
    const state = createCampaign(),
      before = structuredClone(state);
    const ship = encounterShip(state.world[1]);
    expect(ship.tiles).toEqual(state.ships[0].tiles);
    expect(ship.furnishings).toEqual(state.ships[0].furnishings);
    expect(state).toEqual(before);
  });

  it("512 persisted seeds produce bounded, connected rooms, stations and spawn cells", () => {
    const kinds = new Set<string>();
    for (let seed = 0; seed < 512; seed++) {
      const node = {
        seed,
        danger: 2 + (seed % 3),
        kind: seed % 5 === 0 ? ("boss" as const) : ("pirate" as const),
        name: "Fleet fixture",
      };
      const ship = encounterShip(node),
        graph = new Navigation(ship),
        start = tileNode(3, 3);
      kinds.add(fleetHull(node));
      expect(validateLayout(ship, ship.tiles)).toBe(null);
      expect(
        validateFurniture(ship, ship.tiles, ship.stations, ship.furnishings),
      ).toBe(null);
      expect(ship.tiles.length).toBeLessThan(100);
      expect(Math.max(...ship.tiles.map((t) => t.x))).toBeLessThan(32);
      expect(Math.max(...ship.tiles.map((t) => t.y))).toBeLessThanOrEqual(8);
      for (const target of graph.nodes.keys())
        expect(graph.connected(start, target)).toBe(true);
      for (let i = 0; i < 5; i++)
        expect(graph.positionSupported(3 + i * 2, 3)).toBe(true);
      if (fleetHull(node) !== "sloop")
        expect(cabinSpans(ship.tiles).some((room) => room.floorY === 7)).toBe(
          true,
        );
    }
    expect([...kinds].sort()).toEqual(["brig", "flagship", "sloop"]);
  });

  it.each([
    { seed: 3, id: 3 },
    { seed: 2, id: 6 },
  ])(
    "boards, walks through the hold, retreats and captures a seeded vessel $id",
    ({ seed, id }) => {
      const state = createCampaign(),
        node = state.world[id];
      node.seed = seed;
      const sim = new Simulation(state);
      expect(sim.sail(id)).toBe(true);
      step(sim, 200);
      const prize = structuredClone(state.ships[1]);
      state.pirates
        .filter((p) => p.side === "enemy")
        .forEach((p) => (p.hp = 0));
      sim.tick();
      expect(state.phase).toBe("aftermath");
      sim.queue([3], { action: "board" });
      step(sim, 240);
      expect(state.pirates[0].shipId).toBe(2);
      sim.queue([3], { action: "move", shipId: 2, node: tileNode(16, 6) });
      step(sim, 300);
      expect([state.pirates[0].x, state.pirates[0].y]).toEqual([16, 6]);
      sim.queue([3], { action: "retreat" });
      step(sim, 350);
      expect(state.pirates[0].shipId).toBe(1);
      expect(sim.finishEncounter(true)).toBe(true);
      expect(state.ships[0].tiles).toEqual(prize.tiles);
      expect(state.ships[0].tiles).not.toBe(prize.tiles);
      expect(state.furnitureStock).toEqual({ bunk: 0, table: 0, lantern: 0 });
      const reloaded = validateSave(checkpoint(state));
      expect(reloaded.ships[0].furnishings).toEqual(prize.furnishings);
      expect(reloaded.ships[0].stations[0].y).toBe(6);
      expect(sim.graphCount).toBe(1);
      sim.dispose();
      expect(sim.graphCount).toBe(0);
    },
  );

  it("renders the largest ship with bounded integer commands and no persistent art state", () => {
    const ship = encounterShip(createCampaign().world[6]);
    let count = 0;
    const surface = {
      rect: (...values: number[]) => {
        count++;
        expect(values.every(Number.isInteger)).toBe(true);
        expect(values[2]).toBeGreaterThan(0);
        expect(values[3]).toBeGreaterThan(0);
      },
    };
    const before = structuredClone(ship);
    drawPixelShip(
      surface,
      ship,
      ship.tiles,
      ship.stations,
      998,
      SHIP_ORIGIN_Y,
      SHIP_CELL_WIDTH,
      false,
      ship.furnishings,
      SHIP_CELL_HEIGHT,
    );
    expect(count).toBeLessThan(12000);
    expect(ship).toEqual(before);
  });
});
