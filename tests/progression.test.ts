import { expect, it } from "vitest";
import { createCampaign, tileNode } from "../src/sim/model";
import { Simulation } from "../src/sim/engine";
import { awardExperience } from "../src/sim/items";
import {
  emptyAttributes,
  groupMembers,
  type Attribute,
} from "../src/sim/progression";
import { checkpoint, validateSave } from "../src/storage/save";

function battle(weapon: "cutlass" | "pistol", stat?: Attribute, value = 0) {
  const s = createCampaign(42),
    sim = new Simulation(s),
    p = s.pirates[0];
  if (weapon === "pistol") sim.equip(p.id, weapon);
  s.pirates.forEach((a) => (a.duty = "guard"));
  sim.sail(1);
  for (let i = 0; i < 200; i++) sim.tick();
  const e = s.pirates.find((a) => a.side === "enemy")!;
  s.pirates = [p, e];
  e.shipId = 1;
  p.x = p.previousX = 5;
  e.x = e.previousX = weapon === "pistol" ? 9 : 5.8;
  p.y = p.previousY = e.y = e.previousY = 3;
  e.hp = e.maxHp = 1000;
  e.cooldown = 100;
  if (stat) p.attributes[stat] = value;
  s.ships[1].cannonCooldown = 1000;
  return { s, sim, p, e };
}
it("spends earned points once, preserves missing health, and saves derived damage without inflating the base", () => {
  const s = createCampaign(),
    sim = new Simulation(s),
    p = s.pirates[0];
  p.hp = 60;
  expect(sim.trainAttribute(p.id, "vit")).toBe(true);
  expect([p.maxHp, p.hp, p.trainingPoints, p.attributes.vit]).toEqual([
    94, 64, 3, 1,
  ]);
  expect(sim.trainAttribute(p.id, "str")).toBe(true);
  expect(p.damage).toBe(12);
  const saved = validateSave(checkpoint(s));
  const another = validateSave(saved);
  another.pirates[0].attributes.vit++;
  expect(saved.pirates[0].attributes.vit).toBe(1);
  expect(p.attributes.vit).toBe(1);
  for (let i = 0; i < 20; i++)
    expect(validateSave(saved).pirates[0].maxHp).toBe(94);
  expect(saved.pirates[0].attributes.str).toBe(1);
  expect(sim.trainAttribute(p.id, "dex")).toBe(true);
  expect(sim.trainAttribute(p.id, "int")).toBe(true);
  const before = structuredClone(p);
  expect(sim.trainAttribute(p.id, "str")).toBe(false);
  expect(p).toEqual(before);
  sim.dispose();
});
it("awards four points for each earned level including multi-level feathers, without awarding them again after reload", () => {
  const s = createCampaign(),
    p = s.pirates[0];
  awardExperience(p, 100);
  expect([p.level, p.xp, p.trainingPoints, p.damage, p.maxHp]).toEqual([
    4, 100, 16, 18, 114,
  ]);
  const restored = validateSave(checkpoint(s)).pirates[0];
  awardExperience(restored, 1);
  expect([restored.level, restored.trainingPoints]).toEqual([4, 16]);
  awardExperience(restored, 19);
  expect([restored.level, restored.trainingPoints]).toEqual([5, 20]);
});
it("intelligence changes real item XP and point earnings; maximum level and invalid XP sources stay bounded", () => {
  const s = createCampaign(),
    sim = new Simulation(s),
    p = s.pirates[0];
  p.level = 25;
  p.attributes.int = 100;
  p.trainingPoints = 0;
  s.itemStock.feather = 1;
  expect(sim.useItem(p.id, "feather")).toBe(true);
  expect(p.xp).toBe(200);
  awardExperience(p, Infinity);
  awardExperience(p, -20);
  expect(p.xp).toBe(200);
  p.xp = 1_000_000_000;
  awardExperience(p, 1);
  expect([p.level, p.trainingPoints]).toEqual([100, 300]);
  awardExperience(p, 100);
  expect([p.xp, p.level, p.trainingPoints]).toEqual([1_000_000_000, 100, 300]);
  expect(validateSave(checkpoint(s)).pirates[0].trainingPoints).toBe(300);
  sim.dispose();
});
it.each(["str", "dex"] as const)(
  "%s changes only its relevant live attack damage",
  (stat) => {
    const strike = (weapon: "pistol" | "cutlass", boosted: boolean) => {
      const { sim, p, e } = battle(weapon, stat, boosted ? 50 : 0);
      sim.tick();
      const damage = 1000 - e.hp;
      expect(p.damage).toBe(12);
      sim.dispose();
      return damage;
    };
    const relevant = stat === "str" ? "cutlass" : "pistol",
      other = stat === "str" ? "pistol" : "cutlass";
    expect(strike(relevant, true) - strike(relevant, false)).toBe(50);
    expect(strike(other, true)).toBe(strike(other, false));
  },
);
it("agility shortens actual attack spacing and permits a second hit at the new boundary", () => {
  const { sim, p, e } = battle("cutlass", "agi", 100);
  sim.tick();
  expect(p.cooldown).toBe(8);
  const hp = e.hp;
  for (let i = 0; i < 7; i++) sim.tick();
  expect([p.cooldown, e.hp]).toEqual([1, hp]);
  sim.tick();
  expect(p.cooldown).toBe(8);
  expect(e.hp).toBeLessThan(hp);
  sim.dispose();
});
it("luck produces deterministic live critical hits while zero-luck damage retains its RNG sequence", () => {
  const critical = () => {
    const { sim, p, e, s } = battle("pistol", "luck", 100);
    s.rng = 1;
    sim.tick();
    const result = [p.status, e.hp, s.rng];
    sim.dispose();
    return result;
  };
  expect(critical()).toEqual(critical());
  expect(critical().slice(0, 2)).toEqual(["Critical shot", 982]);
  const { sim, e, s } = battle("pistol");
  s.rng = 1;
  sim.tick();
  expect([e.hp, s.rng]).toEqual([988, 270369]);
  sim.dispose();
});
it("training and grouping reject dead, enemy, invalid, capped, and unsafe-phase requests without changing pirates", () => {
  const s = createCampaign(),
    sim = new Simulation(s),
    p = s.pirates[0];
  const before = structuredClone(p);
  expect(sim.trainAttribute(p.id, "bad" as Attribute)).toBe(false);
  expect(sim.assignGroup(p.id, 5 as any)).toBe(false);
  expect(p).toEqual(before);
  p.hp = 0;
  expect(sim.trainAttribute(p.id, "str")).toBe(false);
  expect(sim.assignGroup(p.id, 2)).toBe(false);
  p.hp = 90;
  p.side = "enemy";
  expect(sim.trainAttribute(p.id, "str")).toBe(false);
  expect(sim.assignGroup(p.id, 2)).toBe(false);
  p.side = "ally";
  p.maxHp = 1000;
  expect(sim.trainAttribute(p.id, "vit")).toBe(false);
  p.attributes.str = 100;
  expect(sim.trainAttribute(p.id, "str")).toBe(false);
  s.phase = "encounter";
  expect(sim.trainAttribute(p.id, "dex")).toBe(false);
  expect(sim.assignGroup(p.id, 2)).toBe(false);
  sim.dispose();
  s.phase = "port";
  expect(sim.trainAttribute(p.id, "dex")).toBe(false);
  expect(sim.assignGroup(p.id, 2)).toBe(false);
});
it("groups route actual orders to living members only, keep duties, and snapshot a queued selection", () => {
  const s = createCampaign(),
    sim = new Simulation(s),
    [p, cook, gunner] = s.pirates;
  expect(sim.assignGroup(p.id, 2)).toBe(true);
  expect(sim.assignGroup(cook.id, 4)).toBe(true);
  expect(cook.duty).toBe("cook");
  const selected = groupMembers(s, 2);
  expect(selected).toEqual([p.id, gunner.id]);
  expect(
    sim.queue(selected, { action: "move", shipId: 1, node: tileNode(10, 3) }),
  ).toBe(true);
  selected.length = 0;
  sim.tick();
  expect(p.orders[0].action).toBe("move");
  expect(gunner.orders[0].action).toBe("move");
  expect(cook.orders).toEqual([]);
  gunner.hp = 0;
  expect(groupMembers(s, 2)).toEqual([p.id]);
  expect(sim.queue(groupMembers(s, 3), { action: "board" })).toBe(false);
  expect(sim.commandCount).toBe(0);
  sim.dispose();
});
it("schema-eight migration preserves crew, gear, stock, map, damage, and health without retroactive training", () => {
  const old: any = checkpoint(createCampaign(42));
  old.schemaVersion = 8;
  old.pirates[0].hp = 54;
  old.pirates[0].maxHp = 200;
  old.pirates[0].damage = 35;
  old.pirates[0].level = 20;
  old.itemStock.rum = 2;
  old.pirates.forEach((p: any) => {
    delete p.attributes;
    delete p.trainingPoints;
    delete p.group;
  });
  const before = structuredClone(old),
    migrated = validateSave(old);
  expect(old).toEqual(before);
  expect(migrated.schemaVersion).toBe(9);
  expect(migrated.world).toEqual(before.world);
  expect(migrated.itemStock).toEqual(before.itemStock);
  const p = migrated.pirates[0];
  expect([
    p.hp,
    p.maxHp,
    p.damage,
    p.level,
    p.trainingPoints,
    p.group,
    p.attributes,
  ]).toEqual([54, 200, 35, 20, 0, 1, emptyAttributes()]);
  expect(p.ownedWeapons).toEqual(before.pirates[0].ownedWeapons);
  expect(validateSave(migrated).pirates).toEqual(migrated.pirates);
  old.pirates[0].rangedWeapon = "sabre";
  expect(() => validateSave(old)).toThrow(/crew identity/);
});
it.each([
  { trainingPoints: -1 },
  { trainingPoints: 401 },
  { trainingPoints: 1.5 },
  { group: 0 },
  { group: 5 },
  { group: "1" },
  { attributes: { ...emptyAttributes(), str: 101 } },
  { attributes: { ...emptyAttributes(), luck: NaN } },
  { attributes: { ...emptyAttributes(), dex: 1.5 } },
  { attributes: { ...emptyAttributes(), extra: 0 } },
  { attributes: { str: 0, vit: 0, int: 0, dex: 0, agi: 0 } },
  { attributes: { ...emptyAttributes(), str: 1 } }, // Four unspent starting points plus an unearned point.
])("rejects malformed or unearned progression: %j", (change) => {
  const s = checkpoint(createCampaign());
  Object.assign(s.pirates[0], change);
  expect(() => validateSave(s)).toThrow(/progression/);
});
