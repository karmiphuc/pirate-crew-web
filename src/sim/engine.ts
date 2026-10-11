import { SeaTransit, seaX, WATER_Y, SEA_TIMEOUT, inWater } from "./sea";
import {
  Campaign,
  FurnitureKind,
  FURNISHINGS,
  FURNITURE_KINDS,
  FURNITURE_STOCK_CAP,
  Duty,
  DUTIES,
  Skill,
  SKILLS,
  DUTY_NAMES,
  Weapon,
  WEAPONS,
  islandTerrain,
  InputCommand,
  LIMITS,
  makePirate,
  notify,
  Order,
  Pirate,
  random,
  Tile,
  tileNode,
  nodeX,
  nodeY,
} from "./model";
import { validateFurniture, furnitureSupported } from "./furniture";
import { encounterShip } from "./ship-templates";
import {
  ITEMS,
  ITEM_KINDS,
  ITEM_STOCK_CAP,
  type ItemKind,
  encounterLoot,
  itemEffectReason,
  awardExperience,
  ACCESSORY_KINDS,
  type Accessory,
} from "./items";
import { weaponForTarget, clearShot } from "./equipment";
import {
  SKILL_NAMES,
  SKILL_RANK_CAP,
  BOOK_STOCK_CAP,
  BOOK_PRICE,
  SKILL_POINT_COST,
  skillRate,
  workUnits,
  WORK_UNITS_PER_TICK,
} from "./skills";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_CAP,
  ATTRIBUTE_INFO,
  CREW_GROUPS,
  attackDamage,
  attackCooldown,
  type Attribute,
  type CrewGroup,
} from "./progression";
import { Navigation, Search, validateLayout, intact } from "./navigation";
export class Simulation {
  private commands: InputCommand[] = [];
  private graphs = new Map<number, Navigation>();
  private searches = new Map<number, Search>();
  private tasks = new Map<
    number,
    { duty: Duty; goal: number; progressUnits: number; plank?: number }
  >();
  private claims = new Map<string, number>();
  private falls = new Map<number, number>();
  private sea = new Map<number, SeaTransit>();
  private lastRopeStart = -6;
  disposed = false;
  expansions = 0;
  constructor(readonly state: Campaign) {
    this.rebuild();
  }
  rebuild() {
    if (this.disposed) return;
    this.graphs.clear();
    this.searches.clear();
    for (const ship of this.state.ships)
      this.graphs.set(ship.id, new Navigation(ship));
  }
  /** Called once when a plank crosses the destroyed/intact boundary. */
  refreshStructure(shipId: number) {
    if (this.disposed) return;
    const ship = this.state.ships.find((s) => s.id === shipId);
    if (!ship) return;
    ship.revision++;
    this.graphs.set(shipId, new Navigation(ship));
    for (const p of this.state.pirates)
      if (p.shipId === shipId) this.clearOrder(p);
  }
  snapshotFalls(): [number, number][] {
    return [...this.falls];
  }
  restoreFalls(entries: readonly [number, number][]) {
    if (this.disposed) return;
    this.falls.clear();
    for (const [id, origin] of entries.slice(
      0,
      LIMITS.allies + LIMITS.enemies,
    )) {
      if (
        Number.isFinite(origin) &&
        origin >= 0 &&
        origin < LIMITS.height &&
        this.state.pirates.some((p) => p.id === id && p.hp > 0)
      )
        this.falls.set(id, origin);
    }
  }
  get seaCount() {
    return this.sea.size;
  }
  get swimmerCount() {
    let count = 0;
    for (const transit of this.sea.values()) if (inWater(transit)) count++;
    return count;
  }
  get crossingCount() {
    let count = 0;
    for (const transit of this.sea.values())
      if (transit.mode === "rope") count++;
    return count;
  }
  private ropeDirectionAvailable(shipId: number) {
    for (const transit of this.sea.values())
      if (transit.mode === "rope" && transit.originShip !== shipId)
        return false;
    return true;
  }
  seaPosition(id: number): Readonly<SeaTransit> | undefined {
    return this.sea.get(id);
  }
  snapshotSea(): [number, SeaTransit][] {
    return [...this.sea].map(([id, transit]) => [id, { ...transit }]);
  }
  restoreSea(entries: readonly [number, SeaTransit][]) {
    if (this.disposed) return;
    this.sea.clear();
    for (const [id, transit] of entries.slice(
      0,
      LIMITS.allies + LIMITS.enemies,
    )) {
      if (
        this.state.pirates.some((p) => p.id === id && p.hp > 0) &&
        ["rope", "fall", "swim", "tread", "rescue", "climb"].includes(
          transit.mode,
        ) &&
        [
          transit.x,
          transit.y,
          transit.previousX,
          transit.previousY,
          transit.progress,
          transit.ticks,
        ].every(Number.isFinite)
      )
        this.sea.set(id, { ...transit });
    }
  }
  private landing(shipId: number, worldX: number) {
    const graph = this.graphs.get(shipId);
    if (!graph) return -1;
    return graph.nearestReachable(
      worldX - seaX(shipId, 0),
      3,
      graph.nearest(3, 3),
    );
  }
  private startSea(p: Pirate, mode: "rope" | "fall", targetShip: number) {
    if (this.sea.size >= LIMITS.allies + LIMITS.enemies) {
      this.state.phase = "gameover";
      notify(
        this.state,
        "Sea traversal capacity exceeded. Restore the checkpoint.",
        "bad",
      );
      return;
    }
    const targetNode =
      mode === "rope"
        ? this.landing(targetShip, seaX(targetShip, targetShip === 1 ? 17 : 0))
        : -1;
    if (mode === "rope" && targetNode === -1) {
      this.finish(p, "No safe boarding landing");
      return;
    }
    this.clearOrder(p);
    if (mode === "fall") p.orders.length = 0;
    const x = seaX(p.shipId, p.x),
      y = Math.min(WATER_Y, p.y);
    if (mode === "rope") this.lastRopeStart = this.state.tick;
    this.sea.set(p.id, {
      mode,
      x,
      y,
      previousX: x,
      previousY: y,
      startX: x,
      startY: y,
      originShip: p.shipId,
      originNode: tileNode(Math.round(p.x), Math.round(p.y)),
      targetShip,
      targetNode,
      targetRevision:
        mode === "fall"
          ? -1
          : (this.graphs.get(targetShip)?.ship.revision ?? -1),
      ticks: 0,
      progress: 0,
      rescuerId: null,
    });
    p.status = mode === "rope" ? "Crossing boarding rope" : "Falling overboard";
    if (mode === "fall")
      notify(
        this.state,
        `${p.name} fell overboard. Trained swimmers return aboard; others need a rescue line.`,
        "bad",
      );
  }
  private landSea(p: Pirate, transit: SeaTransit) {
    if (this.landingUsed) return;
    this.landingUsed = true;
    const node = transit.targetNode;
    p.shipId = transit.targetShip;
    p.x = p.previousX = nodeX(node);
    p.y = p.previousY = nodeY(node);
    this.sea.delete(p.id);
    if (transit.mode === "rope")
      this.finish(p, p.shipId === 1 ? "Back aboard" : "Engaging enemy");
    else {
      this.clearOrder(p);
      p.orders.length = 0;
      p.status = "Recovered aboard";
      notify(this.state, `${p.name} is safely back aboard.`, "good");
    }
  }
  private syncSea(p: Pirate, transit: SeaTransit) {
    p.x = transit.x - seaX(p.shipId, 0);
    p.y = transit.y;
  }
  private updateSea(p: Pirate, transit: SeaTransit) {
    transit.previousX = transit.x;
    transit.previousY = transit.y;
    transit.ticks++;
    const graph = this.graphs.get(transit.targetShip);
    if (transit.mode === "rope") {
      const origin = this.graphs.get(transit.originShip);
      if (!origin?.nodes.has(transit.originNode)) {
        transit.mode = "fall";
        transit.ticks = 0;
        transit.targetShip = p.side === "ally" ? 1 : p.shipId;
        transit.targetRevision = -1;
        p.orders.length = 0;
        notify(
          this.state,
          `${p.name}: boarding rope lost its support. Send a rescue line.`,
          "bad",
        );
      } else if (
        !graph?.nodes.has(transit.targetNode) ||
        !graph.connected(graph.nearest(3, 3), transit.targetNode)
      ) {
        p.x = p.previousX = nodeX(transit.originNode);
        p.y = p.previousY = nodeY(transit.originNode);
        this.sea.delete(p.id);
        this.finish(p, "No safe boarding landing; returned to the origin rail");
        return;
      } else {
        transit.progress = Math.min(1, transit.ticks / 40);
        const goalX = seaX(transit.targetShip, nodeX(transit.targetNode)),
          goalY = nodeY(transit.targetNode);
        transit.x =
          transit.startX + (goalX - transit.startX) * transit.progress;
        transit.y =
          transit.startY +
          (goalY - transit.startY) * transit.progress +
          Math.sin(Math.PI * transit.progress) * 0.6;
        this.syncSea(p, transit);
        p.status = "Crossing boarding rope";
        if (transit.progress === 1) this.landSea(p, transit);
        return;
      }
    }
    if (transit.mode === "fall") {
      transit.y = Math.min(WATER_Y, transit.y + 0.3);
      this.syncSea(p, transit);
      p.status = "Falling overboard";
      if (transit.y >= WATER_Y) {
        transit.mode = p.skills.includes("swim") ? "swim" : "tread";
        transit.ticks = 0;
      }
      return;
    }
    if (transit.targetRevision !== (graph?.ship.revision ?? -1)) {
      const previousLanding = transit.targetNode;
      transit.targetNode = this.landing(transit.targetShip, transit.x);
      transit.targetRevision = graph?.ship.revision ?? -1;
      if (transit.mode === "climb" && transit.targetNode !== previousLanding) {
        transit.mode = p.skills.includes("swim") ? "swim" : "tread";
        transit.y = WATER_Y;
        this.syncSea(p, transit);
      }
    }
    if (transit.rescuerId !== null) {
      const rescuer = this.state.pirates.find(
        (actor) => actor.id === transit.rescuerId,
      );
      if (
        !rescuer ||
        rescuer.hp <= 0 ||
        rescuer.shipId !== 1 ||
        this.sea.has(rescuer.id) ||
        rescuer.orders[0]?.action !== "rescue" ||
        rescuer.orders[0].targetId !== p.id
      ) {
        transit.rescuerId = null;
        transit.mode = p.skills.includes("swim") ? "swim" : "tread";
        notify(this.state, `${p.name}'s rescue line was interrupted.`, "bad");
      }
    }
    if (transit.ticks % 20 === 0 && transit.mode !== "climb")
      p.hp = Math.max(
        0,
        p.hp - (p.skills.includes("swim") || transit.mode === "rescue" ? 1 : 8),
      );
    if (p.hp === 0 || transit.ticks >= SEA_TIMEOUT) {
      p.hp = 0;
      this.sea.delete(p.id);
      this.clearOrder(p);
      p.orders.length = 0;
      p.status = "Lost at sea";
      notify(this.state, `${p.name} was lost at sea.`, "bad");
      return;
    }
    if (transit.mode === "climb") {
      if (!graph?.nodes.has(transit.targetNode)) {
        transit.mode = p.skills.includes("swim") ? "swim" : "tread";
        transit.targetNode = -1;
        transit.targetRevision = -1;
        transit.y = WATER_Y;
        this.syncSea(p, transit);
        return;
      }
      transit.y = Math.max(
        nodeY(transit.targetNode),
        transit.y -
          0.25 * (p.skills.includes("swim") ? skillRate(p, "swim") : 1),
      );
      this.syncSea(p, transit);
      p.status = "Climbing back aboard";
      if (transit.y === nodeY(transit.targetNode)) this.landSea(p, transit);
      return;
    }
    p.status =
      transit.mode === "rescue"
        ? "Rescue line hauling"
        : transit.mode === "swim"
          ? "Swimming back aboard"
          : "Treading water · needs rescue";
    if (
      transit.targetNode !== -1 &&
      (transit.mode === "swim" || transit.mode === "rescue")
    ) {
      const goalX = seaX(transit.targetShip, nodeX(transit.targetNode)),
        dx = goalX - transit.x;
      const speed =
        transit.mode === "rescue" ? 0.4 : 0.2 * skillRate(p, "swim");
      transit.x += Math.sign(dx) * Math.min(Math.abs(dx), speed);
      this.syncSea(p, transit);
      if (transit.x === goalX) {
        transit.mode = "climb";
        transit.rescuerId = null;
      }
    }
  }
  rescue(ids: readonly number[]) {
    if (this.disposed) return false;
    const target = this.state.pirates.find(
      (p) => p.side === "ally" && p.hp > 0 && inWater(this.sea.get(p.id)),
    );
    const rescuer = this.state.pirates.find(
      (p) =>
        ids.includes(p.id) &&
        p.side === "ally" &&
        p.hp > 0 &&
        p.shipId === 1 &&
        !this.sea.has(p.id),
    );
    if (!target || !rescuer) {
      notify(
        this.state,
        "Select a pirate aboard the home ship to rescue an overboard crewmate.",
        "bad",
      );
      return false;
    }
    return this.queue([rescuer.id], { action: "rescue", targetId: target.id });
  }
  private updateRescuer(p: Pirate, targetId: number | undefined) {
    const transit = targetId === undefined ? undefined : this.sea.get(targetId);
    const target = this.state.pirates.find(
      (actor) => actor.id === targetId && actor.side === "ally" && actor.hp > 0,
    );
    if (!transit || !target) {
      this.finish(p, "Rescue complete");
      return;
    }
    if (transit.mode === "climb") {
      this.finish(p, "Crewmate is climbing aboard");
      return;
    }
    if (p.shipId !== 1 || !inWater(transit)) {
      this.finish(p, "No crewmate in reach of a rescue line");
      return;
    }
    if (transit.rescuerId !== null && transit.rescuerId !== p.id) {
      this.finish(p, "No free rescue line; another pirate is hauling");
      return;
    }
    const goal = this.graph(1).nearestReachable(
      transit.x,
      3,
      this.graph(1).nearest(p.x, p.y),
    );
    if (goal === -1) {
      this.finish(p, "No reachable rail for rescue");
      return;
    }
    if (Math.abs(p.x - nodeX(goal)) + Math.abs(p.y - nodeY(goal)) < 0.05) {
      transit.rescuerId = p.id;
      transit.mode = "rescue";
      transit.targetShip = 1;
      transit.targetNode = goal;
      transit.targetRevision = this.graph(1).ship.revision;
      p.targetId = target.id;
      p.status = "Hauling rescue line";
    } else if (!this.follow(p)) this.requestPath(p, goal);
  }

  get fallingCount() {
    return this.falls.size;
  }
  private unsupported(p: Pirate) {
    const graph = this.graph(p.shipId);
    if (graph.jumping(p.x, p.y, p.path[0])) return false;
    if (!this.falls.has(p.id) && graph.positionSupported(p.x, p.y))
      return false;
    if (!this.falls.has(p.id)) {
      this.falls.set(p.id, p.y);
      this.clearOrder(p);
    }
    const x = Math.round(p.x);
    let landing = Infinity;
    for (const n of graph.nodes.keys())
      if (nodeX(n) === x && nodeY(n) >= p.y - 0.01)
        landing = Math.min(landing, nodeY(n));
    if (!Number.isFinite(landing)) {
      this.falls.delete(p.id);
      this.startSea(p, "fall", p.side === "ally" ? 1 : p.shipId);
      return true;
    }
    p.x = x;
    p.y = Math.min(landing, p.y + 0.3);
    p.status = "Falling to the lower deck";
    if (p.y === landing) {
      const drop = landing - this.falls.get(p.id)!;
      this.falls.delete(p.id);
      p.hp = Math.max(0, p.hp - Math.max(0, Math.ceil(drop - 1)) * 8);
      p.status = "Landed on lower deck";
    }
    return true;
  }
  private safeHome() {
    const graph = this.graph(1),
      base = graph.nearest(3, 3);
    return (
      base !== -1 &&
      this.state.pirates
        .filter((p) => p.side === "ally" && p.hp > 0)
        .every(
          (p) =>
            p.shipId === 1 &&
            !this.falls.has(p.id) &&
            !this.sea.has(p.id) &&
            graph.positionSupported(p.x, p.y) &&
            graph.connected(base, tileNode(Math.round(p.x), Math.round(p.y))),
        )
    );
  }
  get graphCount() {
    return this.graphs.size;
  }
  get pendingCount() {
    return this.searches.size;
  }
  get taskCount() {
    return this.tasks.size;
  }
  get claimCount() {
    return this.claims.size;
  }
  get commandCount() {
    return this.commands.length;
  }
  private touch() {
    this.state.revision++;
  }
  private graph(id: number) {
    return this.graphs.get(id)!;
  }
  queue(ids: number[], order: Order, queue = false) {
    if (this.disposed) return false;
    if (ids.length === 0) {
      notify(this.state, "Select living crew before issuing an order.", "bad");
      return false;
    }
    if (!["port", "encounter", "aftermath"].includes(this.state.phase)) {
      notify(
        this.state,
        "Orders are available in port or at an encounter.",
        "bad",
      );
      return false;
    }
    if (this.commands.length >= LIMITS.commands) {
      notify(this.state, "Command queue full. Let your crew catch up.", "bad");
      return false;
    }
    this.commands.push({
      ids: ids.slice(0, LIMITS.allies),
      order: { ...order },
      queue,
    });
    return true;
  }
  private clearOrder(p: Pirate) {
    this.releaseWork(p);
    this.searches.delete(p.id);
    p.path.length = 0;
    p.targetId = null;
  }
  private processCommands() {
    for (const c of this.commands)
      for (const id of c.ids) {
        const p = this.state.pirates.find(
          (p) => p.id === id && p.side === "ally" && p.hp > 0,
        );
        if (!p) continue;
        if (this.sea.has(p.id)) {
          notify(
            this.state,
            `${p.name}: finish the crossing or return aboard before taking new orders.`,
            "bad",
          );
          continue;
        }
        if (
          c.order.action === "board" &&
          !["encounter", "aftermath"].includes(this.state.phase)
        ) {
          notify(this.state, "No vessel or island to board.", "bad");
          continue;
        }
        if (c.queue && p.orders.length >= LIMITS.orders) {
          notify(this.state, `${p.name}: order queue full.`, "bad");
          continue;
        }
        if (!c.queue) {
          p.orders.length = 0;
          this.clearOrder(p);
        }
        p.orders.push({ ...c.order });
        p.status = `${c.order.action === "board" ? "Boarding" : c.order.action === "retreat" ? "Returning" : "Order received"}…`;
      }
    this.commands.length = 0;
  }
  private requestPath(p: Pirate, goal: number) {
    const graph = this.graph(p.shipId);
    const start = graph.nearest(p.x, p.y);
    if (start === goal) {
      p.path = [goal];
      p.pathRevision = graph.ship.revision;
      return;
    }
    if (!this.searches.has(p.id)) {
      this.searches.set(p.id, new Search(graph, start, goal));
      p.status = "Finding a route…";
    }
  }
  private follow(p: Pirate) {
    if (!p.path.length) return false;
    const graph = this.graph(p.shipId);
    if (p.pathRevision !== graph.ship.revision) {
      p.path.length = 0;
      this.searches.delete(p.id);
      return false;
    }
    const next = p.path[0];
    if (!graph.nodes.has(next)) {
      p.path.length = 0;
      p.status = "Deck access lost";
      return false;
    }
    const x = nodeX(next),
      y = nodeY(next);
    const dx = x - p.x,
      dy = y - p.y;
    const d = Math.hypot(dx, dy);
    const speed =
      0.16 *
      (p.traits.includes("swift") ? 1.2 : 1) *
      (p.accessory === "boots" ? 1.25 : 1);
    if (d <= speed) {
      p.x = x;
      p.y = y;
      p.path.shift();
    } else {
      p.x += (dx / d) * speed;
      p.y += (dy / d) * speed;
    }
    return true;
  }
  private nearestEnemy(p: Pirate) {
    let target: Pirate | null = null,
      distance = Infinity;
    for (const e of this.state.pirates)
      if (
        e.side !== p.side &&
        e.hp > 0 &&
        e.shipId === p.shipId &&
        !this.sea.has(e.id)
      ) {
        const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
        if (d < distance) {
          distance = d;
          target = e;
        }
      }
    return target;
  }
  private transfer(p: Pirate, shipId: number) {
    const graph = this.graph(shipId);
    const node = graph.nearestReachable(
      shipId === 1 ? 17 : 0,
      3,
      graph.nearest(3, 3),
    );
    if (node === -1) {
      this.state.phase = "gameover";
      notify(
        this.state,
        "No safe deck remains. Restore your checkpoint.",
        "bad",
      );
      return;
    }
    this.clearOrder(p);
    p.shipId = shipId;
    p.x = nodeX(node);
    p.y = nodeY(node);
    p.previousX = p.x;
    p.previousY = p.y;
  }
  private updatePirate(p: Pirate) {
    if (p.hp <= 0) {
      this.falls.delete(p.id);
      this.sea.delete(p.id);
      this.clearOrder(p);
      p.orders.length = 0;
      return;
    }
    p.previousX = p.x;
    p.previousY = p.y;
    const transit = this.sea.get(p.id);
    if (transit) {
      this.updateSea(p, transit);
      return;
    }
    if (this.unsupported(p)) return;
    if (p.cooldown > 0) p.cooldown--;
    const order = p.orders[0];
    if (order?.action === "rescue") {
      this.updateRescuer(p, order.targetId);
      return;
    }
    if (order?.action === "cannon") {
      if (
        this.state.phase !== "encounter" ||
        p.shipId !== 1 ||
        this.state.ships[1]?.kind !== "ship"
      ) {
        this.finish(p, "No enemy ship in cannon range");
        return;
      }
      this.updateWork(p, "gunner", true);
      return;
    }
    if (order?.action === "collect") {
      if (
        this.state.phase === "aftermath" &&
        this.state.ships[1]?.kind === "island"
      ) {
        this.finish(p, "Treasure secured by crew");
        return;
      }
      if (
        p.shipId !== 2 ||
        this.state.ships[1]?.kind !== "island" ||
        this.state.phase !== "encounter"
      ) {
        this.finish(p, "No island treasure within reach");
        return;
      }
      if (this.state.pirates.some((e) => e.side === "enemy" && e.hp > 0)) {
        this.finish(p, "No access: defeat the island guards first");
        return;
      }
      const goal = tileNode(14, 3);
      if (Math.abs(p.x - 14) + Math.abs(p.y - 3) < 0.05) {
        this.state.phase = "aftermath";
        this.commands.length = 0;
        notify(
          this.state,
          `${p.name} secured the treasure chest. Return the crew to your ship, then collect the spoils.`,
          "good",
        );
        this.finish(p, "Treasure secured");
      } else if (!this.follow(p)) this.requestPath(p, goal);
      return;
    }
    if (order?.action === "move") {
      if (
        order.shipId !== p.shipId ||
        order.node === undefined ||
        !this.graph(p.shipId).nodes.has(order.node)
      ) {
        this.finish(p, "No reachable deck at that location");
        return;
      }
      if (
        Math.abs(p.x - nodeX(order.node)) + Math.abs(p.y - nodeY(order.node)) <
        0.05
      ) {
        p.x = nodeX(order.node);
        p.y = nodeY(order.node);
        this.finish(p, "At position");
      } else {
        if (!this.follow(p)) this.requestPath(p, order.node);
      }
      return;
    }
    if (order?.action === "board" || order?.action === "retreat") {
      const targetShip = order.action === "board" ? 2 : 1;
      if (p.shipId === targetShip) {
        this.finish(p, targetShip === 2 ? "Engaging enemy" : "Back aboard");
        return;
      }
      const goal = this.graph(p.shipId).nearest(p.shipId === 1 ? 17 : 0, 3);
      if (Math.abs(p.x - nodeX(goal)) + Math.abs(p.y - nodeY(goal)) < 0.05) {
        // One transfer per tick reserves the landing for this traversal.
        if (!this.landingUsed) {
          this.landingUsed = true;
          if (
            this.state.tick - this.lastRopeStart >= 6 &&
            this.ropeDirectionAvailable(p.shipId)
          )
            this.startSea(p, "rope", targetShip);
          else p.status = "Waiting for boarding rope";
        }
      } else {
        if (!this.follow(p)) this.requestPath(p, goal);
      }
      return;
    }
    if (
      !order &&
      p.side === "ally" &&
      p.shipId === 1 &&
      !this.nearestEnemy(p) &&
      this.updateWork(p, p.duty)
    )
      return;
    if (this.state.phase !== "encounter") {
      this.follow(p);
      if (!p.orders.length) p.status = "On deck";
      return;
    }
    if (p.side === "enemy" && p.shipId === 2 && !this.nearestEnemy(p)) {
      p.status = "Defending ship";
      return;
    }
    let target =
      order?.targetId !== undefined
        ? (this.state.pirates.find(
            (e) =>
              e.id === order.targetId &&
              e.hp > 0 &&
              e.side !== p.side &&
              !this.sea.has(e.id),
          ) ?? null)
        : this.nearestEnemy(p);
    if (order?.action === "attack" && !target) {
      this.finish(p, "Target defeated");
      return;
    }
    if (!target || target.shipId !== p.shipId) {
      p.status = p.shipId === 1 ? "Ready to board" : "Holding position";
      return;
    }
    this.releaseWork(p);
    p.targetId = target.id;
    const distance = Math.abs(target.x - p.x) + Math.abs(target.y - p.y);
    if (p.cooldown === 0) p.weapon = weaponForTarget(p, distance);
    const weapon = WEAPONS[p.weapon];
    const ranged = weapon.range > 2;
    if (
      distance <= weapon.range &&
      Math.abs(target.y - p.y) < 0.6 &&
      (!ranged ||
        clearShot(this.state.ships.find((s) => s.id === p.shipId)!, p, target))
    ) {
      this.searches.delete(p.id);
      p.path.length = 0;
      p.status = ranged ? "Firing pistol" : "Fighting";
      if (p.cooldown === 0) {
        const roll = Math.floor(random(this.state) * 4);
        // Zero luck retains the original RNG sequence. Blocked shots consume neither roll.
        const critical =
          p.attributes.luck > 0 && random(this.state) < p.attributes.luck / 200;
        const damage = Math.max(
          1,
          Math.floor(
            (attackDamage(p, p.weapon) + roll) * (critical ? 1.5 : 1),
          ) - target.armor,
        );
        target.hp = Math.max(0, target.hp - damage);
        p.cooldown = attackCooldown(p, p.weapon);
        if (critical) p.status = ranged ? "Critical shot" : "Critical strike";
        if (target.hp === 0) {
          this.clearOrder(target);
          target.orders.length = 0;
          notify(
            this.state,
            `${target.name} fell in battle.`,
            target.side === "ally" ? "bad" : "good",
          );
        }
      }
    } else {
      if (!this.follow(p))
        this.requestPath(p, this.graph(p.shipId).nearest(target.x, target.y));
      p.status = "Closing on enemy";
    }
  }
  private landingUsed = false;
  private finish(p: Pirate, status: string) {
    this.clearOrder(p);
    p.orders.shift();
    p.status = status;
    if (status.startsWith("No "))
      notify(this.state, `${p.name}: ${status}`, "bad");
  }
  tick() {
    if (
      this.disposed ||
      ["victory", "gameover", "won"].includes(this.state.phase)
    )
      return;
    const s = this.state;
    s.tick++;
    for (const ship of s.ships)
      if (ship.cannonCooldown > 0) ship.cannonCooldown--;
    this.processCommands();
    this.expansions = 0;
    this.landingUsed = false;
    let searches = 0;
    for (const p of s.pirates) {
      const search = this.searches.get(p.id);
      if (!search || searches >= 4 || this.expansions >= 2048) continue;
      searches++;
      this.expansions += search.advance(2048 - this.expansions);
      if (search.done) {
        this.searches.delete(p.id);
        if (search.path) {
          p.path = search.path;
          if (
            Math.abs(p.x - nodeX(search.start)) +
              Math.abs(p.y - nodeY(search.start)) >
            0.001
          )
            p.path.unshift(search.start);
          p.pathRevision = search.graph.ship.revision;
        } else this.finish(p, "No reachable route");
      }
    }
    if (s.phase === "travel") {
      for (const p of s.pirates) this.updatePirate(p);
      if (--s.travelTicks <= 0) this.arrive();
    } else {
      for (const p of s.pirates) this.updatePirate(p);
      if (["encounter", "aftermath"].includes(s.phase)) {
        if (s.phase === "encounter") this.enemyBroadside();
        const captain = s.pirates.find(
          (p) => p.role === "captain" && p.side === "ally",
        );
        if (!captain || captain.hp <= 0 || s.ships[0].hp <= 0) {
          s.phase = "gameover";
          this.commands.length = 0;
          this.tasks.clear();
          this.claims.clear();
          this.falls.clear();
          this.sea.clear();
          this.searches.clear();
          notify(
            s,
            s.ships[0].hp <= 0
              ? "Your ship sank. Restore the departure checkpoint."
              : "Your captain has fallen. A checkpoint awaits.",
            "bad",
          );
        } else if (
          s.phase === "encounter" &&
          s.ships[1]?.kind === "ship" &&
          (!s.pirates.some((p) => p.side === "enemy" && p.hp > 0) ||
            s.ships[1].hp <= 0)
        ) {
          s.phase = "aftermath";
          this.commands.length = 0;
          for (const p of s.pirates) {
            p.orders.length = 0;
            this.clearOrder(p);
          }
          notify(
            s,
            s.ships[1].hp <= 0
              ? "Enemy hull disabled. Return your crew and plunder the wreck."
              : "Enemy crew defeated. Return your crew, then plunder or capture their ship.",
            "good",
          );
        }
      }
    }
    if (
      !["gameover", "victory", "won"].includes(s.phase) &&
      s.pirates.some(
        (p) => p.side === "ally" && p.role === "captain" && p.hp <= 0,
      )
    ) {
      s.phase = "gameover";
      this.commands.length = 0;
      this.tasks.clear();
      this.claims.clear();
      this.falls.clear();
      this.sea.clear();
      this.searches.clear();
      notify(
        s,
        "Your captain has fallen. Restore the last safe checkpoint.",
        "bad",
      );
    }
    // Needs advance only on active voyages; food is prepared at the galley.
    if (["encounter", "travel"].includes(s.phase) && s.tick % 100 === 0) {
      const home = s.ships[0];
      const dirtyCrew = s.pirates.filter(
        (p) =>
          p.side === "ally" &&
          p.hp > 0 &&
          p.shipId === 1 &&
          p.accessory !== "diaper" &&
          !this.sea.has(p.id) &&
          !this.falls.has(p.id),
      ).length;
      home.dirt = Math.min(100, home.dirt + dirtyCrew);
      for (const p of s.pirates)
        if (p.side === "ally" && p.hp > 0) {
          p.hunger = Math.max(
            0,
            p.hunger -
              (p.traits.includes("hearty")
                ? 1
                : p.traits.includes("gourmand")
                  ? 3
                  : 2),
          );
          if (
            p.hunger < 60 &&
            s.meals > 0 &&
            p.shipId === 1 &&
            !this.sea.has(p.id)
          ) {
            s.meals--;
            p.hunger = Math.min(100, p.hunger + 35);
            p.status = "Eating cooked provisions";
          }
          if (home.dirt >= 60) p.morale = Math.max(0, p.morale - 1);
          if (p.hunger === 0) {
            p.hp = Math.max(0, p.hp - 2);
            p.morale = Math.max(0, p.morale - 2);
          }
        }
    }
    this.touch();
  }
  routeCost(id: number) {
    const n = this.state.world.find((n) => n.id === id);
    return n
      ? {
          food: 2 + Math.floor(n.danger / 2),
          wages:
            this.state.pirates.filter((p) => p.side === "ally" && p.hp > 0)
              .length * 3,
          ticks: 120 + n.danger * 20,
        }
      : null;
  }
  sail(id: number) {
    if (this.disposed) return false;
    const s = this.state;
    const node = s.world.find((n) => n.id === id);
    const cost = this.routeCost(id);
    if (!node || !cost || !["port", "victory"].includes(s.phase)) return false;
    if (id === s.location) {
      notify(s, "You are already here.", "bad");
      return false;
    }
    if (s.food < cost.food || s.gold < cost.wages) {
      notify(
        s,
        "Buy provisions and set aside crew wages before sailing.",
        "bad",
      );
      return false;
    }
    if (!this.safeHome()) {
      notify(
        s,
        "Repair the deck and return crew to reachable positions before sailing.",
        "bad",
      );
      return false;
    }
    this.cleanup();
    s.food -= cost.food;
    s.gold -= cost.wages;
    s.destination = id;
    s.travelTicks = cost.ticks;
    s.phase = "travel";
    s.resolved = false;
    s.reward = 0;
    for (const p of s.pirates) {
      p.hunger = Math.max(0, p.hunger - 5);
      p.morale = Math.max(0, p.morale - 1);
    }
    notify(
      s,
      `Course set for ${node.name}. Wages paid; ${cost.food} provisions packed.`,
      "good",
    );
    this.touch();
    return true;
  }
  private awardGold(amount: number) {
    const previous = this.state.gold;
    this.state.gold = Math.min(1_000_000_000, previous + amount);
    if (this.state.gold - previous < amount)
      notify(this.state, "Treasury full: excess gold was left behind.");
  }
  private awardStock(kind: "food" | "ammo" | "parts", amount: number) {
    const room = 999 - this.state[kind];
    this.state[kind] += Math.min(room, amount);
    const excess = Math.max(0, amount - room);
    if (excess) {
      this.awardGold(excess * (kind === "ammo" ? 4 : 2));
      notify(
        this.state,
        `Hold full: ${excess} excess ${kind} sold for gold.`,
        "good",
      );
    }
  }
  private arrive() {
    const s = this.state;
    const node = s.world.find((n) => n.id === s.destination)!;
    s.location = node.id;
    s.destination = null;
    if (node.kind === "port") {
      s.phase = "port";
      notify(s, "Welcome back to Saltwater Harbour.", "good");
    } else if (node.cleared) {
      s.phase = "victory";
      s.resolved = true;
      notify(s, "These waters are already charted. No fresh loot remains.");
    } else if (node.kind === "island") {
      s.phase = "encounter";
      s.ships.push(islandTerrain(node.name, node.seed));
      if (node.danger > 1)
        for (let i = 0; i < node.danger; i++) {
          const guard = makePirate(s.nextId++, i, "enemy", node.danger);
          guard.x = guard.previousX = 9 + i * 2;
          s.pirates.push(guard);
        }
      this.rebuild();
      notify(
        s,
        `${node.name}: go ashore, defeat any guards, and collect the chest.`,
        "good",
      );
    } else {
      s.phase = "encounter";
      const ship = encounterShip(node);
      s.ships.push(ship);
      const count = node.kind === "boss" ? 5 : node.danger + 1;
      for (let i = 0; i < count; i++)
        s.pirates.push(makePirate(s.nextId++, i, "enemy", node.danger));
      this.rebuild();
      notify(
        s,
        `${node.name} off the bow! Fire the cannon or prepare to board.`,
        "bad",
      );
    }
  }
  private resolve(captured = false) {
    const s = this.state;
    if (s.resolved) return;
    s.resolved = true;
    const node = s.world.find((n) => n.id === s.location)!;
    node.cleared = true;
    s.reward =
      node.kind === "island" ? 80 + node.danger * 30 : 100 + node.danger * 65;
    if (!captured && node.kind !== "island") {
      const prize = s.ships[1];
      for (const item of prize?.furnishings ?? []) {
        if (!furnitureSupported(prize.tiles, item)) continue;
        if (s.furnitureStock[item.kind] < FURNITURE_STOCK_CAP)
          s.furnitureStock[item.kind]++;
        else {
          const sold = Math.floor(FURNISHINGS[item.kind].price / 2);
          this.awardGold(sold);
          notify(
            s,
            `${FURNISHINGS[item.kind].name} stock full; salvage sold for ${sold} gold.`,
            "good",
          );
        }
      }
    }
    this.awardGold(s.reward);
    this.awardStock("parts", captured ? 0 : node.kind === "island" ? 4 : 6);
    if (node.kind === "island") this.awardStock("food", 5);
    else this.awardStock("ammo", 3);
    const loot = encounterLoot(node);
    for (const kind of ITEM_KINDS) {
      const amount = loot[kind];
      if (!amount) continue;
      const stored = Math.min(amount, ITEM_STOCK_CAP - s.itemStock[kind]);
      s.itemStock[kind] += stored;
      const sold = amount - stored;
      if (sold) this.awardGold(sold * Math.floor(ITEMS[kind].price / 2));
      notify(
        s,
        `${ITEMS[kind].name}: ${stored} added to the hold${sold ? `; ${sold} sold because its stack is full` : ""}.`,
        "good",
      );
    }
    for (const p of s.pirates)
      if (p.side === "ally" && p.hp > 0) {
        awardExperience(p, 30);
        p.morale = Math.min(100, p.morale + 12);
      }
    this.cleanup();
    s.phase = s.world.filter((n) => n.kind === "boss").every((n) => n.cleared)
      ? "won"
      : "victory";
    notify(
      s,
      `${captured ? "Ship captured" : node.kind === "island" ? "Island explored" : "Enemy ship plundered"}! ${s.reward} gold and supplies secured.`,
      "good",
    );
  }
  cleanup() {
    if (this.disposed) return;
    this.commands.length = 0;
    this.searches.clear();
    this.tasks.clear();
    this.claims.clear();
    this.falls.clear();
    for (const p of this.state.pirates)
      if (p.side === "ally" && p.hp > 0) {
        if (p.shipId !== 1 || this.sea.has(p.id)) this.transfer(p, 1);
        p.orders.length = 0;
        this.clearOrder(p);
        p.status = "On deck";
      }
    this.sea.clear();
    this.state.pirates = this.state.pirates.filter(
      (p) => p.side === "ally" && p.hp > 0,
    );
    this.state.ships = this.state.ships.filter((s) => s.id === 1);
    this.rebuild();
  }
  escape() {
    if (this.disposed || !["encounter", "aftermath"].includes(this.state.phase))
      return false;
    if (!this.safeHome()) {
      notify(
        this.state,
        "Return crew and repair unreachable deck before escaping.",
        "bad",
      );
      return false;
    }
    if (
      this.state.pirates.some(
        (p) => p.side === "ally" && p.hp > 0 && p.shipId !== 1,
      )
    ) {
      notify(
        this.state,
        "Bring every surviving pirate home before breaking off.",
        "bad",
      );
      return false;
    }
    this.cleanup();
    this.state.phase = "victory";
    this.state.reward = 0;
    this.state.resolved = false;
    notify(
      this.state,
      "The crew is safe. No loot taken; chart a course to safer waters.",
    );
    this.touch();
    return true;
  }
  cannon() {
    if (this.disposed) return false;
    const s = this.state;
    if (s.phase !== "encounter" || s.ships[1]?.kind !== "ship") {
      notify(s, "Cannons need an enemy vessel in range.", "bad");
      return false;
    }
    if (!s.ammo) {
      notify(s, "No cannonballs left.", "bad");
      return false;
    }
    const gunner = s.pirates.find(
      (p) =>
        p.side === "ally" &&
        p.hp > 0 &&
        p.shipId === 1 &&
        p.skills.includes("gunner") &&
        !this.sea.has(p.id) &&
        p.orders.length === 0,
    );
    if (!gunner) {
      notify(
        s,
        "Keep a trained cannoneer aboard with no overriding orders.",
        "bad",
      );
      return false;
    }
    const result = this.queue([gunner.id], { action: "cannon" });
    if (result) notify(s, `${gunner.name} ordered to load the cannon.`);
    return result;
  }
  private releaseWork(p: Pirate) {
    const task = this.tasks.get(p.id);
    if (!task) return;
    const key = `${p.shipId}:${task.duty}`;
    if (this.claims.get(key) === p.id) this.claims.delete(key);
    this.tasks.delete(p.id);
    this.searches.delete(p.id);
    p.path.length = 0;
  }
  private workNeeded(p: Pirate, duty: Duty) {
    const s = this.state,
      home = s.ships[0];
    if (p.side !== "ally" || p.shipId !== 1 || !p.skills.includes(duty))
      return false;
    const stationKind =
      duty === "cook"
        ? "food"
        : duty === "medic"
          ? "medical"
          : duty === "gunner"
            ? "cannon"
            : null;
    if (stationKind) {
      const station = home.stations.find((t) => t.kind === stationKind),
        graph = this.graph(1);
      if (
        !station ||
        !graph.connected(
          graph.nearest(p.x, p.y),
          tileNode(station.x, station.y),
        )
      )
        return false;
    }
    if (duty === "cook")
      return (
        s.food > 0 &&
        s.meals <
          Math.min(
            999,
            s.pirates.filter((a) => a.side === "ally" && a.hp > 0).length * 3,
          )
      );
    if (duty === "fish")
      return (
        s.food <
        Math.min(
          999,
          s.pirates.filter((a) => a.side === "ally" && a.hp > 0).length * 6,
        )
      );
    if (duty === "clean") return home.dirt > 0;
    if (duty === "repair")
      return (
        home.hp > 0 &&
        (home.hp < home.maxHp || home.tiles.some((t) => (t.damage ?? 0) > 0)) &&
        s.parts > 0
      );
    if (duty === "medic")
      return (
        s.medicine > 0 &&
        s.pirates.some(
          (a) =>
            a.side === "ally" &&
            a.shipId === 1 &&
            a.hp > 0 &&
            a.hp < a.maxHp &&
            !this.sea.has(a.id),
        )
      );
    if (duty === "gunner")
      return (
        s.phase === "encounter" &&
        s.ships[1]?.kind === "ship" &&
        s.ammo > 0 &&
        home.cannonCooldown === 0 &&
        s.ships[1].hp > 0
      );
    return false;
  }
  private updateWork(p: Pirate, duty: Duty, ordered = false) {
    const s = this.state,
      home = s.ships[0];
    if (!this.workNeeded(p, duty)) {
      this.releaseWork(p);
      if (ordered && (s.ammo === 0 || !p.skills.includes("gunner")))
        this.finish(p, "No cannonballs or gunnery skill available");
      else if (ordered) {
        const station = home.stations.find((t) => t.kind === "cannon"),
          graph = this.graph(1);
        if (
          !station ||
          !graph.connected(
            graph.nearest(p.x, p.y),
            tileNode(station.x, station.y),
          )
        )
          this.finish(p, "No reachable cannon station");
        else p.status = "Waiting for cannon reload";
      }
      return ordered;
    }
    const key = `${p.shipId}:${duty}`;
    const owner = this.claims.get(key);
    if (owner !== undefined && owner !== p.id) {
      if (ordered) p.status = "Waiting for cannon crew";
      return ordered;
    }
    let task = this.tasks.get(p.id);
    if (task && task.duty !== duty) {
      this.releaseWork(p);
      task = undefined;
    }
    if (!task) {
      const stationKind =
        duty === "cook"
          ? "food"
          : duty === "medic"
            ? "medical"
            : duty === "gunner"
              ? "cannon"
              : null;
      const station = home.stations.find((t) => t.kind === stationKind);
      if (stationKind && !station) {
        if (ordered) this.finish(p, "No working cannon station");
        return false;
      }
      const graph = this.graph(1),
        start = graph.nearest(p.x, p.y);
      let damaged: Tile | undefined,
        repairGoal = -1;
      if (duty === "repair")
        for (const tile of home.tiles) {
          if ((tile.damage ?? 0) <= (damaged?.damage ?? 0)) continue;
          // Fixed local candidates avoid scanning the entire graph for each plank.
          const candidates = [
            [tile.x, tile.y - 1],
            [tile.x - 1, tile.y - 1],
            [tile.x + 1, tile.y - 1],
            [tile.x, tile.y],
            [tile.x, tile.y + 1],
          ];
          const candidate = candidates.find(
            ([x, y]) =>
              x >= 0 &&
              x < LIMITS.width &&
              y >= 0 &&
              y < LIMITS.height &&
              graph.connected(start, tileNode(x, y)),
          );
          if (candidate) {
            damaged = tile;
            repairGoal = tileNode(candidate[0], candidate[1]);
          }
        }
      if (duty === "repair" && !damaged && home.hp === home.maxHp) {
        p.status = "No reachable damaged plank";
        return true;
      }
      const goal = station
        ? tileNode(station.x, station.y)
        : damaged
          ? repairGoal
          : graph.nearestReachable(
              duty === "fish" ? 0 : duty === "clean" ? 10 : 3,
              3,
              start,
            );
      if (goal === -1) {
        p.status = "No reachable work site";
        return false;
      }
      task = {
        duty,
        goal,
        progressUnits: 0,
        plank: damaged ? tileNode(damaged.x, damaged.y) : undefined,
      };
      this.tasks.set(p.id, task);
      this.claims.set(key, p.id);
    }
    const atStation =
      Math.abs(p.x - nodeX(task.goal)) + Math.abs(p.y - nodeY(task.goal)) <
      0.05;
    if (!atStation) {
      if (!this.follow(p)) this.requestPath(p, task.goal);
      p.status = `Walking to ${DUTY_NAMES[duty].toLowerCase()} duty`;
      return true;
    }
    p.x = nodeX(task.goal);
    p.y = nodeY(task.goal);
    p.status =
      duty === "cook"
        ? "Cooking provisions"
        : duty === "clean"
          ? "Scrubbing the deck"
          : duty === "repair"
            ? "Repairing hull"
            : duty === "medic"
              ? "Treating the crew"
              : duty === "fish"
                ? "Fishing off the rail"
                : "Loading cannon";
    // Low morale slows work, without random scheduler decisions or wall-clock timers.
    task.progressUnits += workUnits(p, duty);
    const duration =
      duty === "gunner"
        ? 40
        : duty === "fish"
          ? 160
          : duty === "repair"
            ? 80
            : 60;
    if (task.progressUnits < duration * WORK_UNITS_PER_TICK) return true;
    if (duty === "cook") {
      s.food--;
      s.meals = Math.min(999, s.meals + 2);
    }
    if (duty === "fish") {
      s.food = Math.min(999, s.food + 1);
      notify(s, `${p.name} caught a fish for the galley.`, "good");
    }
    if (duty === "clean") home.dirt = Math.max(0, home.dirt - 20);
    if (duty === "repair") {
      s.parts--;
      home.hp = Math.min(home.maxHp, home.hp + 12);
      const plank = home.tiles.find((t) => tileNode(t.x, t.y) === task.plank);
      if (plank) {
        const destroyed = !intact(plank);
        plank.damage = Math.max(0, (plank.damage ?? 0) - 60);
        if (destroyed) {
          this.refreshStructure(1);
          const above = tileNode(plank.x, plank.y - 1);
          if (this.graph(1).nodes.has(above))
            for (const actor of s.pirates) {
              if (
                actor.shipId === 1 &&
                actor.hp > 0 &&
                Math.round(actor.x) === plank.x &&
                actor.y >= plank.y - 1 &&
                actor.y <= plank.y
              ) {
                actor.x = actor.previousX = plank.x;
                actor.y = actor.previousY = plank.y - 1;
                this.falls.delete(actor.id);
                actor.status = "Standing on repaired deck";
              }
            }
        }
      }
    }
    if (duty === "medic") {
      const injured = s.pirates.find(
        (a) =>
          a.side === "ally" &&
          a.shipId === 1 &&
          a.hp > 0 &&
          a.hp < a.maxHp &&
          !this.sea.has(a.id),
      );
      if (injured) {
        s.medicine--;
        injured.hp = Math.min(injured.maxHp, injured.hp + 25);
      }
    }
    if (duty === "gunner") this.broadside(1);
    awardExperience(p, 2);
    this.releaseWork(p);
    if (ordered) this.finish(p, "Cannon fired");
    return true;
  }
  private broadside(shipId: number) {
    const s = this.state,
      source = s.ships.find((t) => t.id === shipId),
      target = s.ships.find((t) => t.id === (shipId === 1 ? 2 : 1));
    if (!source || !target || target.kind !== "ship") return;
    if (shipId === 1) {
      if (s.ammo <= 0) return;
      s.ammo--;
    }
    source.cannonCooldown = shipId === 1 ? 100 : 260;
    target.hp = Math.max(0, target.hp - (shipId === 1 ? 18 : 10));
    const planks = target.tiles.filter(
      (t) => t.kind === "hull" && (t.damage ?? 0) < 100,
    );
    const plank = planks[Math.floor(random(s) * planks.length)];
    if (plank)
      plank.damage = Math.min(
        100,
        (plank.damage ?? 0) + (shipId === 1 ? 60 : 40),
      );
    if (plank && !intact(plank)) this.refreshStructure(target.id);
    const victims = s.pirates.filter(
      (p) =>
        p.hp > 0 &&
        p.shipId === target.id &&
        !this.sea.has(p.id) &&
        p.side === (shipId === 1 ? "enemy" : "ally"),
    );
    const victim = victims[Math.floor(random(s) * victims.length)];
    if (victim) {
      victim.hp = Math.max(
        0,
        victim.hp - Math.max(1, (shipId === 1 ? 26 : 12) - victim.armor),
      );
      if (victim.hp === 0) {
        this.clearOrder(victim);
        victim.orders.length = 0;
      }
    }
    notify(
      s,
      shipId === 1
        ? "Broadside! Enemy hull and crew hit."
        : "Incoming cannonball! Our hull is damaged; set a shipwright to repairs.",
      shipId === 1 ? "good" : "bad",
    );
  }
  private enemyBroadside() {
    const ship = this.state.ships[1];
    if (ship?.kind !== "ship" || ship.hp <= 0 || ship.cannonCooldown > 0)
      return;
    const station = ship.stations.find((t) => t.kind === "cannon");
    if (!station || !this.graph(2).nodes.has(tileNode(station.x, station.y)))
      return;
    const gunner = this.state.pirates.find(
      (p) =>
        p.side === "enemy" &&
        p.hp > 0 &&
        p.shipId === 2 &&
        !this.sea.has(p.id) &&
        !this.nearestEnemy(p) &&
        this.graph(2).connected(
          this.graph(2).nearest(p.x, p.y),
          tileNode(station.x, station.y),
        ),
    );
    if (gunner) {
      gunner.status = "Firing ship cannon";
      this.broadside(2);
    }
  }
  assignDuty(id: number, duty: Duty) {
    if (this.disposed || !DUTIES.includes(duty)) return false;
    const p = this.state.pirates.find(
      (p) => p.id === id && p.side === "ally" && p.hp > 0,
    );
    if (!p || !p.skills.includes(duty)) {
      notify(this.state, "Buy the matching skill book at port first.", "bad");
      return false;
    }
    p.orders.length = 0;
    this.clearOrder(p);
    p.duty = duty;
    p.status = `Assigned: ${DUTY_NAMES[duty]}`;
    notify(this.state, `${p.name}: ${DUTY_NAMES[duty]} duty assigned.`, "good");
    this.touch();
    return true;
  }
  teach(id: number, duty: Skill) {
    if (this.disposed || !SKILLS.includes(duty)) return false;
    const s = this.state,
      p = s.pirates.find((p) => p.id === id && p.side === "ally" && p.hp > 0);
    if (s.phase !== "port" || !p || p.skills.includes(duty)) {
      notify(
        s,
        "Learn a new skill on a living crewmate in port; use rank training for known skills.",
        "bad",
      );
      return false;
    }
    if (!this.readBook(p, duty)) return false;
    p.skills.push(duty);
    p.skillRanks[duty] = 1;
    if (duty !== "swim") p.duty = duty;
    p.orders.length = 0;
    this.clearOrder(p);
    notify(
      s,
      duty === "swim"
        ? `${p.name} learned Swimming; their assigned duty is unchanged.`
        : `${p.name} learned ${DUTY_NAMES[duty]} and took the duty.`,
      "good",
    );
    this.touch();
    return true;
  }
  private readBook(p: Pirate, skill: Skill) {
    const s = this.state;
    if (
      p.trainingPoints < SKILL_POINT_COST ||
      (s.bookStock[skill] === 0 && s.gold < BOOK_PRICE)
    ) {
      notify(
        s,
        "Reading a skill book needs 1 training point and an owned book or 60 gold.",
        "bad",
      );
      return false;
    }
    if (s.bookStock[skill] > 0) s.bookStock[skill]--;
    else s.gold -= BOOK_PRICE;
    p.trainingPoints -= SKILL_POINT_COST;
    p.skillPointsSpent += SKILL_POINT_COST;
    return true;
  }
  trainSkill(id: number, skill: Skill) {
    if (this.disposed || !SKILLS.includes(skill)) return false;
    const s = this.state,
      p = s.pirates.find((p) => p.id === id && p.side === "ally" && p.hp > 0);
    if (
      s.phase !== "port" ||
      !p ||
      !p.skills.includes(skill) ||
      p.skillRanks[skill] >= SKILL_RANK_CAP
    ) {
      notify(s, "Improve a learned skill in port, up to rank five.", "bad");
      return false;
    }
    if (!this.readBook(p, skill)) return false;
    p.skillRanks[skill]++;
    notify(
      s,
      `${p.name}: ${SKILL_NAMES[skill]} reaches rank ${p.skillRanks[skill]}.`,
      "good",
    );
    this.touch();
    return true;
  }
  buyBook(skill: Skill) {
    if (this.disposed || !SKILLS.includes(skill)) return false;
    const s = this.state;
    if (
      s.phase !== "port" ||
      s.gold < BOOK_PRICE ||
      s.bookStock[skill] >= BOOK_STOCK_CAP
    ) {
      notify(
        s,
        "Buy skill books in port for 60 gold; each stack holds at most 99.",
        "bad",
      );
      return false;
    }
    s.gold -= BOOK_PRICE;
    s.bookStock[skill]++;
    notify(s, `${SKILL_NAMES[skill]} book stored in the hold.`, "good");
    this.touch();
    return true;
  }
  sellBook(skill: Skill) {
    if (this.disposed || !SKILLS.includes(skill)) return false;
    const s = this.state;
    if (s.phase !== "port" || s.bookStock[skill] < 1) return false;
    s.bookStock[skill]--;
    s.gold = Math.min(1_000_000_000, s.gold + BOOK_PRICE / 2);
    notify(s, `${SKILL_NAMES[skill]} book sold for 30 gold.`, "good");
    this.touch();
    return true;
  }
  equip(id: number, weapon: Weapon) {
    if (this.disposed || !Object.hasOwn(WEAPONS, weapon)) return false;
    const s = this.state,
      p = s.pirates.find((p) => p.id === id && p.side === "ally" && p.hp > 0);
    if (s.phase !== "port" || !p || p.weapon === weapon) return false;
    const recovered =
      weapon !== "cutlass" &&
      !p.ownedWeapons.includes(weapon) &&
      s.itemStock[weapon] > 0;
    const cost =
      p.ownedWeapons.includes(weapon) || recovered ? 0 : WEAPONS[weapon].price;
    if (s.gold < cost) {
      notify(s, "Not enough gold for this weapon.", "bad");
      return false;
    }
    s.gold -= cost;
    if (recovered) s.itemStock[weapon]--;
    if (!p.ownedWeapons.includes(weapon)) p.ownedWeapons.push(weapon);
    if (weapon === "pistol") p.rangedWeapon = weapon;
    else p.meleeWeapon = weapon;
    p.weapon = weapon;
    notify(
      s,
      `${p.name} equipped ${WEAPONS[weapon].name}${cost ? ` for ${cost} gold` : recovered ? " from the hold" : " from their locker"}.`,
      "good",
    );
    this.touch();
    return true;
  }
  stowWeapon(id: number, slot: "melee" | "ranged") {
    if (this.disposed || (slot !== "melee" && slot !== "ranged")) return false;
    const s = this.state,
      p = s.pirates.find((p) => p.id === id && p.side === "ally" && p.hp > 0);
    if (s.phase !== "port" || !p) return false;
    const weapon = slot === "melee" ? p.meleeWeapon : p.rangedWeapon,
      remaining = slot === "melee" ? p.rangedWeapon : p.meleeWeapon;
    if (!weapon || !remaining) {
      notify(
        s,
        "Keep at least one weapon equipped; stowing spends nothing.",
        "bad",
      );
      return false;
    }
    if (slot === "melee") p.meleeWeapon = null;
    else p.rangedWeapon = null;
    if (p.weapon === weapon) p.weapon = remaining;
    notify(s, `${WEAPONS[weapon].name} stowed in ${p.name}’s locker.`, "good");
    this.touch();
    return true;
  }
  equipAccessory(id: number, kind: Accessory | null) {
    if (this.disposed || (kind !== null && !ACCESSORY_KINDS.includes(kind)))
      return false;
    const s = this.state,
      p = s.pirates.find((p) => p.id === id && p.side === "ally" && p.hp > 0);
    if (s.phase !== "port" || !p || p.accessory === kind) return false;
    if (kind === null) {
      p.accessory = null;
      notify(s, `${p.name} stowed their accessory.`, "good");
    } else {
      const owned = p.ownedAccessories.includes(kind),
        recovered = !owned && s.itemStock[kind] > 0,
        cost = owned || recovered ? 0 : ITEMS[kind].price;
      if (s.gold < cost) {
        notify(s, "Not enough gold for this accessory.", "bad");
        return false;
      }
      s.gold -= cost;
      if (recovered) s.itemStock[kind]--;
      if (!owned) p.ownedAccessories.push(kind);
      p.accessory = kind;
      notify(
        s,
        `${p.name} equipped ${ITEMS[kind].name}${cost ? ` for ${cost} gold` : recovered ? " from the hold" : " from their locker"}.`,
        "good",
      );
    }
    this.touch();
    return true;
  }
  armor(id: number) {
    if (this.disposed) return false;
    const s = this.state,
      p = s.pirates.find((p) => p.id === id && p.side === "ally");
    if (s.phase !== "port" || !p || p.armor >= 8 || s.gold < 50) {
      notify(
        s,
        "Armor upgrades cost 50 gold at port (maximum 8 protection).",
        "bad",
      );
      return false;
    }
    s.gold -= 50;
    p.armor = Math.min(8, p.armor + 4);
    notify(s, `${p.name}: armor now blocks ${p.armor} damage per hit.`, "good");
    this.touch();
    return true;
  }
  collect(ids: number[]) {
    return this.queue(ids, { action: "collect" });
  }
  finishEncounter(capture = false) {
    const s = this.state;
    if (this.disposed || s.phase !== "aftermath" || s.resolved) return false;
    if (
      s.pirates.some((p) => p.side === "ally" && p.hp > 0 && p.shipId !== 1)
    ) {
      notify(
        s,
        "Return every surviving pirate before collecting spoils or capturing a vessel.",
        "bad",
      );
      return false;
    }
    const prize = s.ships[1];
    if (!this.safeHome()) {
      notify(
        s,
        "Repair the home deck so every survivor is reachable before claiming spoils.",
        "bad",
      );
      return false;
    }
    if (capture) {
      if (!prize || prize.kind !== "ship" || prize.hp <= 0) {
        notify(s, "A disabled wreck or island cannot be captured.", "bad");
        return false;
      }
      const error = validateLayout(prize, prize.tiles);
      if (error) {
        notify(s, `Cannot capture damaged access: ${error}`, "bad");
        return false;
      }
      const captured = {
        ...prize,
        id: 1,
        name: `${prize.name} (captured)`,
        tiles: prize.tiles.map((t) => ({ ...t })),
        stations: prize.stations.map((t) => ({ ...t })),
        furnishings: prize.furnishings.map((f) => ({ ...f })),
        revision: s.ships[0].revision + 1,
        cannonCooldown: 160,
        dirt: 0,
      };
      s.ships[0] = captured;
      this.rebuild();
      for (const p of s.pirates)
        if (p.side === "ally") {
          const node = this.graph(1).nearestReachable(
            3 + (p.id % 6),
            3,
            this.graph(1).nearest(3, 3),
          );
          p.x = p.previousX = nodeX(node);
          p.y = p.previousY = nodeY(node);
        }
    }
    this.resolve(capture);
    this.touch();
    return true;
  }
  buyItem(kind: ItemKind) {
    const s = this.state;
    if (this.disposed || !Object.hasOwn(ITEMS, kind)) return false;
    if (s.phase !== "port") {
      notify(s, "Visit the harbour to buy items.", "bad");
      return false;
    }
    if (s.itemStock[kind] >= ITEM_STOCK_CAP) {
      notify(s, "This item stack is full.", "bad");
      return false;
    }
    if (s.gold < ITEMS[kind].price) {
      notify(s, "Not enough gold.", "bad");
      return false;
    }
    s.gold -= ITEMS[kind].price;
    s.itemStock[kind]++;
    notify(s, `${ITEMS[kind].name} added to the hold.`, "good");
    this.touch();
    return true;
  }
  sellItem(kind: ItemKind) {
    const s = this.state;
    if (this.disposed || !Object.hasOwn(ITEMS, kind)) return false;
    if (s.phase !== "port" || s.itemStock[kind] <= 0) {
      notify(s, "Sell an owned item at the harbour.", "bad");
      return false;
    }
    const price = Math.floor(ITEMS[kind].price / 2);
    if (s.gold + price > 1_000_000_000) {
      notify(s, "Gold reserve is full; the item was kept.", "bad");
      return false;
    }
    s.itemStock[kind]--;
    this.awardGold(price);
    notify(s, `${ITEMS[kind].name} sold for ${price} gold.`, "good");
    this.touch();
    return true;
  }
  itemUseReason(id: number, kind: ItemKind): string | null {
    if (this.disposed || !Object.hasOwn(ITEMS, kind)) return "Unknown item.";
    const s = this.state,
      p = s.pirates.find((p) => p.id === id && p.side === "ally" && p.hp > 0);
    if (s.phase === "gameover") return "Restore a living checkpoint first.";
    if (!p) return "Select a living crew member.";
    if (this.sea.has(id) || this.falls.has(id))
      return "Return this pirate safely aboard before using an item.";
    if (s.itemStock[kind] <= 0) return "None of this item remains in the hold.";
    return itemEffectReason(p, kind);
  }
  useItem(id: number, kind: ItemKind) {
    const s = this.state,
      reason = this.itemUseReason(id, kind);
    if (reason) {
      if (!this.disposed) notify(s, reason, "bad");
      return false;
    }
    const p = s.pirates.find((p) => p.id === id)!,
      item = ITEMS[kind];
    s.itemStock[kind]--;
    switch (item.effect) {
      case "health":
        p.hp = Math.min(
          p.maxHp,
          p.hp + Math.max(1, Math.ceil(p.maxHp * item.amount)),
        );
        break;
      case "morale":
        p.morale = Math.min(100, p.morale + item.amount);
        break;
      case "hunger":
        p.hunger = Math.min(100, p.hunger + item.amount);
        break;
      case "experience":
        awardExperience(p, item.amount);
        break;
    }
    notify(s, `${p.name} used ${item.name}.`, "good");
    this.touch();
    return true;
  }
  buy(kind: "food" | "ammo" | "medicine" | "parts") {
    if (this.disposed) return false;
    const prices = { food: 20, ammo: 24, medicine: 30, parts: 25 },
      amounts = { food: 10, ammo: 6, medicine: 4, parts: 10 };
    const s = this.state;
    if (s.phase !== "port") {
      notify(s, "Visit the harbour to buy supplies.", "bad");
      return false;
    }
    if (s.gold < prices[kind]) {
      notify(s, "Not enough gold.", "bad");
      return false;
    }
    if (s[kind] + amounts[kind] > 999) {
      notify(s, "The hold is full.", "bad");
      return false;
    }
    s.gold -= prices[kind];
    s[kind] += amounts[kind];
    notify(s, `${amounts[kind]} ${kind} added to the hold.`, "good");
    this.touch();
    return true;
  }
  buyFurniture(kind: FurnitureKind) {
    if (this.disposed || !Object.hasOwn(FURNISHINGS, kind)) return false;
    const s = this.state,
      def = FURNISHINGS[kind];
    if (s.phase !== "port") return false;
    if (s.gold < def.price || s.furnitureStock[kind] >= FURNITURE_STOCK_CAP) {
      notify(
        s,
        s.gold < def.price
          ? "Not enough gold for this furnishing."
          : "Furnishing stock is full.",
        "bad",
      );
      return false;
    }
    s.gold -= def.price;
    s.furnitureStock[kind]++;
    notify(
      s,
      `${def.name} added to your hold. Place it in the ship builder.`,
      "good",
    );
    this.touch();
    return true;
  }
  sellFurniture(kind: FurnitureKind) {
    if (this.disposed || !Object.hasOwn(FURNISHINGS, kind)) return false;
    const s = this.state,
      price = Math.floor(FURNISHINGS[kind].price / 2);
    if (s.phase !== "port" || s.furnitureStock[kind] <= 0) return false;
    if (s.gold + price > 1_000_000_000) {
      notify(
        s,
        "Gold storage is full; keep this furnishing in your hold.",
        "bad",
      );
      return false;
    }
    s.furnitureStock[kind]--;
    s.gold += price;
    notify(s, `${FURNISHINGS[kind].name} sold for ${price} gold.`, "good");
    this.touch();
    return true;
  }
  recruit() {
    if (this.disposed) return false;
    const s = this.state;
    if (s.phase !== "port") return false;
    if (s.pirates.length >= LIMITS.allies || s.gold < 70) {
      notify(
        s,
        s.gold < 70 ? "Recruitment costs 70 gold." : "Crew roster is full.",
        "bad",
      );
      return false;
    }
    const p = makePirate(s.nextId++, s.pirates.length);
    const spawn = this.graph(1).nearestReachable(
      p.x,
      p.y,
      this.graph(1).nearest(3, 3),
    );
    p.x = nodeX(spawn);
    p.y = nodeY(spawn);
    p.previousX = p.x;
    p.previousY = p.y;
    s.pirates.push(p);
    s.gold -= 70;
    s.tutorial = Math.max(1, s.tutorial);
    notify(s, `${p.name} joins the crew. Welcome aboard!`, "good");
    this.touch();
    return true;
  }
  trainAttribute(id: number, attribute: Attribute) {
    if (this.disposed) return false;
    const s = this.state,
      p = s.pirates.find((p) => p.id === id && p.side === "ally" && p.hp > 0);
    if (s.phase !== "port" || !p || !ATTRIBUTE_KEYS.includes(attribute)) {
      notify(s, "Train a living crewmate's attributes in port.", "bad");
      return false;
    }
    if (
      p.trainingPoints < 1 ||
      p.attributes[attribute] >= ATTRIBUTE_CAP ||
      (attribute === "vit" && p.maxHp >= 1000)
    ) {
      notify(
        s,
        "No training points available, or this attribute is at its limit.",
        "bad",
      );
      return false;
    }
    p.trainingPoints--;
    p.attributes[attribute]++;
    if (attribute === "vit") {
      const gain = Math.min(4, 1000 - p.maxHp);
      p.maxHp += gain;
      p.hp += gain; // Preserve missing health; training is not a full heal.
    }
    notify(
      s,
      `${p.name}: ${ATTRIBUTE_INFO[attribute].name} increased to ${p.attributes[attribute]}.`,
      "good",
    );
    this.touch();
    return true;
  }
  assignGroup(id: number, group: CrewGroup) {
    if (this.disposed) return false;
    const s = this.state,
      p = s.pirates.find((p) => p.id === id && p.side === "ally" && p.hp > 0);
    if (
      s.phase !== "port" ||
      !p ||
      !CREW_GROUPS.includes(group) ||
      p.group === group
    ) {
      notify(
        s,
        "Assign a living crewmate to a different group in port.",
        "bad",
      );
      return false;
    }
    p.group = group;
    notify(s, `${p.name} joins crew group ${group}.`, "good");
    this.touch();
    return true;
  }
  upgrade(id: number) {
    if (this.disposed) return false;
    const s = this.state,
      p = s.pirates.find((p) => p.id === id && p.side === "ally");
    if (s.phase !== "port" || !p || s.gold < 45) {
      notify(s, "Weapon training costs 45 gold at the harbour.", "bad");
      return false;
    }
    if (p.damage >= 40) {
      notify(s, "This pirate has mastered their weapon.");
      return false;
    }
    s.gold -= 45;
    p.damage += 3;
    notify(s, `${p.name}: weapon damage increased to ${p.damage}.`, "good");
    this.touch();
    return true;
  }
  rest() {
    if (this.disposed) return false;
    const s = this.state;
    if (s.phase !== "port" || s.gold < 25) {
      notify(s, "A night at the tavern costs 25 gold.", "bad");
      return false;
    }
    s.gold -= 25;
    s.ships[0].hp = s.ships[0].maxHp;
    s.ships[0].dirt = 0;
    for (const tile of s.ships[0].tiles) tile.damage = 0;
    this.refreshStructure(1);
    this.tasks.clear();
    this.claims.clear();
    this.falls.clear();
    this.sea.clear();
    this.searches.clear();
    for (const p of s.pirates) {
      p.hp = p.maxHp;
      p.hunger = 100;
      p.morale = 100;
      const node = this.graph(1).nearestReachable(
        p.x,
        p.y,
        this.graph(1).nearest(3, 3),
      );
      p.x = p.previousX = nodeX(node);
      p.y = p.previousY = nodeY(node);
      p.status = "Rested";
      p.orders.length = 0;
      p.path.length = 0;
    }
    notify(s, "A warm meal, a sea shanty, and a well-rested crew.", "good");
    this.touch();
    return true;
  }
  heal() {
    if (this.disposed) return false;
    const s = this.state;
    const injured = s.pirates.find(
      (p) =>
        p.side === "ally" && p.hp > 0 && p.hp < p.maxHp && !this.sea.has(p.id),
    );
    if (!injured || !s.medicine) {
      notify(
        s,
        !s.medicine ? "No medicine in the hold." : "The crew is healthy.",
      );
      return false;
    }
    s.medicine--;
    injured.hp = Math.min(injured.maxHp, injured.hp + 40);
    notify(s, `${injured.name} treated for 40 health.`, "good");
    this.touch();
    return true;
  }
  edit(
    tiles: Tile[],
    stations = this.state.ships[0].stations,
    furnishings = this.state.ships[0].furnishings,
  ) {
    if (this.disposed) return "Voyage closed.";
    const s = this.state;
    if (s.phase !== "port") return "Build only in port.";
    const ship = s.ships[0];
    if (
      stations.length !== 3 ||
      new Set(stations.map((t) => t.kind)).size !== 3 ||
      stations.some(
        (t) =>
          !["cannon", "food", "medical"].includes(t.kind) ||
          !Number.isInteger(t.x) ||
          !Number.isInteger(t.y) ||
          t.x < 0 ||
          t.x >= LIMITS.width ||
          t.y < 0 ||
          t.y >= LIMITS.height,
      ) ||
      new Set(stations.map((t) => tileNode(t.x, t.y))).size !== 3
    )
      return "Keep three distinct stations on the ship grid.";
    const error = validateLayout({ ...ship, stations }, tiles);
    if (error) return error;
    const graph = new Navigation({ ...ship, tiles });
    const base = graph.nearest(3, 3);
    for (const p of s.pirates) {
      const node = tileNode(Math.round(p.x), Math.round(p.y));
      const search = new Search(graph, base, node);
      search.advance(1536);
      if (!search.path) return `${p.name} needs a safe, reachable deck.`;
    }
    const furnitureError = validateFurniture(
      ship,
      tiles,
      stations,
      furnishings,
      true,
    );
    if (furnitureError) return furnitureError;
    const stock = { ...s.furnitureStock };
    for (const kind of FURNITURE_KINDS) {
      stock[kind] +=
        ship.furnishings.filter((f) => f.kind === kind).length -
        furnishings.filter((f) => f.kind === kind).length;
      if (stock[kind] < 0)
        return `Buy more ${FURNISHINGS[kind].name} stock at the harbour.`;
      if (stock[kind] > FURNITURE_STOCK_CAP)
        return `No room to return ${FURNISHINGS[kind].name} to the hold.`;
    }
    const existing = new Map(ship.tiles.map((t) => [tileNode(t.x, t.y), t]));
    const added = tiles.filter(
      (t) => existing.get(tileNode(t.x, t.y))?.kind !== t.kind,
    ).length;
    if (added > s.parts) return `Need ${added} timber; you have ${s.parts}.`;
    s.parts -= added;
    ship.tiles = tiles.map((t) => {
      const old = existing.get(tileNode(t.x, t.y));
      return {
        x: t.x,
        y: t.y,
        kind: t.kind,
        damage: old?.kind === t.kind ? (old.damage ?? 0) : 0,
      };
    });
    ship.stations = stations.map((t) => ({ ...t }));
    ship.furnishings = furnishings.map((f) => ({ ...f }));
    s.furnitureStock = stock;
    this.tasks.clear();
    this.claims.clear();
    this.falls.clear();
    ship.revision++;
    this.rebuild();
    for (const p of s.pirates) {
      p.path.length = 0;
      p.orders.length = 0;
    }
    notify(s, `Ship refitted. ${added} timber used.`, "good");
    this.touch();
    return null;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.commands.length = 0;
    this.searches.clear();
    this.graphs.clear();
    this.tasks.clear();
    this.claims.clear();
    this.falls.clear();
    this.sea.clear();
  }
}
