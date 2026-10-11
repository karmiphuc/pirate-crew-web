import { describe, expect, it } from "vitest";
import { createCampaign } from "../src/sim/model";
import { Simulation } from "../src/sim/engine";
import {
  ITEMS,
  ITEM_KINDS,
  ITEM_STOCK_CAP,
  encounterLoot,
  emptyItemStock,
} from "../src/sim/items";
import { checkpoint, validateSave } from "../src/storage/save";

describe("owned item hold", () => {
  it("charges exactly once, sells only stock, and rejects invalid/full/bankrupt trades", () => {
    const s = createCampaign(),
      sim = new Simulation(s);
    expect(sim.buyItem("rum")).toBe(true);
    expect([s.gold, s.itemStock.rum]).toEqual([408, 1]);
    expect(sim.sellItem("rum")).toBe(true);
    expect([s.gold, s.itemStock.rum]).toEqual([414, 0]);
    expect(sim.sellItem("rum")).toBe(false);
    for (const kind of ["__proto__", "constructor", "missing"])
      expect(sim.buyItem(kind as any)).toBe(false);
    s.itemStock.rum = ITEM_STOCK_CAP;
    expect(sim.buyItem("rum")).toBe(false);
    expect(s.gold).toBe(414);
    s.gold = 0;
    expect(sim.buyItem("elixir")).toBe(false);
    s.gold = 1_000_000_000;
    expect(sim.sellItem("rum")).toBe(false);
    expect(s.itemStock.rum).toBe(99);
    s.phase = "travel";
    expect(sim.buyItem("feather")).toBe(false);
    sim.dispose();
    expect(sim.sellItem("rum")).toBe(false);
  });
  it("uses each consumable on one living ally, clamps its effect and keeps full-stat items", () => {
    const s = createCampaign(),
      sim = new Simulation(s),
      p = s.pirates[0];
    s.itemStock = {
      ...emptyItemStock(),
      rum: 2,
      elixir: 2,
      boneMeal: 2,
      feather: 1,
      sabre: 1,
      pistol: 0,
    };
    p.hp = 80;
    p.hunger = 85;
    p.morale = 90;
    expect(sim.useItem(p.id, "elixir")).toBe(true);
    expect(p.hp).toBe(90);
    expect(sim.useItem(p.id, "elixir")).toBe(false);
    expect(s.itemStock.elixir).toBe(1);
    expect(sim.useItem(p.id, "rum")).toBe(true);
    expect(p.morale).toBe(100);
    expect(sim.useItem(p.id, "rum")).toBe(false);
    expect(s.itemStock.rum).toBe(1);
    expect(sim.useItem(p.id, "boneMeal")).toBe(true);
    expect(p.hunger).toBe(100);
    expect(sim.useItem(p.id, "boneMeal")).toBe(false);
    expect(s.itemStock.boneMeal).toBe(1);
    p.hp = 20;
    expect(sim.useItem(p.id, "feather")).toBe(true);
    expect([p.level, p.xp, p.damage, p.maxHp, p.hp]).toEqual([
      4, 100, 18, 114, 80,
    ]);
    expect(sim.useItem(p.id, "sabre")).toBe(false);
    expect(s.itemStock.sabre).toBe(1);
    p.hp = 0;
    expect(sim.useItem(p.id, "elixir")).toBe(false);
    p.hp = 20;
    p.side = "enemy";
    expect(sim.useItem(p.id, "elixir")).toBe(false);
    expect(sim.useItem(999, "elixir")).toBe(false);
    expect(sim.useItem(p.id, "constructor" as any)).toBe(false);
  });
  it("permits paused battle preparation but rejects overboard/transit actors and gameover", () => {
    const s = createCampaign(),
      sim = new Simulation(s),
      p = s.pirates[0];
    s.itemStock.elixir = 2;
    p.hp = 20;
    expect(sim.sail(1)).toBe(true);
    for (let i = 0; i < 200; i++) sim.tick();
    expect(s.phase).toBe("encounter");
    expect(sim.useItem(p.id, "elixir")).toBe(true);
    p.x = p.previousX = 17;
    p.duty = "guard";
    expect(sim.queue([p.id], { action: "board" })).toBe(true);
    for (let i = 0; i < 12; i++) sim.tick();
    expect(sim.seaPosition(p.id)).toBeDefined();
    expect(sim.useItem(p.id, "elixir")).toBe(false);
    expect(s.itemStock.elixir).toBe(1);
    sim.cleanup();
    s.phase = "gameover";
    expect(sim.useItem(p.id, "elixir")).toBe(false);
  });
  it("transfers a recovered weapon once to its recipient and leaves independent lockers", () => {
    const s = createCampaign(),
      sim = new Simulation(s);
    s.itemStock.sabre = 1;
    expect(sim.equip(3, "sabre")).toBe(true);
    expect([s.itemStock.sabre, s.gold, s.pirates[0].weapon]).toEqual([
      0,
      420,
      "sabre",
    ]);
    expect(s.pirates[1].ownedWeapons).toEqual(["cutlass"]);
    expect(sim.equip(3, "cutlass")).toBe(true);
    expect(sim.equip(3, "sabre")).toBe(true);
    expect(s.gold).toBe(420);
    s.itemStock.sabre = 1;
    s.pirates[1].hp = 0;
    expect(sim.equip(4, "sabre")).toBe(false);
    expect(s.itemStock.sabre).toBe(1);
    expect(s.gold).toBe(420);
    s.pirates[1].hp = s.pirates[1].maxHp;
    expect(sim.equip(4, "sabre")).toBe(true);
    expect(s.itemStock.sabre).toBe(0);
    expect(s.gold).toBe(420);
    expect(sim.equip(5, "sabre")).toBe(true);
    expect(s.gold).toBe(360);
    expect(sim.equip(5, "pistol")).toBe(true);
    s.itemStock.pistol = 1;
    expect(sim.equip(5, "pistol")).toBe(false);
    expect(s.itemStock.pistol).toBe(1);
  });
  it("1000 seeded prizes are repeatable, varied, bounded and consume no campaign RNG", () => {
    const variants = new Set(),
      s = createCampaign(),
      before = structuredClone(s);
    for (let seed = 0; seed < 1000; seed++) {
      const node = {
          seed,
          danger: 1 + (seed % 4),
          kind: seed % 3 === 0 ? ("island" as const) : ("pirate" as const),
        },
        loot = encounterLoot(node);
      expect(encounterLoot(node)).toEqual(loot);
      expect(Object.values(loot).reduce((a, b) => a + b)).toBeLessThanOrEqual(
        4,
      );
      expect(
        Object.values(loot).every((n) => Number.isInteger(n) && n >= 0),
      ).toBe(true);
      if (node.kind === "pirate" && node.danger >= 2)
        expect(loot.sabre + loot.pistol).toBe(1);
      variants.add(JSON.stringify(loot));
    }
    expect(variants.size).toBeGreaterThan(20);
    expect(s).toEqual(before);
  });
  it.each([false, true])(
    "claims loot once with capture=%s and checkpoints it independently",
    (capture) => {
      const s = createCampaign(42),
        sim = new Simulation(s);
      s.pirates.forEach((p) => (p.duty = "guard"));
      sim.sail(3);
      for (let i = 0; i < 200; i++) sim.tick();
      s.pirates.filter((p) => p.side === "enemy").forEach((p) => (p.hp = 0));
      sim.tick();
      const rng = s.rng,
        loot = encounterLoot(s.world[3]);
      expect(sim.finishEncounter(capture)).toBe(true);
      expect(s.itemStock).toEqual(loot);
      expect(s.rng).toBe(rng);
      const gold = s.gold;
      expect(sim.finishEncounter(capture)).toBe(false);
      expect(s.gold).toBe(gold);
      expect(s.itemStock).toEqual(loot);
      const saved = checkpoint(s);
      expect(saved.itemStock).toEqual(loot);
      s.itemStock.rum++;
      expect(saved.itemStock).toEqual(loot);
    },
  );
  it("sells overflowing prize items with visible feedback, without silently losing them", () => {
    const s = createCampaign(42),
      sim = new Simulation(s);
    for (const k of ITEM_KINDS) s.itemStock[k] = ITEM_STOCK_CAP;
    s.pirates.forEach((p) => (p.duty = "guard"));
    sim.sail(1);
    for (let i = 0; i < 200; i++) sim.tick();
    s.pirates.filter((p) => p.side === "enemy").forEach((p) => (p.hp = 0));
    sim.tick();
    const before = s.gold,
      loot = encounterLoot(s.world[1]);
    expect(sim.finishEncounter(true)).toBe(true);
    expect(s.gold).toBe(
      before +
        s.reward +
        ITEM_KINDS.reduce(
          (n, k) => n + loot[k] * Math.floor(ITEMS[k].price / 2),
          0,
        ),
    );
    expect(Object.values(s.itemStock).every((n) => n === 99)).toBe(true);
    expect(s.notices.some((n) => n.text.includes("stack is full"))).toBe(true);
  });
  it("immutably migrates schema six and preserves hulls, crew lockers and map", () => {
    const old: any = createCampaign(42);
    old.schemaVersion = 6;
    delete old.itemStock;
    const before = structuredClone(old),
      migrated = validateSave(old);
    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.itemStock).toEqual(emptyItemStock());
    expect(migrated.world).toEqual(before.world);
    expect(migrated.pirates[0].ownedWeapons).toEqual(
      before.pirates[0].ownedWeapons,
    );
    expect(old).toEqual(before);
  });
  it.each([
    null,
    [],
    {},
    { rum: -1 },
    { rum: 100 },
    { rum: 1.5 },
    { rum: Infinity },
    { rum: 0, unknown: 2 },
  ])("rejects malformed item stock %j", (stock) => {
    const s: any = createCampaign();
    s.itemStock =
      stock && !Array.isArray(stock) && Object.keys(stock).length
        ? { ...s.itemStock, ...stock }
        : stock;
    expect(() => validateSave(s)).toThrow(/item stock/);
  });
  it("bounds experience increases at level 100 without consuming a useless feather", () => {
    const s = createCampaign(),
      sim = new Simulation(s),
      p = s.pirates[0];
    s.itemStock.feather = 2;
    p.level = 99;
    p.xp = 1_000_000_000 - 10;
    expect(sim.useItem(p.id, "feather")).toBe(true);
    expect([p.xp, p.level, s.itemStock.feather]).toEqual([
      1_000_000_000, 100, 1,
    ]);
    expect(sim.useItem(p.id, "feather")).toBe(false);
    expect(s.itemStock.feather).toBe(1);
  });
});
