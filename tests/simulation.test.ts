import { describe, expect, it } from "vitest";
import { Simulation } from "../src/sim/engine";
import { createCampaign, starterShip, tileNode } from "../src/sim/model";
import { Navigation, Search, validateLayout } from "../src/sim/navigation";
import {
  checkpoint,
  SaveWriter,
  validateSave,
  SaveBackend,
} from "../src/storage/save";
import { Lifetime } from "../src/app/lifetime";
function run(sim: Simulation, ticks: number) {
  for (let i = 0; i < ticks; i++) sim.tick();
}
function battle(sim: Simulation, id = 1) {
  expect(sim.sail(id)).toBe(true);
  run(sim, 220);
  expect(sim.state.phase).toBe("encounter");
  sim.queue(
    sim.state.pirates.filter((p) => p.side === "ally").map((p) => p.id),
    { action: "board" },
  );
  run(sim, 1600);
  expect(sim.state.phase).toBe("aftermath");
  sim.queue(
    sim.state.pirates
      .filter((p) => p.side === "ally" && p.hp > 0)
      .map((p) => p.id),
    { action: "retreat" },
  );
  run(sim, 250);
  expect(
    sim.finishEncounter(),
    JSON.stringify({
      phase: sim.state.phase,
      location: sim.state.location,
      pirates: sim.state.pirates.map((p) => ({
        name: p.name,
        ship: p.shipId,
        x: p.x,
        y: p.y,
        orders: p.orders,
        hp: p.hp,
      })),
      notice: sim.state.notices.at(-1),
    }),
  ).toBe(true);
}
function island(sim: Simulation, id = 2) {
  expect(sim.sail(id)).toBe(true);
  run(sim, 220);
  const ids = sim.state.pirates
    .filter((p) => p.side === "ally")
    .map((p) => p.id);
  sim.queue(ids, { action: "board" });
  run(sim, 800);
  sim.collect(ids);
  run(sim, 250);
  expect(sim.state.phase).toBe("aftermath");
  sim.queue(ids, { action: "retreat" });
  run(sim, 250);
  expect(sim.finishEncounter()).toBe(true);
}
describe("navigation and transactional edits", () => {
  it("connects upper deck through ladder and rejects a severed ladder", () => {
    const ship = starterShip();
    expect(validateLayout(ship, ship.tiles)).toBe(null);
    const graph = new Navigation(ship);
    const search = new Search(graph, tileNode(3, 3), tileNode(8, 0));
    let used = 0;
    while (!search.done) {
      used += search.advance(2);
    }
    expect(search.path?.at(-1)).toBe(tileNode(8, 0));
    expect(used).toBeLessThan(100);
    expect(
      validateLayout(
        ship,
        ship.tiles.filter((t) => !(t.kind === "ladder" && t.y === 2)),
      ),
    ).toBeTruthy();
  });
  it("rejects disconnected/out-of-bounds and overlapping parts without consuming stock", () => {
    const sim = new Simulation(createCampaign());
    const before = structuredClone(sim.state.ships[0]);
    const parts = sim.state.parts;
    expect(sim.edit([...before.tiles, { x: 40, y: 4, kind: "hull" }])).toMatch(
      /Connect/,
    );
    expect(
      sim.edit([...before.tiles, { x: 64, y: 4, kind: "hull" }]),
    ).toBeTruthy();
    expect(sim.edit([...before.tiles, before.tiles[0]])).toMatch(/overlap/);
    expect(sim.state.ships[0]).toEqual(before);
    expect(sim.state.parts).toBe(parts);
  });
  it("applies a valid refit once, invalidates topology, and keeps pirates safe", () => {
    const sim = new Simulation(createCampaign());
    expect(
      sim.edit([...sim.state.ships[0].tiles, { x: 18, y: 4, kind: "hull" }]),
    ).toBe(null);
    expect(sim.state.parts).toBe(11);
    expect(sim.graphCount).toBe(1);
    sim.queue([3], { action: "move", shipId: 1, node: tileNode(18, 3) });
    run(sim, 200);
    expect(sim.state.pirates[0].x).toBe(18);
    expect(sim.pendingCount).toBe(0);
  });
});
describe("campaign loop and bounded resources", () => {
  it("completes combat, loots once, cleans enemies, and returns to port", () => {
    const sim = new Simulation(createCampaign());
    battle(sim);
    expect(sim.state.phase).toBe("victory");
    const gold = sim.state.gold;
    run(sim, 100);
    expect(sim.state.gold).toBe(gold);
    expect(sim.state.ships.length).toBe(1);
    expect(
      sim.state.pirates.every((p) => p.side === "ally" && p.shipId === 1),
    ).toBe(true);
    expect(sim.pendingCount).toBe(0);
    expect(sim.graphCount).toBe(1);
    expect(sim.sail(0)).toBe(true);
    run(sim, 120);
    expect(sim.state.phase).toBe("port");
    expect(() => validateSave(checkpoint(sim.state))).not.toThrow();
  });
  it("cannot farm already-cleared islands", () => {
    const sim = new Simulation(createCampaign());
    island(sim);
    expect(sim.state.phase).toBe("victory");
    const reward = sim.state.reward;
    sim.sail(0);
    run(sim, 120);
    const before = sim.state.gold;
    sim.sail(2);
    run(sim, 200);
    expect(sim.state.reward).toBe(0);
    expect(sim.state.gold).toBeLessThan(before);
    expect(reward).toBeGreaterThan(0);
  });
  it("requires returning crew before escape and awards no loot", () => {
    const sim = new Simulation(createCampaign());
    sim.sail(1);
    run(sim, 220);
    const gold = sim.state.gold;
    sim.state.pirates[0].shipId = 2;
    expect(sim.escape()).toBe(false);
    sim.state.pirates[0].shipId = 1;
    expect(sim.escape()).toBe(true);
    expect(sim.state.reward).toBe(0);
    expect(sim.state.gold).toBe(gold);
    expect(sim.state.world[1].cleared).toBe(false);
    expect(sim.graphCount).toBe(1);
  });
  it("can reach and defeat the campaign boss with a prepared crew", () => {
    const sim = new Simulation(createCampaign());
    sim.state.gold = 1500;
    sim.state.food = 100;
    for (let i = 0; i < 4; i++) sim.recruit();
    for (const p of sim.state.pirates) sim.upgrade(p.id);
    for (const id of [7, 8, 9, 6]) {
      battle(sim, id);
      if (id !== 6) {
        expect(sim.state.phase).toBe("victory");
        sim.sail(0);
        run(sim, 120);
        sim.rest();
      }
    }
    expect(sim.state.phase).toBe("won");
    expect(sim.state.world[6].cleared).toBe(true);
  });
  it("disposed simulation cannot acquire new work or resources", () => {
    const sim = new Simulation(createCampaign());
    sim.dispose();
    expect(sim.sail(1)).toBe(false);
    expect(sim.recruit()).toBe(false);
    expect(sim.edit(sim.state.ships[0].tiles)).toMatch(/closed/);
    sim.rebuild();
    expect(sim.graphCount).toBe(0);
  });
  it("keeps rewards inside save bounds when the hold and treasury are full", () => {
    const sim = new Simulation(createCampaign());
    sim.state.food = 999;
    sim.state.parts = 999;
    sim.state.gold = 1_000_000_000;
    island(sim);
    expect(sim.state.food).toBe(999);
    expect(sim.state.parts).toBe(999);
    expect(sim.state.gold).toBe(1_000_000_000);
    expect(() => checkpoint(sim.state)).not.toThrow();
    expect(
      sim.state.notices.some((n) => n.text.includes("sold for gold")),
    ).toBe(true);
  });
  it("is deterministic for the same seed and command sequence", () => {
    const a = new Simulation(createCampaign(42)),
      b = new Simulation(createCampaign(42));
    battle(a);
    battle(b);
    expect(a.state).toEqual(b.state);
  });
  it("caps recruitment, incoming commands, notices, and pathfinding work", () => {
    const sim = new Simulation(createCampaign());
    sim.state.gold = 10000;
    for (let i = 0; i < 30; i++) sim.recruit();
    expect(sim.state.pirates.length).toBe(12);
    for (let i = 0; i < 100; i++)
      sim.queue(
        [3],
        { action: "move", shipId: 1, node: tileNode(10, 3) },
        true,
      );
    expect(sim.commandCount).toBe(64);
    run(sim, 1);
    expect(sim.state.pirates[0].orders.length).toBeLessThanOrEqual(8);
    expect(sim.state.notices.length).toBeLessThanOrEqual(64);
    expect(sim.expansions).toBeLessThanOrEqual(2048);
  });
  it("fails an impossible order visibly and leaves no pending search", () => {
    const sim = new Simulation(createCampaign());
    sim.queue([3], { action: "move", shipId: 1, node: tileNode(40, 3) });
    run(sim, 5);
    expect(sim.state.pirates[0].orders.length).toBe(0);
    expect(sim.pendingCount).toBe(0);
    expect(sim.state.notices.at(-1)?.text).toMatch(/reachable/);
  });
  it("keeps a living checkpoint separate from captain death", () => {
    const sim = new Simulation(createCampaign());
    sim.sail(1);
    const safe = checkpoint(sim.state);
    run(sim, 220);
    sim.state.pirates[0].hp = 0;
    run(sim, 1);
    expect(sim.state.phase).toBe("gameover");
    expect(() => checkpoint(sim.state)).toThrow();
    expect(validateSave(safe).pirates[0].hp).toBe(90);
  });
  it("repeated encounter cleanup has bounded counts and idempotent disposal", () => {
    const sim = new Simulation(createCampaign());
    sim.state.food = 999;
    sim.state.gold = 100000;
    for (let i = 0; i < 50; i++) {
      sim.state.phase = "port";
      sim.state.location = 0;
      sim.state.world[1].cleared = false;
      sim.state.ships[0].hp = sim.state.ships[0].maxHp;
      sim.state.meals = 30;
      sim.state.pirates.forEach((p) => {
        p.hp = p.maxHp;
        p.hunger = 100;
      });
      battle(sim);
      expect(sim.graphCount).toBe(1);
      expect(sim.pendingCount).toBe(0);
      expect(sim.state.pirates.length).toBeLessThanOrEqual(12);
    }
    sim.dispose();
    sim.dispose();
    expect(sim.graphCount).toBe(0);
    expect(sim.commandCount).toBe(0);
    expect(sim.pendingCount).toBe(0);
  });
});
describe("save boundary and validation", () => {
  it("round trips supported checkpoints without retaining queued paths", () => {
    const sim = new Simulation(createCampaign());
    sim.queue([3], { action: "move", shipId: 1, node: tileNode(10, 3) });
    run(sim, 2);
    const copy = validateSave(
      JSON.parse(JSON.stringify(checkpoint(sim.state))),
    );
    expect(copy.pirates[0].orders).toEqual([]);
    expect(copy.pirates[0].path).toEqual([]);
    expect(copy.rng).toBe(sim.state.rng);
  });
  it.each(["rng", "hp", "ids", "capacity", "phase", "route"])(
    "rejects malformed %s state",
    (kind) => {
      const s: any = createCampaign();
      if (kind === "rng") s.rng = 0;
      if (kind === "hp") s.pirates[0].hp = NaN;
      if (kind === "ids") s.pirates[1].id = s.pirates[0].id;
      if (kind === "capacity") s.pirates = Array(13).fill(s.pirates[0]);
      if (kind === "phase") s.phase = "encounter";
      if (kind === "route") s.destination = 999;
      expect(() => validateSave(s)).toThrow();
    },
  );
  it("serializes writes and preserves earlier state on backend failure", async () => {
    let stored: unknown;
    let writes = 0;
    let fail = false;
    const backend: SaveBackend = {
      async write(s) {
        writes++;
        await new Promise((r) => setTimeout(r, 3));
        if (fail) throw new Error("quota");
        stored = structuredClone(s);
      },
      async read() {
        return stored;
      },
      close() {},
    };
    const writer = new SaveWriter(backend),
      first = createCampaign(),
      second = createCampaign();
    second.gold = 390;
    await Promise.all([writer.save(first), writer.save(second)]);
    expect((await writer.load()).gold).toBe(390);
    expect(writes).toBe(2);
    fail = true;
    await expect(writer.save(createCampaign())).rejects.toThrow("quota");
    expect((await writer.load()).gold).toBe(390);
    await writer.close();
    await expect(writer.save(first)).rejects.toThrow("closed");
  });
  it("does not let stale references alter an immutable checkpoint", () => {
    const state = createCampaign(),
      saved = checkpoint(state);
    state.pirates[0].hp = 2;
    state.ships[0].tiles.pop();
    expect(saved.pirates[0].hp).toBe(90);
    expect(saved.ships[0].tiles.length).not.toBe(state.ships[0].tiles.length);
  });
  it("releases owned listeners once, even after partial initialization", () => {
    const lifetime = new Lifetime(),
      target = new EventTarget();
    let fired = 0;
    lifetime.listen(target, "tick", () => fired++);
    target.dispatchEvent(new Event("tick"));
    lifetime.dispose();
    lifetime.dispose();
    target.dispatchEvent(new Event("tick"));
    expect(fired).toBe(1);
    expect(lifetime.count).toBe(0);
  });
});
