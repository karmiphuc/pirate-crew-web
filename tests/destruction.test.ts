import { describe, expect, it } from "vitest";
import { Simulation } from "../src/sim/engine";
import { createCampaign, starterShip, tileNode } from "../src/sim/model";
import { Navigation, Search } from "../src/sim/navigation";
import { checkpoint, validateSave } from "../src/storage/save";
const run = (sim: Simulation, ticks: number) => {
  for (let i = 0; i < ticks; i++) sim.tick();
};
function destroy(sim: Simulation, coords: [number, number][], shipId = 1) {
  const ship = sim.state.ships.find((s) => s.id === shipId)!;
  for (const [x, y] of coords)
    ship.tiles.find((t) => t.x === x && t.y === y)!.damage = 100;
  sim.refreshStructure(shipId);
}
function route(graph: Navigation, start: number, goal: number) {
  const search = new Search(graph, start, goal);
  search.advance(1536);
  return search.path;
}

describe("damaged deck traversal", () => {
  it("jumps a single clear gap and arrives without falling", () => {
    const sim = new Simulation(createCampaign());
    destroy(sim, [[10, 4]]);
    const graph = new Navigation(sim.state.ships[0]);
    expect(graph.nodes.has(tileNode(10, 3))).toBe(false);
    expect(graph.nodes.get(tileNode(9, 3))).toContain(tileNode(11, 3));
    sim.queue([3], { action: "move", shipId: 1, node: tileNode(17, 3) });
    run(sim, 150);
    expect(sim.state.pirates[0].x).toBe(17);
    expect(sim.state.pirates[0].y).toBe(3);
    expect(sim.state.pirates[0].hp).toBe(90);
    expect(sim.fallingCount).toBe(0);
    sim.dispose();
  });
  it("two-cell gaps stop an order without retrying searches indefinitely", () => {
    const sim = new Simulation(createCampaign());
    destroy(sim, [
      [10, 4],
      [11, 4],
    ]);
    sim.queue([3], { action: "move", shipId: 1, node: tileNode(17, 3) });
    run(sim, 100);
    expect(sim.state.pirates[0].x).toBe(3);
    expect(sim.state.pirates[0].orders).toHaveLength(0);
    expect(sim.pendingCount).toBe(0);
    expect(
      sim.state.notices.some((n) => /No reachable route/.test(n.text)),
    ).toBe(true);
    sim.dispose();
  });
  it("low ceilings block the jump even when both landing cells survive", () => {
    const ship = starterShip();
    ship.tiles.find((t) => t.x === 10 && t.y === 4)!.damage = 100;
    ship.tiles.push({ x: 10, y: 2, kind: "hull" });
    const graph = new Navigation(ship);
    expect(graph.nodes.get(tileNode(9, 3))).not.toContain(tileNode(11, 3));
  });
  it("destroying a support under a pirate causes a bounded fall to a lower deck", () => {
    const sim = new Simulation(createCampaign());
    destroy(sim, [[3, 4]]);
    sim.tick();
    expect(sim.fallingCount).toBe(1);
    run(sim, 4);
    const p = sim.state.pirates[0];
    expect([p.x, p.y, p.hp]).toEqual([3, 4, 90]);
    expect(sim.fallingCount).toBe(0);
    sim.dispose();
  });
  it("a longer drop costs health and losing all support ends the captain's attempt", () => {
    const sim = new Simulation(createCampaign());
    const p = sim.state.pirates[0];
    p.x = 6;
    destroy(sim, [
      [6, 4],
      [6, 5],
    ]);
    run(sim, 8);
    expect(p.y).toBe(5);
    expect(p.hp).toBe(82);
    p.x = 0;
    p.y = 3;
    sim.state.phase = "encounter";
    destroy(sim, [[0, 4]]);
    sim.tick();
    expect(p.hp).toBe(0);
    expect(sim.state.phase).toBe("gameover");
    expect(sim.fallingCount).toBe(0);
    sim.dispose();
  });
  it("topology replacement releases work and stale paths while preserving unrelated graphs", () => {
    const sim = new Simulation(createCampaign());
    sim.state.meals = 0;
    sim.tick();
    expect(sim.claimCount).toBe(1);
    destroy(sim, [[3, 4]]);
    expect(sim.claimCount).toBe(0);
    expect(sim.taskCount).toBe(0);
    expect(sim.pendingCount).toBe(0);
    expect(sim.graphCount).toBe(1);
    sim.dispose();
    expect(sim.graphCount).toBe(0);
  });
});

describe("restoration and safe campaign transitions", () => {
  it("repair from below reopens access and places the worker on the restored plank", () => {
    const sim = new Simulation(createCampaign());
    sim.teach(3, "repair");
    destroy(sim, [[3, 4]]);
    run(sim, 95);
    expect(
      sim.state.ships[0].tiles.find((t) => t.x === 3 && t.y === 4)!.damage,
    ).toBe(40);
    expect([sim.state.pirates[0].x, sim.state.pirates[0].y]).toEqual([3, 3]);
    expect(sim.state.pirates[0].hp).toBe(90);
    expect(sim.fallingCount).toBe(0);
    expect(() => checkpoint(sim.state)).not.toThrow();
    sim.dispose();
  });
  it("destroyed galley access neither cooks remotely nor creates repeated failed searches", () => {
    const sim = new Simulation(createCampaign());
    sim.state.meals = 0;
    destroy(sim, [[3, 4]]);
    run(sim, 100);
    expect(sim.state.meals).toBe(0);
    expect(sim.pendingCount).toBe(0);
    expect(sim.claimCount).toBe(0);
    sim.rest();
    run(sim, 150);
    expect(sim.state.meals).toBeGreaterThan(0);
    sim.dispose();
  });
  it("isolated surviving crew block sailing and prize handling without spending resources", () => {
    const sim = new Simulation(createCampaign());
    destroy(sim, [
      [10, 4],
      [11, 4],
    ]);
    sim.state.pirates[2].x = 17;
    const gold = sim.state.gold,
      food = sim.state.food;
    expect(sim.sail(1)).toBe(false);
    expect(sim.state.gold).toBe(gold);
    expect(sim.state.food).toBe(food);
    sim.state.phase = "aftermath";
    sim.state.ships.push(starterShip(2, true));
    expect(sim.finishEncounter()).toBe(false);
    expect(sim.escape()).toBe(false);
    expect(sim.state.gold).toBe(gold);
    sim.dispose();
  });
  it("rejects capture when the prize has lost access to a station", () => {
    const sim = new Simulation(createCampaign());
    sim.state.phase = "aftermath";
    sim.state.ships.push(starterShip(2, true));
    sim.rebuild();
    destroy(sim, [[14, 4]], 2);
    expect(sim.finishEncounter(true)).toBe(false);
    expect(sim.state.ships[0].id).toBe(1);
    expect(sim.state.resolved).toBe(false);
    sim.dispose();
  });
  it("port rest restores structure, clears falls and reopens a severed route", () => {
    const sim = new Simulation(createCampaign());
    destroy(sim, [
      [10, 4],
      [11, 4],
    ]);
    expect(
      route(
        new Navigation(sim.state.ships[0]),
        tileNode(3, 3),
        tileNode(17, 3),
      ),
    ).toBeNull();
    expect(sim.rest()).toBe(true);
    expect(
      route(
        new Navigation(sim.state.ships[0]),
        tileNode(3, 3),
        tileNode(17, 3),
      ),
    ).not.toBeNull();
    expect(sim.fallingCount).toBe(0);
    sim.dispose();
  });
});

describe("schema 4 topology recovery", () => {
  it("migrates old maximum wear without removing an old save's floor", () => {
    const old: any = checkpoint(createCampaign());
    old.schemaVersion = 3;
    old.ships[0].tiles.find((t: any) => t.x === 3 && t.y === 4).damage = 100;
    const before = JSON.stringify(old),
      migrated = validateSave(old);
    expect(migrated.schemaVersion).toBe(4);
    expect(
      migrated.ships[0].tiles.find((t) => t.x === 3 && t.y === 4)!.damage,
    ).toBe(99);
    expect(JSON.stringify(old)).toBe(before);
  });
  it("round-trips destroyed planks and disabled stations if crew are safely reachable", () => {
    const sim = new Simulation(createCampaign());
    sim.state.pirates[0].x = 2;
    destroy(sim, [[3, 4]]);
    const saved = checkpoint(sim.state),
      loaded = validateSave(JSON.parse(JSON.stringify(saved)));
    expect(
      loaded.ships[0].tiles.find((t) => t.x === 3 && t.y === 4)!.damage,
    ).toBe(100);
    expect(new Navigation(loaded.ships[0]).nodes.has(tileNode(3, 3))).toBe(
      false,
    );
    sim.dispose();
  });
  it("rejects an unsupported or isolated crew position before import replacement", () => {
    const sim = new Simulation(createCampaign());
    destroy(sim, [[3, 4]]);
    expect(() => checkpoint(sim.state)).toThrow(/reachable/);
    sim.dispose();
  });
  it("repeated destroy/restore cycles retain only current graphs and no fall owners", () => {
    const sim = new Simulation(createCampaign());
    sim.state.gold = 10000;
    for (let i = 0; i < 50; i++) {
      destroy(sim, [[3, 4]]);
      run(sim, 5);
      sim.rest();
      expect(sim.graphCount).toBe(1);
      expect(sim.pendingCount).toBe(0);
      expect(sim.fallingCount).toBe(0);
    }
    sim.dispose();
    expect(sim.fallingCount).toBe(0);
  });
});

describe("supported checkpoint positions", () => {
  it("does not checkpoint a partial fall or incomplete gap crossing", () => {
    const sim = new Simulation(createCampaign());
    destroy(sim, [[3, 4]]);
    sim.tick();
    expect(sim.state.pirates[0].y).toBeCloseTo(3.3);
    expect(() => checkpoint(sim.state)).toThrow(/supported/);
    sim.rest();
    destroy(sim, [[10, 4]]);
    sim.state.pirates[0].x = 9.4;
    expect(() => checkpoint(sim.state)).toThrow(/supported/);
    sim.dispose();
  });
  it("checkpoint recovery accepts ordinary movement on a supported deck and ladder", () => {
    const state = createCampaign();
    state.pirates[0].x = 3.4;
    state.pirates[1].x = 5;
    state.pirates[1].y = 2.5;
    expect(() => checkpoint(state)).not.toThrow();
  });
  it("a fractional approach reaches the ladder before turning upward", () => {
    const sim = new Simulation(createCampaign());
    const p = sim.state.pirates[0];
    p.x = 4.7;
    sim.queue([3], { action: "move", shipId: 1, node: tileNode(5, 2) });
    run(sim, 2);
    expect(p.y).toBe(3);
    expect(p.x).toBeGreaterThan(4.7);
    run(sim, 40);
    expect([p.x, p.y]).toEqual([5, 2]);
    expect(p.hp).toBe(90);
    sim.dispose();
  });
  it("resting after a fall places crew on the rebuilt floor before saving", () => {
    const sim = new Simulation(createCampaign());
    destroy(sim, [[3, 4]]);
    run(sim, 4);
    expect(sim.state.pirates[0].y).toBe(4);
    sim.rest();
    expect(sim.state.pirates[0].y).toBe(3);
    expect(() => checkpoint(sim.state)).not.toThrow();
    sim.dispose();
  });
});

describe("disabled gunnery and recovery rollback", () => {
  it("a destroyed player cannon rejects the order and releases its owner", () => {
    const sim = new Simulation(createCampaign());
    sim.sail(1);
    run(sim, 220);
    sim.assignDuty(5, "guard");
    destroy(sim, [[14, 4]]);
    const ammo = sim.state.ammo;
    sim.queue([5], { action: "cannon" });
    run(sim, 10);
    expect(sim.state.ammo).toBe(ammo);
    expect(sim.state.pirates[2].orders).toHaveLength(0);
    expect(
      sim.state.notices.some((n) => /No reachable cannon station/.test(n.text)),
    ).toBe(true);
    sim.dispose();
  });
  it("a destroyed enemy cannon cannot fire through missing station support", () => {
    const sim = new Simulation(createCampaign());
    sim.sail(1);
    run(sim, 220);
    sim.assignDuty(5, "guard");
    destroy(sim, [[14, 4]], 2);
    sim.state.ships[1].cannonCooldown = 0;
    const health = sim.state.ships[0].hp;
    run(sim, 100);
    expect(sim.state.ships[0].hp).toBe(health);
    sim.dispose();
  });
  it("transient fall rollback preserves the original drop damage after a failed repair transaction", () => {
    const sim = new Simulation(createCampaign());
    sim.state.pirates[0].x = 6;
    destroy(sim, [
      [6, 4],
      [6, 5],
    ]);
    run(sim, 5);
    const before = structuredClone(sim.state),
      falls = sim.snapshotFalls();
    sim.rest();
    sim.dispose();
    const restored = new Simulation(before);
    restored.restoreFalls(falls);
    run(restored, 5);
    expect(restored.state.pirates[0].hp).toBe(82);
    expect(restored.fallingCount).toBe(0);
    restored.dispose();
  });
});

describe("legacy corner checkpoint migration", () => {
  it("keeps a formerly valid diagonal ladder sample loadable without floating on reload", () => {
    const old: any = checkpoint(createCampaign());
    old.schemaVersion = 3;
    old.pirates[0].x = 4.8;
    old.pirates[0].y = 2.7;
    const before = JSON.stringify(old),
      migrated = validateSave(old);
    expect([migrated.pirates[0].x, migrated.pirates[0].y]).toEqual([5, 3]);
    expect(JSON.stringify(old)).toBe(before);
    const sim = new Simulation(migrated);
    run(sim, 5);
    expect(sim.state.pirates[0].hp).toBe(90);
    expect(sim.fallingCount).toBe(0);
    sim.dispose();
  });
});
