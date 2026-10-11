import { expect, it } from "vitest";
import { createCampaign, starterShip, tileNode } from "../src/sim/model";
import { Simulation } from "../src/sim/engine";
import { checkpoint, validateSave } from "../src/storage/save";
import { awardExperience } from "../src/sim/items";
import { attackDamage } from "../src/sim/progression";

const run = (sim: Simulation, ticks: number) => {
  for (let i = 0; i < ticks; i++) sim.tick();
};

it("reads owned books before charging gold, spends shared points once, and preserves known-skill orders", () => {
  const s = createCampaign(),
    sim = new Simulation(s),
    p = s.pirates[0];
  expect(sim.buyBook("swim")).toBe(true);
  const gold = s.gold;
  expect(sim.teach(p.id, "swim")).toBe(true);
  expect([
    s.gold,
    s.bookStock.swim,
    p.skillRanks.swim,
    p.trainingPoints,
    p.skillPointsSpent,
  ]).toEqual([gold, 0, 1, 3, 1]);
  expect(p.duty).toBe("guard");
  sim.queue([p.id], { action: "move", shipId: 1, node: tileNode(12, 3) });
  sim.tick();
  const orders = structuredClone(p.orders);
  expect(sim.trainSkill(p.id, "guard")).toBe(true);
  expect(p.orders).toEqual(orders);
  expect([
    s.gold,
    p.skillRanks.guard,
    p.trainingPoints,
    p.skillPointsSpent,
  ]).toEqual([gold - 60, 2, 2, 2]);
  expect(sim.trainAttribute(p.id, "str")).toBe(true);
  const saved = validateSave(checkpoint(s));
  expect(saved.pirates[0].skillRanks).toEqual(p.skillRanks);
  expect(saved.pirates[0].skillPointsSpent).toBe(2);
  const another = validateSave(saved);
  another.pirates[0].skillRanks.guard++;
  another.bookStock.guard++;
  expect(saved.pirates[0].skillRanks.guard).toBe(2);
  expect(saved.bookStock.guard).toBe(0);
  sim.dispose();
});

it("keeps purchases, learning and upgrades atomic when gold or points are missing", () => {
  const s = createCampaign(),
    sim = new Simulation(s),
    p = s.pirates[0];
  s.bookStock.swim = 1;
  p.trainingPoints = 0;
  const before = structuredClone(p),
    gold = s.gold;
  expect(sim.teach(p.id, "swim")).toBe(false);
  expect(sim.trainSkill(p.id, "guard")).toBe(false);
  expect(p).toEqual(before);
  expect([s.gold, s.bookStock.swim]).toEqual([gold, 1]);
  p.trainingPoints = 4;
  s.gold = 59;
  expect(sim.buyBook("guard")).toBe(false);
  expect(sim.trainSkill(p.id, "guard")).toBe(false);
  expect(p.trainingPoints).toBe(4);
  expect(sim.teach(p.id, "swim")).toBe(true);
  expect([s.gold, s.bookStock.swim]).toEqual([59, 0]);
  sim.dispose();
});

it("enforces port, ownership, living recipients, known skills and rank limits", () => {
  const s = createCampaign(),
    sim = new Simulation(s),
    p = s.pirates[0];
  s.gold = 1000;
  for (let i = 0; i < 4; i++) expect(sim.trainSkill(p.id, "guard")).toBe(true);
  const before = structuredClone(p),
    gold = s.gold;
  expect(sim.trainSkill(p.id, "guard")).toBe(false);
  expect(sim.teach(p.id, "guard")).toBe(false);
  expect(sim.trainSkill(p.id, "swim")).toBe(false);
  expect(sim.teach(p.id, "bad" as any)).toBe(false);
  expect(p).toEqual(before);
  expect(s.gold).toBe(gold);
  expect(sim.sellBook("guard")).toBe(false);
  s.bookStock.guard = 99;
  expect(sim.buyBook("guard")).toBe(false);
  expect(sim.sellBook("guard")).toBe(true);
  expect([s.bookStock.guard, s.gold]).toEqual([98, gold + 30]);
  for (const phase of [
    "travel",
    "encounter",
    "aftermath",
    "victory",
    "won",
    "gameover",
  ] as const) {
    s.phase = phase;
    expect(sim.buyBook("guard")).toBe(false);
    expect(sim.sellBook("guard")).toBe(false);
    expect(sim.teach(p.id, "swim")).toBe(false);
    expect(sim.trainSkill(p.id, "guard")).toBe(false);
  }
  s.phase = "port";
  p.hp = 0;
  expect(sim.teach(p.id, "swim")).toBe(false);
  p.hp = 90;
  p.side = "enemy";
  expect(sim.teach(p.id, "swim")).toBe(false);
  sim.dispose();
  expect(sim.buyBook("guard")).toBe(false);
});

it("higher cooking ranks finish earlier with one input and one XP award; cancellation and exhausted work award nothing", () => {
  const slow = new Simulation(createCampaign()),
    fast = new Simulation(createCampaign());
  for (const sim of [slow, fast]) {
    sim.state.food = 1;
    sim.state.meals = 0;
    sim.state.pirates[1].x = sim.state.pirates[1].previousX = 3;
  }
  expect(fast.trainSkill(4, "cook")).toBe(true);
  run(slow, 51);
  run(fast, 51);
  expect([slow.state.meals, slow.state.pirates[1].xp]).toEqual([0, 0]);
  expect([fast.state.meals, fast.state.food, fast.state.pirates[1].xp]).toEqual(
    [2, 0, 2],
  );
  run(fast, 200);
  expect(fast.state.pirates[1].xp).toBe(2);
  slow.queue([4], { action: "move", shipId: 1, node: tileNode(10, 3) });
  slow.tick();
  expect([slow.state.food, slow.state.meals, slow.state.pirates[1].xp]).toEqual(
    [1, 0, 0],
  );
  slow.dispose();
  fast.dispose();
});

it("rank-four repairs complete on the exact fiftieth tick without fractional progress drift", () => {
  const s = createCampaign(),
    sim = new Simulation(s),
    p = s.pirates[0];
  expect(sim.teach(p.id, "repair")).toBe(true);
  for (let i = 0; i < 3; i++) expect(sim.trainSkill(p.id, "repair")).toBe(true);
  const plank = s.ships[0].tiles.find((t) => t.x === 3 && t.y === 4)!;
  plank.damage = 60;
  s.parts = 1;
  s.ships[0].hp = s.ships[0].maxHp - 12;
  run(sim, 49);
  expect([s.parts, plank.damage, p.xp]).toEqual([1, 60, 0]);
  sim.tick();
  expect([s.parts, plank.damage, p.xp]).toEqual([0, 0, 2]);
  run(sim, 80);
  expect(p.xp).toBe(2);
  sim.dispose();
});

it("completed work earns levels and intelligence-adjusted XP through the real scheduler", () => {
  const s = createCampaign(),
    sim = new Simulation(s),
    p = s.pirates[1];
  p.x = p.previousX = 3;
  p.xp = 28;
  s.food = 1;
  s.meals = 0;
  run(sim, 60);
  expect([p.xp, p.level, p.trainingPoints]).toEqual([30, 2, 8]);
  expect(validateSave(checkpoint(s)).pirates[1].trainingPoints).toBe(8);
  awardExperience(p, 2990);
  p.attributes.int = 100;
  p.trainingPoints -= 100;
  s.food = 1;
  s.meals = 0;
  const xp = p.xp;
  run(sim, 60);
  expect(p.xp - xp).toBe(0); // Maximum level cannot be farmed.
  sim.dispose();
  const other = new Simulation(createCampaign()),
    q = other.state.pirates[1];
  awardExperience(q, 720);
  q.attributes.int = 100;
  q.trainingPoints -= 100;
  q.x = q.previousX = 3;
  other.state.food = 1;
  other.state.meals = 0;
  run(other, 60);
  expect(q.xp).toBe(724);
  other.dispose();
});

it("guard ranks derive weapon damage once without altering saved base damage", () => {
  const s = createCampaign(),
    sim = new Simulation(s),
    p = s.pirates[0];
  const damage = attackDamage(p, "cutlass");
  sim.trainSkill(p.id, "guard");
  expect(attackDamage(p, "cutlass")).toBe(damage + 1);
  const base = p.damage;
  let saved = checkpoint(s);
  for (let i = 0; i < 20; i++) saved = validateSave(saved);
  expect(saved.pirates[0].damage).toBe(base);
  expect(attackDamage(saved.pirates[0], "cutlass")).toBe(damage + 1);
  sim.dispose();
});

it("ranked swimming reaches home sooner through the real sea traversal", () => {
  const swim = (rank: number) => {
    const s = createCampaign(),
      sim = new Simulation(s),
      p = s.pirates[0];
    awardExperience(p, 100);
    s.gold = 1000;
    sim.teach(p.id, "swim");
    for (let i = 1; i < rank; i++) sim.trainSkill(p.id, "swim");
    s.phase = "aftermath";
    s.ships.push(starterShip(2, true));
    p.shipId = 2;
    p.x = p.previousX = 0;
    p.y = p.previousY = 3;
    s.ships[1].tiles.find((t) => t.x === 0 && t.y === 4)!.damage = 100;
    sim.refreshStructure(2);
    let ticks = 0;
    do {
      sim.tick();
      ticks++;
    } while ((p.shipId !== 1 || sim.seaCount > 0) && ticks < 200);
    expect(p.hp).toBeGreaterThan(0);
    expect(sim.seaCount).toBe(0);
    sim.dispose();
    return ticks;
  };
  expect(swim(5)).toBeLessThan(swim(1));
});

it("migrates schema nine without granting or spending points, changing injuries or mutating old fields", () => {
  const old: any = checkpoint(createCampaign());
  old.schemaVersion = 9;
  delete old.bookStock;
  old.pirates.forEach((p: any) => {
    delete p.skillRanks;
    delete p.skillPointsSpent;
  });
  old.pirates[0].hp = 45;
  old.pirates[0].skills.push("swim");
  const before = structuredClone(old),
    migrated = validateSave(old);
  expect(old).toEqual(before);
  expect(migrated.schemaVersion).toBe(10);
  expect(migrated.pirates[0].skillRanks.swim).toBe(1);
  expect(migrated.pirates[0].skillRanks.cook).toBe(0);
  expect(migrated.pirates[0].skillPointsSpent).toBe(0);
  expect(migrated.pirates[0].trainingPoints).toBe(4);
  expect(migrated.pirates[0].hp).toBe(45);
  expect(Object.values(migrated.bookStock)).toEqual(Array(8).fill(0));
  expect(migrated.world).toEqual(old.world);
  expect(migrated.itemStock).toEqual(old.itemStock);
});

it.each([
  "extra",
  "missing",
  "fraction",
  "cap",
  "unlearned",
  "unaccounted",
  "overspend",
  "stock",
  "stock-extra",
])("rejects malformed %s progression and forged point budgets", (fault) => {
  const s: any = checkpoint(createCampaign()),
    p = s.pirates[0];
  if (fault === "extra") p.skillRanks.extra = 1;
  if (fault === "missing") delete p.skillRanks.swim;
  if (fault === "fraction") p.skillRanks.guard = 1.5;
  if (fault === "cap") p.skillRanks.guard = 6;
  if (fault === "unlearned") p.skillRanks.swim = 1;
  if (fault === "unaccounted") p.skillRanks.guard = 2;
  if (fault === "overspend") p.skillPointsSpent = 1;
  if (fault === "stock") s.bookStock.guard = 100;
  if (fault === "stock-extra") s.bookStock.extra = 0;
  expect(() => validateSave(s)).toThrow();
});
