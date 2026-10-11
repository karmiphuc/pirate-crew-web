import { expect, it } from "vitest";
import { createCampaign, tileNode } from "../src/sim/model";
import { Simulation } from "../src/sim/engine";
import { clearShot, weaponForTarget } from "../src/sim/equipment";
import { encounterLoot } from "../src/sim/items";
import { checkpoint, validateSave } from "../src/storage/save";
const run = (sim: Simulation, n: number) => {
  for (let i = 0; i < n; i++) sim.tick();
};
function battle() {
  const s = createCampaign(42),
    sim = new Simulation(s),
    p = s.pirates[0];
  sim.equip(p.id, "pistol");
  s.pirates.forEach((a) => (a.duty = "guard"));
  sim.sail(1);
  run(sim, 200);
  const e = s.pirates.find((a) => a.side === "enemy")!;
  s.pirates = [p, e];
  e.shipId = 1;
  e.x = e.previousX = 9;
  p.x = p.previousX = 5;
  p.y = p.previousY = e.y = e.previousY = 3;
  p.cooldown = e.cooldown = 0;
  e.hp = e.maxHp = 1000;
  e.damage = 0;
  s.ships[1].cannonCooldown = 1000;
  return { s, sim, p, e };
}
it("carries two independent weapons, stows without duplicating ownership, and keeps a final weapon", () => {
  const s = createCampaign(),
    sim = new Simulation(s),
    p = s.pirates[0];
  s.itemStock.pistol = 1;
  expect(sim.equip(3, "pistol")).toBe(true);
  expect([p.meleeWeapon, p.rangedWeapon, p.weapon]).toEqual([
    "cutlass",
    "pistol",
    "pistol",
  ]);
  expect(s.itemStock.pistol).toBe(0);
  const gold = s.gold;
  for (let i = 0; i < 50; i++) {
    expect(sim.stowWeapon(3, "ranged")).toBe(true);
    expect(p.weapon).toBe("cutlass");
    expect(sim.stowWeapon(3, "melee")).toBe(false);
    expect(sim.equip(3, "pistol")).toBe(true);
  }
  expect(s.gold).toBe(gold);
  expect(p.ownedWeapons).toEqual(["cutlass", "pistol"]);
  expect(sim.stowWeapon(3, "melee")).toBe(true);
  expect(p.meleeWeapon).toBe(null);
  expect(p.weapon).toBe("pistol");
  expect(sim.stowWeapon(3, "ranged")).toBe(false);
  expect(validateSave(checkpoint(s)).pirates[0].rangedWeapon).toBe("pistol");
  sim.dispose();
  expect(sim.stowWeapon(3, "ranged")).toBe(false);
});
it("switches actual attacks from pistol to cutlass without resetting or bypassing a cooldown", () => {
  const { s, sim, p, e } = battle();
  sim.tick();
  expect(p.weapon).toBe("pistol");
  expect(p.cooldown).toBe(22);
  expect(e.hp).toBeLessThan(1000);
  const hp = e.hp;
  e.x = e.previousX = p.x + 0.8;
  run(sim, 21);
  expect(p.cooldown).toBe(1);
  expect(p.weapon).toBe("pistol");
  expect(e.hp).toBe(hp);
  sim.tick();
  expect(p.weapon).toBe("cutlass");
  expect(p.cooldown).toBe(15);
  expect(e.hp).toBeLessThan(hp);
  expect(s.phase).toBe("encounter");
  sim.dispose();
});
it("ranged-only pirates keep their pistol at melee distance; melee-only pirates pursue", () => {
  const { sim, p, e } = battle();
  p.meleeWeapon = null;
  e.x = e.previousX = 5.8;
  sim.tick();
  expect(p.weapon).toBe("pistol");
  expect(p.cooldown).toBe(22);
  p.meleeWeapon = "cutlass";
  p.rangedWeapon = null;
  p.weapon = "cutlass";
  p.cooldown = 0;
  e.x = e.previousX = 10;
  const hp = e.hp;
  sim.tick();
  expect(p.status).toBe("Closing on enemy");
  expect(e.hp).toBe(hp);
  expect(weaponForTarget(p, 4)).toBe("cutlass");
  sim.dispose();
});
it("intact hull cells block live ranged attacks, and destruction opens the shot without a stale cache", () => {
  const { s, sim, p, e } = battle();
  const wall = { x: 7, y: 3, kind: "hull" as const, damage: 0 };
  s.ships[0].tiles.push(wall);
  const rng = s.rng;
  sim.tick();
  expect(e.hp).toBe(1000);
  expect(p.cooldown).toBe(0);
  expect(s.rng).toBe(rng);
  expect(clearShot(s.ships[0], p, e)).toBe(false);
  wall.damage = 100;
  sim.tick();
  expect(e.hp).toBeLessThan(1000);
  expect(p.weapon).toBe("pistol");
  sim.dispose();
});
it("shot geometry is symmetric and respects ladders, floors, diagonal segments and hull damage", () => {
  const s = createCampaign(),
    ship = s.ships[0],
    p = s.pirates[0],
    e = s.pirates[1];
  p.x = 5;
  p.y = 3;
  e.x = 9;
  e.y = 3;
  expect(clearShot(ship, p, e)).toBe(true);
  ship.tiles.push({ x: 7, y: 3, kind: "ladder" });
  expect(clearShot(ship, p, e)).toBe(true);
  const wall = { x: 7, y: 3, kind: "hull" as const, damage: 0 };
  ship.tiles.push(wall);
  expect(clearShot(ship, p, e)).toBe(false);
  expect(clearShot(ship, e, p)).toBe(false);
  e.y = 3.4;
  expect(clearShot(ship, p, e)).toBe(false);
  wall.damage = 100;
  expect(clearShot(ship, p, e)).toBe(true);
});
it("accessory stock transfers to one independent locker and repeated changes never charge or duplicate it", () => {
  const s = createCampaign(),
    sim = new Simulation(s),
    p = s.pirates[0];
  s.itemStock.boots = 2;
  s.itemStock.diaper = 1;
  expect(sim.equipAccessory(3, "boots")).toBe(true);
  expect(s.itemStock.boots).toBe(1);
  expect(sim.equipAccessory(3, "boots")).toBe(false);
  expect(sim.equipAccessory(4, "boots")).toBe(true);
  expect(s.pirates[1].ownedAccessories).toEqual(["boots"]);
  expect(s.itemStock.boots).toBe(0);
  expect(sim.equipAccessory(3, "diaper")).toBe(true);
  const gold = s.gold;
  for (let i = 0; i < 50; i++) {
    sim.equipAccessory(3, null);
    sim.equipAccessory(3, "boots");
    sim.equipAccessory(3, "diaper");
  }
  expect(p.ownedAccessories).toEqual(["boots", "diaper"]);
  expect(s.gold).toBe(gold);
  expect(s.itemStock.diaper).toBe(0);
  sim.dispose();
  expect(sim.equipAccessory(3, "boots")).toBe(false);
});
it("invalid, dead, unaffordable and outside-port equipment requests keep gold, stock and ownership", () => {
  const s = createCampaign(),
    sim = new Simulation(s),
    p = s.pirates[0];
  s.gold = 0;
  expect(sim.equipAccessory(3, "boots")).toBe(false);
  s.itemStock.boots = 1;
  p.hp = 0;
  expect(sim.equipAccessory(3, "boots")).toBe(false);
  p.hp = p.maxHp;
  expect(sim.equipAccessory(3, "unknown" as any)).toBe(false);
  expect(sim.stowWeapon(3, "unknown" as any)).toBe(false);
  s.phase = "travel";
  expect(sim.equipAccessory(3, "boots")).toBe(false);
  expect(sim.stowWeapon(5, "melee")).toBe(false);
  expect([s.gold, s.itemStock.boots, p.ownedAccessories, p.accessory]).toEqual([
    0,
    1,
    [],
    null,
  ]);
  sim.dispose();
});
it("boots change actual path speed once, combine with Swift, and stowing restores ordinary speed", () => {
  const move = (
    boots: boolean,
    swift: boolean,
    repeat = false,
    stow = false,
  ) => {
    const s = createCampaign(),
      sim = new Simulation(s),
      p = s.pirates[0];
    p.duty = "guard";
    p.x = p.previousX = 5;
    if (swift) p.traits = ["swift"];
    if (boots) {
      sim.equipAccessory(3, "boots");
      if (repeat)
        for (let i = 0; i < 50; i++) {
          sim.equipAccessory(3, null);
          sim.equipAccessory(3, "boots");
        }
    }
    if (stow) sim.equipAccessory(3, null);
    sim.queue([3], { action: "move", shipId: 1, node: tileNode(8, 3) });
    run(sim, 4);
    const distance = p.x - 5;
    sim.dispose();
    return distance;
  };
  const baseline = move(false, false);
  expect(move(true, false)).toBeCloseTo(baseline * 1.25);
  expect(move(true, true)).toBeCloseTo(baseline * 1.5);
  expect(move(true, false, true)).toBeCloseTo(baseline * 1.25);
  expect(move(true, false, true, true)).toBeCloseTo(baseline);
});
it("diapers suppress only their living supported wearer's home-deck dirt contribution", () => {
  const s = createCampaign(),
    sim = new Simulation(s);
  s.pirates.forEach((p) => (p.duty = "guard"));
  sim.equipAccessory(3, "diaper");
  sim.equipAccessory(4, "diaper");
  sim.equipAccessory(5, "diaper");
  sim.sail(2);
  run(sim, 100);
  expect(s.ships[0].dirt).toBe(0);
  s.pirates[1].accessory = null;
  run(sim, 100);
  expect(s.ships[0].dirt).toBe(1);
  s.pirates[1].hp = 0;
  run(sim, 100);
  expect(s.ships[0].dirt).toBe(1);
  sim.dispose();
});
it("schema-seven migration preserves stock/map/lockers and only the previously active weapon", () => {
  const old: any = checkpoint(createCampaign(42));
  old.schemaVersion = 7;
  delete old.itemStock.boots;
  delete old.itemStock.diaper;
  old.itemStock.rum = 3;
  old.itemStock.pistol = 1;
  old.pirates.forEach((p: any) => {
    delete p.meleeWeapon;
    delete p.rangedWeapon;
    delete p.accessory;
    delete p.ownedAccessories;
  });
  const before = structuredClone(old),
    m = validateSave(old);
  expect(old).toEqual(before);
  expect(m.schemaVersion).toBe(10);
  expect(m.world).toEqual(before.world);
  expect(m.itemStock).toEqual({ ...old.itemStock, boots: 0, diaper: 0 });
  expect([m.pirates[0].meleeWeapon, m.pirates[0].rangedWeapon]).toEqual([
    "cutlass",
    null,
  ]);
  expect([m.pirates[2].meleeWeapon, m.pirates[2].rangedWeapon]).toEqual([
    null,
    "pistol",
  ]);
  expect(m.pirates[2].ownedWeapons).toEqual(["cutlass", "pistol"]);
  expect(m.pirates[2].ownedAccessories).toEqual([]);
  old.itemStock.rum = -1;
  expect(() => validateSave(old)).toThrow(/legacy item/);
});
it.each([
  "unknown melee",
  "wrong ranged",
  "empty weapons",
  "unowned active",
  "unowned accessory",
  "duplicate accessory",
  "unknown accessory",
  "missing slot",
])("rejects malformed schema-eight %s without altering source", (kind) => {
  const s: any = checkpoint(createCampaign()),
    p = s.pirates[0];
  if (kind === "unknown melee") p.meleeWeapon = "pistol";
  if (kind === "wrong ranged") p.rangedWeapon = "sabre";
  if (kind === "empty weapons") {
    p.meleeWeapon = null;
    p.rangedWeapon = null;
  }
  if (kind === "unowned active") p.weapon = "pistol";
  if (kind === "unowned accessory") p.accessory = "boots";
  if (kind === "duplicate accessory") p.ownedAccessories = ["boots", "boots"];
  if (kind === "unknown accessory") p.ownedAccessories = ["constructor"];
  if (kind === "missing slot") delete p.rangedWeapon;
  const before = structuredClone(s);
  expect(() => validateSave(s)).toThrow(/identity/);
  expect(s).toEqual(before);
});
it("1000 seeded prizes include accessories while keeping four-item and recovered-weapon guarantees", () => {
  let accessories = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const loot = encounterLoot({ seed, danger: 3, kind: "pirate" });
    accessories += loot.boots + loot.diaper;
    expect(Object.values(loot).reduce((a, b) => a + b)).toBe(4);
    expect(loot.sabre + loot.pistol).toBe(1);
  }
  expect(accessories).toBeGreaterThan(100);
});
