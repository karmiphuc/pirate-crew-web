import { describe, expect, it } from "vitest";
import { Simulation } from "../src/sim/engine";
import { createCampaign, tileNode } from "../src/sim/model";
import { Navigation, Search } from "../src/sim/navigation";
import { checkpoint, validateSave } from "../src/storage/save";
const run = (sim: Simulation, ticks: number) => {
  for (let i = 0; i < ticks; i++) sim.tick();
};

describe("fishing and trait effects", () => {
  it("fishing supplies the galley without buying food and stops at the crew reserve", () => {
    const sim = new Simulation(createCampaign());
    sim.state.food = 0;
    sim.state.meals = 0;
    sim.teach(3, "fish");
    run(sim, 5000);
    expect(sim.state.meals).toBe(10);
    expect(sim.state.food).toBe(18);
    expect(sim.claimCount).toBe(0);
    expect(sim.taskCount).toBe(0);
    expect(sim.state.notices.length).toBeLessThanOrEqual(64);
    sim.dispose();
  });
  it("one rail slot prevents duplicate catches; commands cancel incomplete work", () => {
    const sim = new Simulation(createCampaign());
    sim.assignDuty(4, "guard");
    sim.teach(3, "fish");
    sim.teach(4, "fish");
    sim.state.food = 0;
    run(sim, 80);
    expect(sim.claimCount).toBe(1);
    expect(sim.state.food).toBe(0);
    sim.queue([3], { action: "move", shipId: 1, node: tileNode(8, 3) });
    sim.tick();
    expect(sim.state.food).toBe(0);
    sim.state.pirates[1].hp = 0;
    sim.tick();
    expect(sim.claimCount).toBe(0);
    expect(sim.pendingCount).toBeLessThanOrEqual(1);
    sim.dispose();
    expect(sim.pendingCount).toBe(0);
  });
  it("swift recruits move faster while existing crew retain their stats", () => {
    const sim = new Simulation(createCampaign());
    expect(sim.recruit()).toBe(true);
    const recruit = sim.state.pirates[3];
    expect(recruit.traits).toEqual(["swift"]);
    expect(sim.state.pirates[0].traits).toEqual([]);
    const normal = new Simulation(createCampaign());
    for (const s of [sim, normal]) {
      const p = s.state.pirates[0];
      s.queue([p.id], { action: "move", shipId: 1, node: tileNode(14, 3) });
    }
    sim.state.pirates[0].traits = ["swift"];
    run(sim, 25);
    run(normal, 25);
    expect(sim.state.pirates[0].x).toBeGreaterThan(normal.state.pirates[0].x);
    sim.dispose();
    normal.dispose();
  });
  it("industrious work completes sooner without duplicating consumed resources", () => {
    const slow = new Simulation(createCampaign());
    const fast = new Simulation(createCampaign());
    for (const sim of [slow, fast]) {
      sim.state.meals = 0;
      sim.state.food = 1;
      sim.state.pirates[1].x = 3;
    }
    fast.state.pirates[1].traits = ["industrious"];
    run(slow, 49);
    run(fast, 49);
    expect(slow.state.meals).toBe(0);
    expect(fast.state.meals).toBe(2);
    run(fast, 100);
    expect(fast.state.meals).toBe(2);
    expect(fast.state.food).toBe(0);
    slow.dispose();
    fast.dispose();
  });
  it("food-use traits affect needs only on active voyages", () => {
    const sim = new Simulation(createCampaign());
    sim.state.meals = 0;
    sim.assignDuty(4, "guard");
    sim.state.pirates[0].traits = ["hearty"];
    sim.state.pirates[1].traits = ["gourmand"];
    run(sim, 100);
    expect(sim.state.pirates.map((p) => p.hunger)).toEqual([100, 100, 100]);
    sim.sail(1);
    run(sim, 100);
    expect(sim.state.pirates.map((p) => p.hunger)).toEqual([94, 92, 93]);
    sim.dispose();
  });
});

describe("localized plank upkeep", () => {
  it("enemy cannon wears a real plank without changing safe deck paths", () => {
    const sim = new Simulation(createCampaign());
    sim.sail(1);
    run(sim, 220);
    sim.state.ships[1].cannonCooldown = 0;
    sim.tick();
    const home = sim.state.ships[0];
    expect(home.tiles.some((t) => (t.damage ?? 0) > 0)).toBe(true);
    const graph = new Navigation(home);
    const search = new Search(graph, tileNode(3, 3), tileNode(17, 3));
    search.advance(1536);
    expect(search.path).not.toBeNull();
    sim.dispose();
  });
  it("repairs the selected plank, not a remote plank damaged mid-job", () => {
    const sim = new Simulation(createCampaign());
    sim.teach(3, "repair");
    sim.assignDuty(4, "guard");
    const first = sim.state.ships[0].tiles.find((t) => t.x === 3 && t.y === 4)!;
    const remote = sim.state.ships[0].tiles.find(
      (t) => t.x === 16 && t.y === 4,
    )!;
    first.damage = 40;
    sim.state.parts = 1;
    sim.tick();
    remote.damage = 100;
    run(sim, 80);
    expect(first.damage).toBe(0);
    expect(remote.damage).toBe(100);
    expect(sim.state.parts).toBe(0);
    expect(sim.claimCount).toBe(0);
    sim.dispose();
  });
  it("refits preserve wear and cannot repair planks by supplying a fresh tile object", () => {
    const sim = new Simulation(createCampaign());
    sim.state.ships[0].tiles[0].damage = 80;
    const tiles = sim.state.ships[0].tiles.map(({ x, y, kind }) => ({
      x,
      y,
      kind,
    }));
    expect(sim.edit(tiles)).toBeNull();
    expect(sim.state.ships[0].tiles[0].damage).toBe(80);
    expect(sim.rest()).toBe(true);
    expect(sim.state.ships[0].tiles.every((t) => !t.damage)).toBe(true);
    sim.dispose();
  });
  it("chooses a work site in the actor's connected component", () => {
    const ship = createCampaign().ships[0];
    ship.tiles = [
      { x: 0, y: 4, kind: "hull" },
      { x: 10, y: 4, kind: "hull" },
    ];
    const graph = new Navigation(ship);
    expect(graph.nearestReachable(10, 3, tileNode(0, 3))).toBe(tileNode(0, 3));
    expect(graph.nearestReachable(10, 3, -1)).toBe(-1);
  });
});

describe("schema 3 checkpoint safety", () => {
  it("migrates v2 without changing its original crew or adding trait advantages", () => {
    const old: any = checkpoint(createCampaign());
    old.schemaVersion = 2;
    for (const p of old.pirates) delete p.traits;
    const before = JSON.stringify(old);
    const migrated = validateSave(old);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.pirates.every((p) => p.traits.length === 0)).toBe(true);
    expect(JSON.stringify(old)).toBe(before);
  });
  it("round-trips wear, learned fishing and traits without sharing mutable arrays", () => {
    const sim = new Simulation(createCampaign());
    sim.recruit();
    sim.teach(3, "fish");
    sim.state.ships[0].tiles[0].damage = 40;
    const saved = validateSave(checkpoint(sim.state));
    expect(saved.ships[0].tiles[0].damage).toBe(40);
    expect(saved.pirates[0].duty).toBe("fish");
    expect(saved.pirates[3].traits).toEqual(["swift"]);
    saved.pirates[3].traits.length = 0;
    expect(sim.state.pirates[3].traits).toEqual(["swift"]);
    sim.dispose();
  });
  it.each([
    "unknown",
    "duplicate",
    "conflict",
    "capacity",
    "missing",
    "wear",
    "ladder",
  ])("rejects malformed %s data before replacing the active game", (kind) => {
    const state: any = checkpoint(createCampaign());
    if (kind === "unknown") state.pirates[0].traits = ["__proto__"];
    if (kind === "duplicate") state.pirates[0].traits = ["swift", "swift"];
    if (kind === "conflict") state.pirates[0].traits = ["hearty", "gourmand"];
    if (kind === "capacity")
      state.pirates[0].traits = ["swift", "hearty", "industrious"];
    if (kind === "missing") delete state.pirates[0].traits;
    if (kind === "wear") state.ships[0].tiles[0].damage = Infinity;
    if (kind === "ladder")
      state.ships[0].tiles.find((t: any) => t.kind === "ladder").damage = 10;
    expect(() => validateSave(state)).toThrow();
  });
});
