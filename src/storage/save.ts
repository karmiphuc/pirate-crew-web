import { Campaign, LIMITS, DUTIES, WEAPONS, TRAITS } from "../sim/model";
import { Navigation, Search, validateLayout } from "../sim/navigation";
import { tileNode } from "../sim/model";
const MAX = 1_000_000_000;
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function bounded(n: unknown, min = 0, max = MAX): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
}
function integer(n: unknown, min = 0, max = MAX): n is number {
  return bounded(n, min, max) && Number.isInteger(n);
}
function text(s: unknown, max = 120): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= max;
}
export function validateSave(value: unknown): Campaign {
  // Migrate the first playable checkpoints without mutating the caller's object.
  if (record(value) && value.schemaVersion === 1) {
    if (
      !Array.isArray(value.ships) ||
      value.ships.length !== 1 ||
      !Array.isArray(value.pirates) ||
      value.pirates.length > LIMITS.allies
    )
      throw new Error("Invalid legacy collections.");
    value = {
      ...value,
      schemaVersion: 2,
      meals: 6,
      ships: value.ships.map((s) =>
        record(s) ? { ...s, kind: "ship", dirt: 0, cannonCooldown: 160 } : s,
      ),
      pirates: value.pirates.map((p) =>
        record(p)
          ? {
              ...p,
              duty: "guard",
              skills: ["guard"],
              weapon: p.role === "gunner" ? "pistol" : "cutlass",
              armor: 0,
              ownedWeapons:
                p.role === "gunner" ? ["cutlass", "pistol"] : ["cutlass"],
            }
          : p,
      ),
    };
  }
  if (record(value) && value.schemaVersion === 2) {
    if (!Array.isArray(value.pirates) || value.pirates.length > LIMITS.allies)
      throw new Error("Invalid legacy crew.");
    value = {
      ...value,
      schemaVersion: 3,
      pirates: value.pirates.map((p) => (record(p) ? { ...p, traits: [] } : p)),
    };
  }
  if (record(value) && value.schemaVersion === 3) {
    if (
      !Array.isArray(value.ships) ||
      value.ships.length !== 1 ||
      !Array.isArray(value.pirates) ||
      value.pirates.length > LIMITS.allies
    )
      throw new Error("Invalid legacy hull or crew.");
    value = {
      ...value,
      schemaVersion: 4,
      // Earlier navigation could cut a ladder corner between two fractional coordinates.
      // Old validation already required that the rounded standing cell be reachable.
      pirates: value.pirates.map((p) => {
        if (
          !record(p) ||
          !bounded(p.x, 0, 63) ||
          !bounded(p.y, 0, 23) ||
          Number.isInteger(p.x) ||
          Number.isInteger(p.y)
        )
          return p;
        const x = Math.round(p.x),
          y = Math.round(p.y);
        return { ...p, x, y, previousX: x, previousY: y };
      }),
      ships: value.ships.map((s) => {
        if (!record(s) || !Array.isArray(s.tiles) || s.tiles.length > 1536)
          throw new Error("Invalid legacy parts.");
        return {
          ...s,
          tiles: s.tiles.map((t) =>
            record(t) && t.damage === 100 ? { ...t, damage: 99 } : t,
          ),
        };
      }),
    };
  }
  if (
    !record(value) ||
    value.schemaVersion !== 4 ||
    !text(value.campaignId) ||
    !["port", "travel", "victory", "won"].includes(String(value.phase))
  )
    throw new Error("Unsupported or unsafe checkpoint.");
  for (const key of [
    "revision",
    "tick",
    "nextId",
    "noticeId",
    "tutorial",
    "travelTicks",
    "reward",
    "location",
  ])
    if (!integer(value[key])) throw new Error(`Invalid ${key}.`);
  if (!integer(value.rng, 1, 4294967295) || !integer(value.nextId, 3))
    throw new Error("Invalid random state or entity counter.");
  for (const key of ["gold", "food", "meals", "ammo", "medicine", "parts"])
    if (!integer(value[key], 0, key === "gold" ? MAX : 999))
      throw new Error(`Invalid inventory: ${key}.`);
  if (
    typeof value.resolved !== "boolean" ||
    !Array.isArray(value.world) ||
    value.world.length < 2 ||
    value.world.length > LIMITS.nodes ||
    !Array.isArray(value.ships) ||
    value.ships.length !== 1 ||
    !Array.isArray(value.pirates) ||
    value.pirates.length < 1 ||
    value.pirates.length > LIMITS.allies ||
    !Array.isArray(value.notices) ||
    value.notices.length > LIMITS.notices
  )
    throw new Error("Checkpoint collections exceed supported bounds.");
  const nodeIds = new Set<number>();
  for (const n of value.world) {
    if (
      !record(n) ||
      !integer(n.id, 0, 63) ||
      nodeIds.has(n.id) ||
      !bounded(n.x, 0, 100) ||
      !bounded(n.y, 0, 100) ||
      !text(n.name) ||
      !["port", "pirate", "island", "boss"].includes(String(n.kind)) ||
      !integer(n.danger, 0, 4) ||
      !integer(n.seed, 0, 4294967295) ||
      typeof n.cleared !== "boolean"
    )
      throw new Error("Invalid world node.");
    nodeIds.add(n.id);
  }
  if (
    !nodeIds.has(value.location as number) ||
    !value.world.some((n) => n.id === 0 && n.kind === "port")
  )
    throw new Error("Missing port or location.");
  if (value.phase === "travel") {
    if (
      !integer(value.destination) ||
      !nodeIds.has(value.destination) ||
      !integer(value.travelTicks, 1, 300)
    )
      throw new Error("Invalid voyage.");
  } else if (value.destination !== null || value.travelTicks !== 0)
    throw new Error("Unexpected active route.");
  const ship = value.ships[0];
  if (
    !record(ship) ||
    ship.id !== 1 ||
    ship.kind !== "ship" ||
    !integer(ship.dirt, 0, 100) ||
    !integer(ship.cannonCooldown, 0, 400) ||
    !text(ship.name) ||
    !integer(ship.revision) ||
    !bounded(ship.hp, 1, 1000) ||
    !bounded(ship.maxHp, ship.hp as number, 1000) ||
    !Array.isArray(ship.tiles) ||
    ship.tiles.length > 1536 ||
    !Array.isArray(ship.stations) ||
    ship.stations.length !== 3
  )
    throw new Error("Invalid ship.");
  for (const t of ship.tiles)
    if (
      !record(t) ||
      !integer(t.x, 0, 63) ||
      !integer(t.y, 1, 23) ||
      !["hull", "ladder"].includes(String(t.kind)) ||
      (t.damage !== undefined &&
        (!integer(t.damage, 0, 100) || (t.kind === "ladder" && t.damage !== 0)))
    )
      throw new Error("Invalid ship part.");
  const stations = new Set<string>();
  const stationNodes = new Set<number>();
  for (const t of ship.stations) {
    if (
      !record(t) ||
      !integer(t.x, 0, 63) ||
      !integer(t.y, 0, 23) ||
      !["food", "medical", "cannon"].includes(String(t.kind)) ||
      stations.has(String(t.kind)) ||
      stationNodes.has(tileNode(t.x as number, t.y as number))
    )
      throw new Error("Invalid station.");
    stations.add(String(t.kind));
    stationNodes.add(tileNode(t.x as number, t.y as number));
  }
  const state = value as unknown as Campaign;
  const layoutError = validateLayout(
    state.ships[0],
    state.ships[0].tiles,
    true,
  );
  if (layoutError) throw new Error(layoutError);
  const graph = new Navigation(state.ships[0]);
  const base = graph.nearest(3, 3);
  const ids = new Set<number>();
  let captains = 0;
  for (const p of value.pirates) {
    if (
      !record(p) ||
      !integer(p.id, 3, (value.nextId as number) - 1) ||
      ids.has(p.id) ||
      !text(p.name) ||
      p.side !== "ally" ||
      p.shipId !== 1 ||
      !DUTIES.includes(p.duty as any) ||
      !Array.isArray(p.skills) ||
      p.skills.length < 1 ||
      p.skills.length > DUTIES.length ||
      p.skills.some((skill) => !DUTIES.includes(skill)) ||
      new Set(p.skills).size !== p.skills.length ||
      !p.skills.includes(p.duty) ||
      !Array.isArray(p.traits) ||
      p.traits.length > 2 ||
      p.traits.some(
        (trait) => typeof trait !== "string" || !Object.hasOwn(TRAITS, trait),
      ) ||
      new Set(p.traits).size !== p.traits.length ||
      (p.traits.includes("hearty") && p.traits.includes("gourmand")) ||
      !Object.hasOwn(WEAPONS, String(p.weapon)) ||
      !Array.isArray(p.ownedWeapons) ||
      p.ownedWeapons.length < 1 ||
      p.ownedWeapons.length > 3 ||
      p.ownedWeapons.some((w) => !Object.hasOwn(WEAPONS, String(w))) ||
      new Set(p.ownedWeapons).size !== p.ownedWeapons.length ||
      !p.ownedWeapons.includes(p.weapon) ||
      !integer(p.armor, 0, 8) ||
      !["captain", "boarder", "gunner", "medic"].includes(String(p.role))
    )
      throw new Error("Invalid crew identity.");
    ids.add(p.id);
    if (p.role === "captain") captains++;
    for (const key of ["x", "previousX"])
      if (!bounded(p[key], 0, 63)) throw new Error("Invalid crew position.");
    for (const key of ["y", "previousY"])
      if (!bounded(p[key], 0, 23)) throw new Error("Invalid crew position.");
    if (!graph.positionSupported(p.x as number, p.y as number))
      throw new Error("Crew must be on supported reachable deck or ladder.");
    const standing = tileNode(
      Math.round(p.x as number),
      Math.round(p.y as number),
    );
    const route = new Search(graph, base, standing);
    route.advance(1536);
    if (!route.path) throw new Error("Crew must be on a reachable deck.");
    if (
      !bounded(p.hp, 1, 1000) ||
      !bounded(p.maxHp, p.hp as number, 1000) ||
      !bounded(p.hunger, 0, 100) ||
      !bounded(p.morale, 0, 100) ||
      !integer(p.level, 1, 100) ||
      !integer(p.xp) ||
      !integer(p.damage, 1, 1000) ||
      !integer(p.cooldown, 0, 100) ||
      !text(p.status) ||
      !Array.isArray(p.orders) ||
      p.orders.length ||
      !Array.isArray(p.path) ||
      p.path.length ||
      p.targetId !== null ||
      !integer(p.pathRevision)
    )
      throw new Error("Invalid crew state.");
  }
  if (captains !== 1) throw new Error("A living captain is required.");
  for (const n of value.notices)
    if (
      !record(n) ||
      !integer(n.id) ||
      !text(n.text, 500) ||
      !["info", "good", "bad"].includes(String(n.tone))
    )
      throw new Error("Invalid journal.");
  // Only explicit fields enter the application. Unknown properties are discarded.
  return {
    schemaVersion: 4,
    campaignId: state.campaignId,
    revision: state.revision,
    tick: state.tick,
    rng: state.rng,
    nextId: state.nextId,
    phase: state.phase,
    ships: state.ships.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      dirt: s.dirt,
      cannonCooldown: s.cannonCooldown,
      hp: s.hp,
      maxHp: s.maxHp,
      revision: s.revision,
      tiles: s.tiles.map((t) => ({
        x: t.x,
        y: t.y,
        kind: t.kind,
        damage: t.damage ?? 0,
      })),
      stations: s.stations.map((t) => ({ x: t.x, y: t.y, kind: t.kind })),
    })),
    pirates: state.pirates.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      duty: p.duty,
      skills: [...p.skills],
      traits: [...p.traits],
      weapon: p.weapon,
      ownedWeapons: [...p.ownedWeapons],
      armor: p.armor,
      side: p.side,
      shipId: p.shipId,
      x: p.x,
      y: p.y,
      previousX: p.previousX,
      previousY: p.previousY,
      hp: p.hp,
      maxHp: p.maxHp,
      hunger: p.hunger,
      morale: p.morale,
      level: p.level,
      xp: p.xp,
      damage: p.damage,
      cooldown: p.cooldown,
      orders: [],
      path: [],
      pathRevision: p.pathRevision,
      status: p.status,
      targetId: null,
    })),
    world: state.world.map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      name: n.name,
      kind: n.kind,
      danger: n.danger,
      cleared: n.cleared,
      seed: n.seed,
    })),
    location: state.location,
    destination: state.destination,
    travelTicks: state.travelTicks,
    gold: state.gold,
    food: state.food,
    meals: state.meals,
    ammo: state.ammo,
    medicine: state.medicine,
    parts: state.parts,
    notices: state.notices.map((n) => ({
      id: n.id,
      text: n.text,
      tone: n.tone,
    })),
    noticeId: state.noticeId,
    resolved: state.resolved,
    reward: state.reward,
    tutorial: state.tutorial,
  };
}
export function checkpoint(state: Campaign): Campaign {
  if (!["port", "travel", "victory", "won"].includes(state.phase))
    throw new Error("Save at port, during travel, or after an encounter.");
  const snapshot = structuredClone(state);
  for (const p of snapshot.pirates) {
    p.orders.length = 0;
    p.path.length = 0;
    p.targetId = null;
    p.status = "On deck";
  }
  return validateSave(snapshot);
}
export type SaveBackend = {
  write(current: Campaign): Promise<void>;
  read(slot: "current" | "previous"): Promise<unknown>;
  close(): void;
};
export class SaveWriter {
  private pending: {
    state: Campaign;
    resolve: () => void;
    reject: (e: unknown) => void;
  } | null = null;
  private running = false;
  private closed = false;
  private idle: (() => void)[] = [];
  constructor(private backend: SaveBackend) {}
  get activeCount() {
    return Number(this.running);
  }
  save(state: Campaign): Promise<void> {
    if (this.closed) return Promise.reject(new Error("Save writer closed."));
    // Backpressure: caller freezes mutating controls until the required write completes.
    if (this.pending) return Promise.reject(new Error("Save queue is full."));
    return new Promise((resolve, reject) => {
      this.pending = { state, resolve, reject };
      void this.drain();
    });
  }
  private async drain() {
    if (this.running) return;
    this.running = true;
    while (this.pending) {
      const item = this.pending;
      this.pending = null;
      try {
        await this.backend.write(item.state);
        item.resolve();
      } catch (e) {
        item.reject(e);
      }
    }
    this.running = false;
    for (const done of this.idle) done();
    this.idle.length = 0;
  }
  async load(slot: "current" | "previous" = "current") {
    await this.settle();
    return validateSave(await this.backend.read(slot));
  }
  async settle() {
    if (this.running)
      await new Promise<void>((resolve) => this.idle.push(resolve));
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.settle();
    this.backend.close();
  }
}
export async function openDatabase(): Promise<SaveBackend> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("pixel-privateer-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("checkpoints");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Close other game tabs to update save storage."));
  });
  db.onversionchange = () => db.close();
  return {
    write(current) {
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction("checkpoints", "readwrite");
        const store = tx.objectStore("checkpoints");
        const old = store.get("current");
        old.onsuccess = () => {
          if (old.result) store.put(old.result, "previous");
          store.put(current, "current");
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () =>
          reject(tx.error ?? new Error("Save transaction aborted."));
      });
    },
    read(slot) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction("checkpoints", "readonly");
        const request = tx.objectStore("checkpoints").get(slot);
        let result: unknown;
        request.onsuccess = () => {
          result = request.result;
        };
        tx.oncomplete = () =>
          result
            ? resolve(result)
            : reject(new Error("No checkpoint in this slot yet."));
        tx.onerror = () => reject(tx.error);
      });
    },
    close() {
      db.close();
    },
  };
}
export async function acquireWriter(): Promise<() => void> {
  if (!navigator.locks)
    throw new Error(
      "This browser needs Web Locks support for safe local saves.",
    );
  return new Promise((resolve, reject) => {
    void navigator.locks
      .request(
        "pixel-privateer-save-writer",
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            reject(
              new Error(
                "Another game tab owns this voyage. Close it, then reload this tab.",
              ),
            );
            return;
          }
          await new Promise<void>((release) => resolve(release));
        },
      )
      .catch(reject);
  });
}
