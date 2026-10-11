import { describe, expect, it } from "vitest";
import { Simulation } from "../src/sim/engine";
import { createCampaign, makePirate, starterShip } from "../src/sim/model";
import { checkpoint, validateSave } from "../src/storage/save";
const run = (sim: Simulation, ticks: number) => {
  for (let i = 0; i < ticks; i++) sim.tick();
};
function encounter() {
  const s = createCampaign();
  s.phase = "aftermath";
  s.ships.push(starterShip(2, true));
  return new Simulation(s);
}
function destroy(sim: Simulation, x: number, shipId = 1) {
  sim.state.ships
    .find((s) => s.id === shipId)!
    .tiles.find((t) => t.x === x && t.y === 4)!.damage = 100;
  sim.refreshStructure(shipId);
}
function overboard(sim: Simulation, id = 4, shipId = 1) {
  const p = sim.state.pirates.find((p) => p.id === id)!;
  p.shipId = shipId;
  p.x = p.previousX = 0;
  p.y = p.previousY = 3;
  destroy(sim, 0, shipId);
  run(sim, 16);
  return p;
}

describe("boarding traversal", () => {
  it("moves across the rope before changing ships, with one reserved crosser", () => {
    const sim = encounter(),
      [a, b] = sim.state.pirates;
    a.x = b.x = 17;
    sim.queue([a.id, b.id], { action: "board" });
    sim.tick();
    expect(sim.crossingCount).toBe(1);
    expect(a.shipId).toBe(1);
    run(sim, 20);
    expect(a.x).toBeGreaterThan(17);
    expect(a.x).toBeLessThan(32);
    expect(
      sim.seaPosition(a.id)!.progress - sim.seaPosition(b.id)!.progress,
    ).toBeCloseTo(0.15);
    run(sim, 80);
    expect(a.shipId).toBe(2);
    expect(b.shipId).toBe(2);
    expect(sim.seaCount).toBe(0);
    sim.dispose();
  });
  it("returns to a surviving origin if the destination landing is destroyed", () => {
    const sim = encounter(),
      p = sim.state.pirates[0];
    p.x = 17;
    sim.queue([p.id], { action: "board" });
    run(sim, 12);
    destroy(sim, 0, 2);
    sim.tick();
    expect([p.shipId, p.x, p.y]).toEqual([1, 17, 3]);
    expect(sim.seaCount).toBe(0);
    expect(p.orders).toHaveLength(0);
    expect(p.status).toMatch(/landing/);
    sim.dispose();
  });
  it("a broken source rope drops the pirate into water and releases its reservation", () => {
    const sim = encounter(),
      p = sim.state.pirates[0];
    p.skills.push("swim");
    p.x = 17;
    sim.queue([p.id], { action: "board" });
    run(sim, 12);
    const position = sim.seaPosition(p.id)!.x;
    destroy(sim, 17);
    sim.tick();
    expect(sim.crossingCount).toBe(0);
    expect(sim.seaPosition(p.id)!.x).toBe(position);
    run(sim, 130);
    expect(p.hp).toBeGreaterThan(0);
    expect(p.shipId).toBe(1);
    expect(sim.seaCount).toBe(0);
    sim.dispose();
  });
  it("saves, escape and prize collection wait for crew to return aboard", () => {
    const sim = encounter(),
      p = sim.state.pirates[0];
    p.x = 17;
    sim.queue([p.id], { action: "board" });
    run(sim, 10);
    const gold = sim.state.gold;
    expect(sim.escape()).toBe(false);
    expect(sim.finishEncounter()).toBe(false);
    expect(() => checkpoint(sim.state)).toThrow();
    expect(sim.state.gold).toBe(gold);
    sim.dispose();
  });
  it("new orders do not teleport a pirate off a crossing", () => {
    const sim = encounter(),
      p = sim.state.pirates[0];
    p.x = 17;
    sim.queue([p.id], { action: "board" });
    run(sim, 10);
    sim.queue([p.id], { action: "retreat" });
    sim.tick();
    expect(sim.crossingCount).toBe(1);
    run(sim, 35);
    expect(p.shipId).toBe(2);
    expect(sim.seaCount).toBe(0);
    sim.dispose();
  });
});

describe("swimming and rescue", () => {
  it("untrained crew tread water instead of dying immediately; a selected crewmate hauls them home", () => {
    const sim = encounter(),
      rescuer = sim.state.pirates[0];
    rescuer.x = 1;
    const p = overboard(sim);
    expect(p.hp).toBeGreaterThan(0);
    expect(sim.swimmerCount).toBe(1);
    expect(sim.rescue([rescuer.id])).toBe(true);
    run(sim, 50);
    expect(p.hp).toBeGreaterThan(0);
    expect([p.shipId, p.y]).toEqual([1, 3]);
    expect(sim.seaCount).toBe(0);
    expect(rescuer.orders).toHaveLength(0);
    sim.dispose();
  });
  it("trained swimmers return home from the other vessel without a rescue command", () => {
    const sim = encounter();
    sim.state.pirates[1].skills.push("swim");
    const p = overboard(sim, 4, 2);
    run(sim, 140);
    expect(p.shipId).toBe(1);
    expect(p.hp).toBeGreaterThan(0);
    expect(sim.seaCount).toBe(0);
    sim.dispose();
  });
  it("unrescued crew die after a bounded exposure interval and release their sea state", () => {
    const sim = encounter(),
      p = overboard(sim);
    run(sim, 260);
    expect(p.hp).toBe(0);
    expect(sim.seaCount).toBe(0);
    expect(p.status).toBe("Lost at sea");
    sim.dispose();
  });
  it("an interrupted line releases its claim and another rescuer can take over", () => {
    const sim = encounter(),
      p = overboard(sim, 4, 2),
      a = sim.state.pirates[0],
      b = sim.state.pirates[2];
    a.x = b.x = 17;
    sim.rescue([a.id]);
    run(sim, 8);
    expect(sim.seaPosition(p.id)!.rescuerId).toBe(a.id);
    sim.queue([a.id], { action: "move", shipId: 1, node: 3 * 64 + 14 });
    sim.tick();
    expect(sim.seaPosition(p.id)!.rescuerId).toBeNull();
    expect(sim.seaPosition(p.id)!.mode).toBe("tread");
    expect(sim.rescue([b.id])).toBe(true);
    run(sim, 80);
    expect(p.shipId).toBe(1);
    expect(p.hp).toBeGreaterThan(0);
    expect(sim.seaCount).toBe(0);
    sim.dispose();
  });
  it("no safe rail keeps a swimmer in the sea until restoration, without repeated path searches", () => {
    const sim = encounter();
    sim.state.pirates[1].skills.push("swim");
    const p = overboard(sim, 4, 2);
    for (const t of sim.state.ships[0].tiles) t.damage = 100;
    sim.state.ships[0].tiles = sim.state.ships[0].tiles.filter(
      (t) => t.kind !== "ladder",
    );
    sim.refreshStructure(1);
    // Home crew must not fall in this fixture; isolate only the water update.
    sim.state.pirates = sim.state.pirates.filter((a) => a.id === p.id);
    p.role = "captain";
    run(sim, 50);
    expect(sim.seaCount).toBe(1);
    expect(sim.pendingCount).toBe(0);
    for (const t of sim.state.ships[0].tiles) t.damage = 0;
    sim.refreshStructure(1);
    run(sim, 140);
    expect(p.shipId).toBe(1);
    expect(sim.seaCount).toBe(0);
    sim.dispose();
  });
  it("only a selected living home crewmate can start a line", () => {
    const sim = encounter(),
      p = overboard(sim);
    expect(sim.rescue([p.id])).toBe(false);
    expect(sim.rescue([])).toBe(false);
    expect(sim.seaCount).toBe(1);
    sim.dispose();
  });
  it("death, cleanup and repeated disposal clear every transit owner", () => {
    const sim = encounter(),
      p = overboard(sim);
    p.hp = 0;
    sim.tick();
    expect(sim.seaCount).toBe(0);
    sim.state.pirates[2].x = 0;
    sim.tick();
    expect(sim.seaCount).toBeGreaterThan(0);
    sim.cleanup();
    expect(sim.seaCount).toBe(0);
    sim.dispose();
    sim.dispose();
    expect(sim.seaCount).toBe(0);
    expect(sim.pendingCount).toBe(0);
  });
});

describe("swimming training and safe saves", () => {
  it("teaches a passive skill without replacing a duty, and rejects duplicate/invalid books", () => {
    const sim = new Simulation(createCampaign()),
      p = sim.state.pirates[1],
      duty = p.duty,
      gold = sim.state.gold;
    expect(sim.teach(p.id, "swim")).toBe(true);
    expect(p.duty).toBe(duty);
    expect(sim.state.gold).toBe(gold - 60);
    expect(sim.teach(p.id, "swim")).toBe(false);
    expect(sim.assignDuty(p.id, "swim" as any)).toBe(false);
    expect(validateSave(checkpoint(sim.state)).pirates[1].skills).toContain(
      "swim",
    );
    sim.dispose();
  });
  it("migrates schema 4 immutably and rejects malformed or repeated swimming skills", () => {
    const old: any = checkpoint(createCampaign());
    old.schemaVersion = 4;
    const before = JSON.stringify(old);
    expect(validateSave(old).schemaVersion).toBe(8);
    expect(JSON.stringify(old)).toBe(before);
    old.pirates[0].skills.push("swim", "swim");
    expect(() => validateSave(old)).toThrow(/identity/);
  });
  it("rest rollback retains sea exposure time and position instead of granting free recovery", () => {
    const sim = new Simulation(createCampaign()),
      p = overboard(sim);
    run(sim, 25);
    const state = structuredClone(sim.state),
      sea = sim.snapshotSea(),
      health = p.hp;
    expect(() => checkpoint(sim.state)).toThrow();
    expect(sim.rest()).toBe(true);
    expect(sim.seaCount).toBe(0);
    sim.dispose();
    const restored = new Simulation(state);
    restored.restoreSea(sea);
    expect(restored.seaPosition(p.id)!.ticks).toBe(sea[0][1].ticks);
    run(restored, 20);
    expect(restored.state.pirates[1].hp).toBeLessThan(health);
    expect(restored.seaCount).toBe(1);
    restored.dispose();
  });
});

describe("bounded sea recovery", () => {
  it("fifty fall/swim/rest cycles release their transient owners and retain one current graph", () => {
    const sim = new Simulation(createCampaign());
    sim.state.gold = 5000;
    sim.state.pirates[1].skills.push("swim");
    for (let i = 0; i < 50; i++) {
      overboard(sim);
      run(sim, 80);
      expect(sim.seaCount).toBe(0);
      expect(sim.pendingCount).toBe(0);
      expect(sim.graphCount).toBe(1);
      expect(sim.rest()).toBe(true);
    }
    expect(sim.state.notices.length).toBeLessThanOrEqual(64);
    sim.dispose();
    expect(sim.seaCount).toBe(0);
  });
  it("all twelve trained allies can recover without more than one landing in a tick", () => {
    const sim = new Simulation(createCampaign());
    sim.state.gold = 50000;
    for (let i = 0; i < 9; i++) sim.recruit();
    for (const p of sim.state.pirates) {
      p.skills.push("swim");
      p.duty = "guard";
      p.x = 0;
      p.y = 3;
    }
    destroy(sim, 0);
    run(sim, 16);
    expect(sim.seaCount).toBe(12);
    for (let i = 0; i < 100; i++) {
      const before = sim.seaCount;
      sim.tick();
      expect(before - sim.seaCount).toBeLessThanOrEqual(1);
    }
    expect(sim.seaCount).toBe(0);
    expect(sim.state.pirates.every((p) => p.hp > 0)).toBe(true);
    sim.dispose();
  });
});

describe("sea and naval combat separation", () => {
  it("incoming deck damage does not choose an overboard crewmate as its onboard victim", () => {
    const sim = encounter(),
      p = overboard(sim);
    const enemy = makePirate(6, 0, "enemy");
    enemy.shipId = 2;
    sim.state.pirates.push(enemy);
    sim.state.nextId = 7;
    const hp = p.hp;
    sim.state.phase = "encounter";
    sim.state.ships[1].cannonCooldown = 0;
    sim.tick();
    expect(sim.state.ships[0].hp).toBe(90);
    expect(p.hp).toBe(hp);
    sim.dispose();
  });
  it("an overboard enemy cannot operate its ship cannon remotely", () => {
    const sim = encounter(),
      enemy = makePirate(6, 0, "enemy");
    enemy.shipId = 2;
    sim.state.pirates.push(enemy);
    sim.state.nextId = 7;
    overboard(sim, 6, 2);
    sim.state.phase = "encounter";
    sim.state.ships[1].cannonCooldown = 0;
    sim.tick();
    expect(sim.state.ships[0].hp).toBe(100);
    expect(sim.seaCount).toBe(1);
    sim.dispose();
  });
});
