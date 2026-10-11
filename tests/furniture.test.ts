import { describe, it, expect } from "vitest";
import { Simulation } from "../src/sim/engine";
import { createCampaign, Furniture, FURNITURE_KINDS } from "../src/sim/model";
import { checkpoint, validateSave } from "../src/storage/save";
import { furnitureSupported } from "../src/sim/furniture";

describe("owned cabin furnishing transactions", () => {
  it("sells owned stock so a full hold can receive a removed piece", () => {
    const sim = new Simulation(createCampaign()),
      s = sim.state,
      ship = s.ships[0];
    s.furnitureStock.bunk = 64;
    expect(sim.sellFurniture("bunk")).toBe(true);
    expect([s.furnitureStock.bunk, s.gold]).toEqual([63, 437]);
    expect(
      sim.edit(
        ship.tiles,
        ship.stations,
        ship.furnishings.filter((f) => f.kind !== "bunk"),
      ),
    ).toBe(null);
    expect(s.furnitureStock.bunk).toBe(64);
  });
  it("rejects sales with no owned stock, outside port, or at the gold cap", () => {
    const sim = new Simulation(createCampaign()),
      s = sim.state;
    expect(sim.sellFurniture("table")).toBe(false);
    s.furnitureStock.table = 1;
    s.phase = "travel";
    expect(sim.sellFurniture("table")).toBe(false);
    s.phase = "port";
    s.gold = 1_000_000_000;
    expect(sim.sellFurniture("table")).toBe(false);
    expect(s.furnitureStock.table).toBe(1);
  });
  it("rejects oversized furnishing collections before committing ownership", () => {
    const sim = new Simulation(createCampaign()),
      s = sim.state,
      ship = s.ships[0];
    const oversized = Array.from({ length: 33 }, () => ({
      x: 12,
      y: 3,
      kind: "lantern" as const,
    }));
    expect(sim.edit(ship.tiles, ship.stations, oversized)).toContain("32");
    expect(ship.furnishings.length).toBe(3);
    const malformed = structuredClone(s);
    malformed.ships[0].furnishings = oversized;
    expect(() => validateSave(malformed)).toThrow("32");
  });
  it("fifty remove/place cycles do not duplicate stock or retain old graphs", () => {
    const sim = new Simulation(createCampaign()),
      s = sim.state;
    for (let i = 0; i < 50; i++) {
      const ship = s.ships[0],
        items = ship.furnishings.map((f) => ({ ...f }));
      expect(sim.edit(ship.tiles, ship.stations, [])).toBe(null);
      expect(sim.edit(ship.tiles, ship.stations, items)).toBe(null);
      expect(s.furnitureStock).toEqual({ bunk: 0, table: 0, lantern: 0 });
      expect(sim.graphCount).toBe(1);
    }
    expect(checkpoint(s).ships[0].furnishings.length).toBe(3);
  });
  it("purchases one owned piece at port, rejecting full stock, low gold and unknown kinds", () => {
    const sim = new Simulation(createCampaign()),
      s = sim.state;
    expect(sim.buyFurniture("table")).toBe(true);
    expect([s.gold, s.furnitureStock.table]).toEqual([395, 1]);
    s.furnitureStock.table = 64;
    expect(sim.buyFurniture("table")).toBe(false);
    s.gold = 0;
    expect(sim.buyFurniture("bunk")).toBe(false);
    expect(sim.buyFurniture("__proto__" as any)).toBe(false);
    expect(s.furnitureStock.bunk).toBe(0);
  });
  it("does not purchase away from port or after disposal", () => {
    const sim = new Simulation(createCampaign());
    sim.state.phase = "travel";
    expect(sim.buyFurniture("bunk")).toBe(false);
    sim.state.phase = "port";
    sim.dispose();
    expect(sim.buyFurniture("bunk")).toBe(false);
  });
  it("moves owned furniture free and returns it once to stock on removal", () => {
    const sim = new Simulation(createCampaign()),
      ship = sim.state.ships[0];
    const moved = ship.furnishings.map((f) =>
      f.kind === "bunk" ? { ...f, x: 0, y: 0 } : f,
    );
    expect(sim.edit(ship.tiles, ship.stations, moved)).toBe(null);
    expect(sim.state.furnitureStock.bunk).toBe(0);
    const without = ship.furnishings.filter((f) => f.kind !== "bunk");
    expect(sim.edit(ship.tiles, ship.stations, without)).toBe(null);
    expect(sim.edit(ship.tiles, ship.stations, without)).toBe(null);
    expect(sim.state.furnitureStock.bunk).toBe(1);
    expect(
      sim.edit(ship.tiles, ship.stations, [
        ...without,
        { x: 0, y: 3, kind: "bunk" },
      ]),
    ).toBe(null);
    expect(sim.state.furnitureStock.bunk).toBe(0);
  });
  it("cannot place an unowned piece and does not spend timber before a furnishing failure", () => {
    const sim = new Simulation(createCampaign()),
      s = sim.state,
      ship = s.ships[0],
      before = structuredClone(ship);
    const tiles = [...ship.tiles, { x: 18, y: 4, kind: "hull" as const }];
    expect(
      sim.edit(tiles, ship.stations, [
        ...ship.furnishings,
        { x: 12, y: 3, kind: "lantern" },
      ]),
    ).toContain("Buy more");
    expect(s.parts).toBe(12);
    expect(ship).toEqual(before);
  });
  it.each([
    [{ x: 17, y: 3, kind: "table" }, "floor"],
    [{ x: 3, y: 3, kind: "lantern" }, "overlap"],
    [{ x: 5, y: 2, kind: "lantern" }, "floor"],
    [{ x: 63, y: 3, kind: "bunk" }, "outside"],
    [{ x: 1.5, y: 3, kind: "bunk" }, "Invalid"],
    [{ x: 1, y: 3, kind: "unknown" }, "Invalid"],
  ])("rejects unsafe footprint %j atomically", (item, reason) => {
    const sim = new Simulation(createCampaign()),
      s = sim.state,
      ship = s.ships[0];
    const before = structuredClone(s);
    s.furnitureStock = { bunk: 2, table: 2, lantern: 2 };
    expect(
      sim.edit(ship.tiles, ship.stations, [
        ...ship.furnishings,
        item as Furniture,
      ]),
    ).toContain(reason);
    expect(ship.tiles).toEqual(before.ships[0].tiles);
    expect(s.parts).toBe(before.parts);
    expect(s.furnitureStock).toEqual({ bunk: 2, table: 2, lantern: 2 });
  });
  it("does not silently discard a removed item when its hold stack is full", () => {
    const sim = new Simulation(createCampaign()),
      s = sim.state,
      ship = s.ships[0];
    s.furnitureStock.bunk = 64;
    expect(
      sim.edit(
        ship.tiles,
        ship.stations,
        ship.furnishings.filter((f) => f.kind !== "bunk"),
      ),
    ).toContain("No room");
    expect(ship.furnishings.length).toBe(3);
    expect(s.furnitureStock.bunk).toBe(64);
  });
  it("retains intended furniture over damaged floors without drawing unsupported props", () => {
    const s = createCampaign(),
      f = s.ships[0].furnishings[0];
    s.ships[0].tiles.find((t) => t.x === 0 && t.y === 4)!.damage = 100;
    s.pirates[0].x = s.pirates[0].previousX = 7;
    expect(furnitureSupported(s.ships[0].tiles, f)).toBe(false);
    expect(validateSave(s).ships[0].furnishings).toEqual(
      s.ships[0].furnishings,
    );
  });
  it("migrates schema five immutably without granting furniture or changing old hulls", () => {
    const old: any = structuredClone(createCampaign());
    old.schemaVersion = 5;
    delete old.furnitureStock;
    delete old.ships[0].furnishings;
    const before = structuredClone(old),
      migrated = validateSave(old);
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.furnitureStock).toEqual({ bunk: 0, table: 0, lantern: 0 });
    expect(migrated.ships[0].furnishings).toEqual([]);
    expect(migrated.ships[0].tiles).toEqual(
      old.ships[0].tiles.map((t: any) => ({ ...t, damage: t.damage ?? 0 })),
    );
    expect(old).toEqual(before);
  });
  it.each([
    null,
    { bunk: -1, table: 0, lantern: 0 },
    { bunk: 0, table: 65, lantern: 0 },
    { bunk: 0, table: 0, lantern: 0, unknown: 1 },
  ])("rejects malformed owned stock %j", (stock) => {
    const s: any = createCampaign();
    s.furnitureStock = stock;
    expect(() => validateSave(s)).toThrow();
  });
  it("sanitizes independent stock and furniture snapshots", () => {
    const s = createCampaign(),
      snap = checkpoint(s);
    s.furnitureStock.table = 9;
    s.ships[0].furnishings[0].x = 20;
    expect(snap.furnitureStock.table).toBe(0);
    expect(snap.ships[0].furnishings[0].x).toBe(0);
  });
  it("plunders supported furnishings once and does not double reward", () => {
    const sim = new Simulation(createCampaign()),
      s = sim.state;
    sim.sail(1);
    for (let i = 0; i < 220; i++) sim.tick();
    s.pirates.filter((p) => p.side === "enemy").forEach((p) => (p.hp = 0));
    sim.tick();
    expect(sim.finishEncounter()).toBe(true);
    expect(s.furnitureStock).toEqual({ bunk: 1, table: 1, lantern: 1 });
    expect(sim.finishEncounter()).toBe(false);
    expect(s.furnitureStock.table).toBe(1);
  });
  it("converts overflow salvage explicitly to gold", () => {
    const sim = new Simulation(createCampaign()),
      s = sim.state;
    sim.sail(1);
    for (let i = 0; i < 220; i++) sim.tick();
    FURNITURE_KINDS.forEach((k) => (s.furnitureStock[k] = 64));
    s.pirates.filter((p) => p.side === "enemy").forEach((p) => (p.hp = 0));
    sim.tick();
    const gold = s.gold;
    expect(sim.finishEncounter()).toBe(true);
    expect(s.gold - gold).toBe(s.reward + 17 + 12 + 7);
    expect(s.notices.some((n) => n.text.includes("salvage sold"))).toBe(true);
  });
  it("capture transfers placed furniture without also salvaging it", () => {
    const sim = new Simulation(createCampaign()),
      s = sim.state;
    sim.sail(1);
    for (let i = 0; i < 220; i++) sim.tick();
    s.pirates.filter((p) => p.side === "enemy").forEach((p) => (p.hp = 0));
    sim.tick();
    const prize = s.ships[1];
    expect(sim.finishEncounter(true)).toBe(true);
    expect(s.ships[0].furnishings).toEqual(prize.furnishings);
    expect(s.ships[0].furnishings).not.toBe(prize.furnishings);
    expect(s.furnitureStock.table).toBe(0);
    expect(checkpoint(s).ships[0].furnishings.length).toBe(3);
  });
});
