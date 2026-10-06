import {
  Campaign,
  Duty,
  DUTIES,
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
  starterShip,
  Tile,
  tileNode,
  nodeX,
  nodeY,
} from "./model";
import { Navigation, Search, validateLayout } from "./navigation";
export class Simulation {
  private commands: InputCommand[] = [];
  private graphs = new Map<number, Navigation>();
  private searches = new Map<number, Search>();
  private tasks = new Map<
    number,
    { duty: Duty; goal: number; progress: number }
  >();
  private claims = new Map<string, number>();
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
    const speed = 0.16;
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
      if (e.side !== p.side && e.hp > 0 && e.shipId === p.shipId) {
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
    const node = graph.nearest(shipId === 1 ? 17 : 0, 3);
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
      this.clearOrder(p);
      p.orders.length = 0;
      return;
    }
    p.previousX = p.x;
    p.previousY = p.y;
    if (p.cooldown > 0) p.cooldown--;
    const order = p.orders[0];
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
          this.transfer(p, targetShip);
          this.finish(p, targetShip === 2 ? "Engaging enemy" : "Back aboard");
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
            (e) => e.id === order.targetId && e.hp > 0 && e.side !== p.side,
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
    const weapon = WEAPONS[p.weapon];
    const ranged = weapon.range > 2;
    if (distance <= weapon.range && Math.abs(target.y - p.y) < 0.6) {
      this.searches.delete(p.id);
      p.path.length = 0;
      p.status = ranged ? "Firing pistol" : "Fighting";
      if (p.cooldown === 0) {
        const damage = Math.max(
          1,
          p.damage +
            weapon.bonus +
            Math.floor(random(this.state) * 4) -
            target.armor,
        );
        target.hp = Math.max(0, target.hp - damage);
        p.cooldown = weapon.cooldown;
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
    // Needs advance only on active voyages; food is prepared at the galley.
    if (["encounter", "travel"].includes(s.phase) && s.tick % 100 === 0) {
      const home = s.ships[0];
      home.dirt = Math.min(100, home.dirt + 3);
      for (const p of s.pirates)
        if (p.side === "ally" && p.hp > 0) {
          p.hunger = Math.max(0, p.hunger - 2);
          if (p.hunger < 60 && s.meals > 0 && p.shipId === 1) {
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
      s.ships.push(islandTerrain(node.name));
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
      const ship = starterShip(2, true);
      ship.name = node.name;
      ship.hp = ship.maxHp = 100 + (node.danger - 1) * 20;
      if (node.danger > 1)
        for (let x = 18; x < 18 + node.danger; x++)
          ship.tiles.push({ x, y: 4, kind: "hull" });
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
    this.awardGold(s.reward);
    this.awardStock("parts", captured ? 0 : node.kind === "island" ? 4 : 6);
    if (node.kind === "island") this.awardStock("food", 5);
    else this.awardStock("ammo", 3);
    for (const p of s.pirates)
      if (p.side === "ally" && p.hp > 0) {
        p.xp += 30;
        p.morale = Math.min(100, p.morale + 12);
        if (p.level < 100 && p.xp >= p.level * 30) {
          p.level++;
          p.damage = Math.min(1000, p.damage + 2);
          p.maxHp = Math.min(1000, p.maxHp + 8);
          p.hp = Math.min(p.maxHp, p.hp + 20);
        }
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
    for (const p of this.state.pirates)
      if (p.side === "ally" && p.hp > 0) {
        if (p.shipId !== 1) this.transfer(p, 1);
        p.orders.length = 0;
        this.clearOrder(p);
        p.status = "On deck";
      }
    this.state.pirates = this.state.pirates.filter(
      (p) => p.side === "ally" && p.hp > 0,
    );
    this.state.ships = this.state.ships.filter((s) => s.id === 1);
    this.rebuild();
  }
  escape() {
    if (this.disposed || !["encounter", "aftermath"].includes(this.state.phase))
      return false;
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
    if (duty === "cook")
      return (
        s.food > 0 &&
        s.meals <
          Math.min(
            999,
            s.pirates.filter((a) => a.side === "ally" && a.hp > 0).length * 3,
          )
      );
    if (duty === "clean") return home.dirt > 0;
    if (duty === "repair")
      return home.hp > 0 && home.hp < home.maxHp && s.parts > 0;
    if (duty === "medic")
      return (
        s.medicine > 0 &&
        s.pirates.some(
          (a) =>
            a.side === "ally" && a.shipId === 1 && a.hp > 0 && a.hp < a.maxHp,
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
      else if (ordered) p.status = "Waiting for cannon reload";
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
      const goal = station
        ? tileNode(station.x, station.y)
        : this.graph(1).nearest(duty === "clean" ? 10 : 3, 3);
      task = { duty, goal, progress: 0 };
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
              : "Loading cannon";
    // Low morale slows work, without random scheduler decisions or wall-clock timers.
    task.progress += p.morale < 30 ? 0.5 : 1;
    const duration = duty === "gunner" ? 40 : duty === "repair" ? 80 : 60;
    if (task.progress < duration) return true;
    if (duty === "cook") {
      s.food--;
      s.meals = Math.min(999, s.meals + 2);
    }
    if (duty === "clean") home.dirt = Math.max(0, home.dirt - 20);
    if (duty === "repair") {
      s.parts--;
      home.hp = Math.min(home.maxHp, home.hp + 12);
    }
    if (duty === "medic") {
      const injured = s.pirates.find(
        (a) =>
          a.side === "ally" && a.shipId === 1 && a.hp > 0 && a.hp < a.maxHp,
      );
      if (injured) {
        s.medicine--;
        injured.hp = Math.min(injured.maxHp, injured.hp + 25);
      }
    }
    if (duty === "gunner") this.broadside(1);
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
    const victims = s.pirates.filter(
      (p) =>
        p.hp > 0 &&
        p.shipId === target.id &&
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
    const gunner = this.state.pirates.find(
      (p) =>
        p.side === "enemy" &&
        p.hp > 0 &&
        p.shipId === 2 &&
        !this.nearestEnemy(p),
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
  teach(id: number, duty: Duty) {
    if (this.disposed || !DUTIES.includes(duty)) return false;
    const s = this.state,
      p = s.pirates.find((p) => p.id === id && p.side === "ally");
    if (s.phase !== "port" || !p || p.skills.includes(duty) || s.gold < 60) {
      notify(
        s,
        "Skill books cost 60 gold at port; known skills need no book.",
        "bad",
      );
      return false;
    }
    s.gold -= 60;
    p.skills.push(duty);
    p.duty = duty;
    p.orders.length = 0;
    this.clearOrder(p);
    notify(
      s,
      `${p.name} learned ${DUTY_NAMES[duty]} and took the duty.`,
      "good",
    );
    this.touch();
    return true;
  }
  equip(id: number, weapon: Weapon) {
    if (this.disposed || !Object.hasOwn(WEAPONS, weapon)) return false;
    const s = this.state,
      p = s.pirates.find((p) => p.id === id && p.side === "ally");
    if (s.phase !== "port" || !p || p.weapon === weapon) return false;
    const cost = p.ownedWeapons.includes(weapon) ? 0 : WEAPONS[weapon].price;
    if (s.gold < cost) {
      notify(s, "Not enough gold for this weapon.", "bad");
      return false;
    }
    s.gold -= cost;
    if (!p.ownedWeapons.includes(weapon)) p.ownedWeapons.push(weapon);
    p.weapon = weapon;
    notify(
      s,
      `${p.name} equipped ${WEAPONS[weapon].name}${cost ? ` for ${cost} gold` : " from their locker"}.`,
      "good",
    );
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
    if (capture) {
      if (!prize || prize.kind !== "ship" || prize.hp <= 0) {
        notify(s, "A disabled wreck or island cannot be captured.", "bad");
        return false;
      }
      const captured = {
        ...prize,
        id: 1,
        name: `${prize.name} (captured)`,
        tiles: prize.tiles.map((t) => ({ ...t })),
        stations: prize.stations.map((t) => ({ ...t })),
        revision: s.ships[0].revision + 1,
        cannonCooldown: 160,
        dirt: 0,
      };
      s.ships[0] = captured;
      this.rebuild();
      for (const p of s.pirates)
        if (p.side === "ally") {
          const node = this.graph(1).nearest(3 + (p.id % 6), 3);
          p.x = p.previousX = nodeX(node);
          p.y = p.previousY = nodeY(node);
        }
    }
    this.resolve(capture);
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
    const spawn = this.graph(1).nearest(p.x, p.y);
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
    this.tasks.clear();
    this.claims.clear();
    this.searches.clear();
    for (const p of s.pirates) {
      p.hp = p.maxHp;
      p.hunger = 100;
      p.morale = 100;
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
      (p) => p.side === "ally" && p.hp > 0 && p.hp < p.maxHp,
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
  edit(tiles: Tile[], stations = this.state.ships[0].stations) {
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
    const added = tiles.filter(
      (t) =>
        !ship.tiles.some(
          (o) => o.x === t.x && o.y === t.y && o.kind === t.kind,
        ),
    ).length;
    if (added > s.parts) return `Need ${added} timber; you have ${s.parts}.`;
    s.parts -= added;
    ship.tiles = tiles.map((t) => ({ ...t }));
    ship.stations = stations.map((t) => ({ ...t }));
    this.tasks.clear();
    this.claims.clear();
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
  }
}
