import { describe, expect, it } from "vitest";
import { Simulation } from "../src/sim/engine";
import { createCampaign, tileNode } from "../src/sim/model";
import { checkpoint, validateSave } from "../src/storage/save";
const run = (sim: Simulation, ticks: number) => {
  for (let i = 0; i < ticks; i++) sim.tick();
};
const allies = (sim: Simulation) =>
  sim.state.pirates
    .filter((p) => p.side === "ally" && p.hp > 0)
    .map((p) => p.id);
function defeatedShip() {
  const sim = new Simulation(createCampaign());
  sim.sail(1);
  run(sim, 220);
  sim.queue(allies(sim), { action: "board" });
  run(sim, 800);
  expect(sim.state.phase).toBe("aftermath");
  return sim;
}
function returnCrew(sim: Simulation) {
  sim.queue(allies(sim), { action: "retreat" });
  run(sim, 300);
}

describe("crew work and owned loadouts", () => {
  it("reserves one galley slot and consumes each raw provision once", () => {
    const sim = new Simulation(createCampaign());
    sim.state.meals = 0;
    sim.state.pirates[0].skills.push("cook");
    sim.assignDuty(3, "cook");
    for (let i = 0; i < 400; i++) {
      sim.tick();
      expect(sim.taskCount).toBeLessThanOrEqual(1);
      expect(sim.claimCount).toBe(sim.taskCount);
    }
    expect(sim.state.food).toBe(13);
    expect(sim.state.meals).toBe(10);
    expect(sim.taskCount).toBe(0);
    expect(sim.claimCount).toBe(0);
  });
  it("movement interrupts work and death releases the station claim", () => {
    const sim = new Simulation(createCampaign());
    sim.state.meals = 0;
    sim.tick();
    expect(sim.claimCount).toBe(1);
    sim.queue([4], { action: "move", shipId: 1, node: tileNode(8, 3) });
    sim.tick();
    expect(sim.claimCount).toBe(0);
    sim.assignDuty(4, "cook");
    sim.tick();
    expect(sim.claimCount).toBe(1);
    sim.state.pirates[1].hp = 0;
    sim.tick();
    expect(sim.claimCount).toBe(0);
    expect(sim.pendingCount).toBe(0);
  });
  it("a trained shipwright repairs at the hull using capped timber", () => {
    const sim = new Simulation(createCampaign());
    expect(sim.teach(4, "repair")).toBe(true);
    sim.state.ships[0].hp = 50;
    sim.state.parts = 2;
    run(sim, 300);
    expect(sim.state.ships[0].hp).toBe(74);
    expect(sim.state.parts).toBe(0);
    expect(sim.taskCount).toBe(0);
    expect(sim.claimCount).toBe(0);
  });
  it("trained cleaner and doctor perform real work without free resources", () => {
    const sim = new Simulation(createCampaign());
    sim.teach(4, "clean");
    sim.teach(5, "medic");
    sim.state.ships[0].dirt = 40;
    sim.state.pirates[0].hp = 50;
    sim.state.medicine = 2;
    run(sim, 250);
    expect(sim.state.ships[0].dirt).toBe(0);
    expect(sim.state.pirates[0].hp).toBe(90);
    expect(sim.state.medicine).toBe(0);
    expect(sim.claimCount).toBe(0);
  });
  it("requires books and retains weapon ownership when switching", () => {
    const sim = new Simulation(createCampaign());
    expect(sim.assignDuty(3, "repair")).toBe(false);
    expect(sim.teach(3, "repair")).toBe(true);
    expect(sim.teach(3, "repair")).toBe(false);
    const before = sim.state.gold;
    expect(sim.equip(3, "sabre")).toBe(true);
    expect(sim.state.gold).toBe(before - 60);
    expect(sim.equip(3, "cutlass")).toBe(true);
    expect(sim.equip(3, "sabre")).toBe(true);
    expect(sim.state.gold).toBe(before - 60);
    expect(sim.state.pirates[0].ownedWeapons).toEqual(["cutlass", "sabre"]);
    expect(sim.armor(3)).toBe(true);
    expect(sim.armor(3)).toBe(true);
    expect(sim.armor(3)).toBe(false);
    expect(sim.state.pirates[0].armor).toBe(8);
    const saved = checkpoint(sim.state);
    expect(validateSave(saved).pirates[0].duty).toBe("repair");
    expect(saved.pirates[0].armor).toBe(8);
  });
  it("settles a fractional final waypoint instead of leaving an active order stuck", () => {
    const sim = new Simulation(createCampaign());
    const p = sim.state.pirates[0];
    p.x = p.previousX = 0.48;
    sim.queue([p.id], { action: "move", shipId: 1, node: tileNode(0, 3) });
    run(sim, 10);
    expect(p.x).toBe(0);
    expect(p.orders).toEqual([]);
    expect(sim.pendingCount).toBe(0);
  });
});

describe("naval combat, exploration and prize decisions", () => {
  it("cannoneer travels to a station and fires only after completing work", () => {
    const sim = new Simulation(createCampaign());
    sim.sail(1);
    run(sim, 140);
    const ammo = sim.state.ammo,
      hp = sim.state.ships[1].hp;
    expect(sim.cannon()).toBe(true);
    sim.tick();
    expect(sim.state.ammo).toBe(ammo);
    expect(sim.state.ships[1].hp).toBe(hp);
    run(sim, 120);
    expect(sim.state.ammo).toBeLessThan(ammo);
    expect(sim.state.ships[1].hp).toBeLessThan(hp);
    expect(sim.taskCount).toBeLessThanOrEqual(3);
  });
  it("incoming fire damages hull and sinking ends the voyage", () => {
    const sim = new Simulation(createCampaign());
    sim.assignDuty(5, "guard");
    sim.sail(1);
    run(sim, 140);
    sim.state.ships[0].hp = 10;
    sim.state.ships[1].cannonCooldown = 1;
    sim.tick();
    expect(sim.state.ships[0].hp).toBe(0);
    expect(sim.state.phase).toBe("gameover");
    expect(sim.taskCount).toBe(0);
    expect(sim.claimCount).toBe(0);
    expect(() => checkpoint(sim.state)).toThrow();
  });
  it("does not award gold until the crew returns and the prize is plundered", () => {
    const sim = defeatedShip();
    const before = sim.state.gold;
    expect(sim.state.world[1].cleared).toBe(false);
    expect(sim.state.reward).toBe(0);
    expect(sim.finishEncounter()).toBe(false);
    expect(sim.state.gold).toBe(before);
    expect(() => checkpoint(sim.state)).toThrow();
    returnCrew(sim);
    expect(sim.finishEncounter()).toBe(true);
    const gold = sim.state.gold;
    expect(gold).toBeGreaterThan(before);
    expect(sim.finishEncounter()).toBe(false);
    expect(sim.state.gold).toBe(gold);
    expect(sim.state.ships.length).toBe(1);
    expect(sim.taskCount).toBe(0);
    expect(sim.claimCount).toBe(0);
  });
  it("captures the prize hull with safe home IDs, reachable crew and no duplicate ship", () => {
    const sim = defeatedShip();
    returnCrew(sim);
    const parts = sim.state.parts;
    expect(sim.finishEncounter(true)).toBe(true);
    expect(sim.state.ships.length).toBe(1);
    expect(sim.state.ships[0].name).toContain("captured");
    expect(sim.state.ships[0].id).toBe(1);
    expect(sim.state.parts).toBe(parts);
    expect(sim.state.pirates.every((p) => p.shipId === 1)).toBe(true);
    expect(sim.graphCount).toBe(1);
    expect(sim.pendingCount).toBe(0);
    expect(() => checkpoint(sim.state)).not.toThrow();
  });
  it("disables a hull but refuses to capture a wreck", () => {
    const sim = new Simulation(createCampaign());
    sim.sail(1);
    run(sim, 140);
    sim.state.ships[1].hp = 0;
    sim.tick();
    expect(sim.state.phase).toBe("aftermath");
    expect(sim.finishEncounter(true)).toBe(false);
    expect(sim.finishEncounter()).toBe(true);
  });
  it("requires landing and reaching an island chest, then returns survivors safely", () => {
    const sim = new Simulation(createCampaign());
    sim.sail(2);
    run(sim, 220);
    const before = sim.state.gold;
    expect(sim.state.ships[1].kind).toBe("island");
    expect(sim.state.phase).toBe("encounter");
    sim.collect([3]);
    run(sim, 5);
    expect(sim.state.phase).toBe("encounter");
    expect(sim.state.gold).toBe(before);
    sim.queue([3], { action: "board" });
    run(sim, 160);
    sim.collect([3]);
    run(sim, 140);
    expect(sim.state.phase).toBe("aftermath");
    expect(sim.finishEncounter()).toBe(false);
    returnCrew(sim);
    expect(sim.finishEncounter()).toBe(true);
    expect(sim.state.world[2].cleared).toBe(true);
    expect(sim.state.gold).toBe(before + 110);
    expect(() => checkpoint(sim.state)).not.toThrow();
  });
  it("does not let an island guard be skipped by collecting treasure", () => {
    const sim = new Simulation(createCampaign());
    sim.sail(4);
    run(sim, 220);
    sim.state.pirates[0].shipId = 2;
    sim.state.pirates[0].x = 14;
    sim.collect([3]);
    sim.tick();
    expect(sim.state.phase).toBe("encounter");
    expect(sim.state.reward).toBe(0);
    expect(sim.state.notices.at(-1)?.text).toContain("guards");
  });
  it("cleanup and disposal release all work claims and path searches", () => {
    const sim = new Simulation(createCampaign());
    sim.state.meals = 0;
    sim.tick();
    expect(sim.claimCount).toBe(1);
    sim.cleanup();
    expect(sim.claimCount).toBe(0);
    expect(sim.taskCount).toBe(0);
    expect(sim.pendingCount).toBe(0);
    sim.tick();
    sim.dispose();
    sim.dispose();
    expect(sim.claimCount).toBe(0);
    expect(sim.taskCount).toBe(0);
    expect(sim.graphCount).toBe(0);
  });
});

describe("checkpoint evolution", () => {
  it("migrates v1 without mutating it or losing crew, gold, map or hull", () => {
    const old: any = createCampaign(42);
    old.schemaVersion = 1;
    delete old.meals;
    old.ships.forEach((s: any) => {
      delete s.kind;
      delete s.dirt;
      delete s.cannonCooldown;
    });
    old.pirates.forEach((p: any) => {
      delete p.duty;
      delete p.skills;
      delete p.weapon;
      delete p.armor;
      delete p.ownedWeapons;
    });
    const frozen = JSON.stringify(old);
    const migrated = validateSave(old);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.meals).toBe(6);
    expect(migrated.gold).toBe(old.gold);
    expect(migrated.world).toEqual(old.world);
    expect(migrated.ships[0].tiles).toEqual(
      old.ships[0].tiles.map((t: any) => ({ ...t, damage: 0 })),
    );
    expect(JSON.stringify(old)).toBe(frozen);
  });
  it.each([
    "unlearned duty",
    "skills capacity",
    "unknown weapon",
    "missing owned weapon",
    "armor",
    "meals",
    "dirt",
  ])("rejects malformed %s", (kind) => {
    const s: any = createCampaign();
    if (kind === "unlearned duty") s.pirates[0].duty = "repair";
    if (kind === "skills capacity")
      s.pirates[0].skills = Array(7).fill("guard");
    if (kind === "unknown weapon") s.pirates[0].weapon = "constructor";
    if (kind === "missing owned weapon") s.pirates[0].weapon = "pistol";
    if (kind === "armor") s.pirates[0].armor = 9;
    if (kind === "meals") s.meals = 1000;
    if (kind === "dirt") s.ships[0].dirt = NaN;
    expect(() => validateSave(s)).toThrow();
  });
});

describe("functional ship stations", () => {
  it("relocates the galley transactionally and the cook follows the new station", () => {
    const sim = new Simulation(createCampaign());
    sim.state.meals = 0;
    sim.tick();
    expect(sim.claimCount).toBe(1);
    const stations = sim.state.ships[0].stations.map((t) =>
      t.kind === "food" ? { ...t, x: 11 } : { ...t },
    );
    expect(sim.edit(sim.state.ships[0].tiles, stations)).toBe(null);
    expect(sim.claimCount).toBe(0);
    run(sim, 150);
    expect(sim.state.pirates[1].x).toBe(11);
    expect(sim.state.meals).toBeGreaterThan(0);
    expect(
      checkpoint(sim.state).ships[0].stations.find((t) => t.kind === "food")?.x,
    ).toBe(11);
  });
  it("rejects inaccessible, overlapping or missing stations without applying any refit", () => {
    const sim = new Simulation(createCampaign());
    const before = structuredClone(sim.state.ships[0]);
    const stations = before.stations.map((t) =>
      t.kind === "food" ? { ...t, x: 40 } : { ...t },
    );
    expect(
      sim.edit([...before.tiles, { x: 18, y: 4, kind: "hull" }], stations),
    ).toMatch(/reachable/);
    expect(sim.edit(before.tiles, before.stations.slice(1))).toMatch(/three/);
    expect(
      sim.edit(
        before.tiles,
        before.stations.map((t) => ({ ...t, x: 3, y: 3 })),
      ),
    ).toMatch(/distinct/);
    expect(sim.state.ships[0]).toEqual(before);
    expect(sim.state.parts).toBe(12);
  });
});

describe("content and imported stat bounds", () => {
  it.each([0, 4294967295])(
    "keeps new campaign seeds valid at the unsigned boundary %s",
    (seed) => {
      expect(() => checkpoint(createCampaign(seed))).not.toThrow();
    },
  );
  it("does not exceed armor capacity when upgrading a supported imported stat", () => {
    const sim = new Simulation(
      validateSave({
        ...createCampaign(),
        pirates: createCampaign().pirates.map((p) => ({ ...p, armor: 7 })),
      }),
    );
    expect(sim.armor(3)).toBe(true);
    expect(sim.state.pirates[0].armor).toBe(8);
    expect(() => checkpoint(sim.state)).not.toThrow();
  });
});
