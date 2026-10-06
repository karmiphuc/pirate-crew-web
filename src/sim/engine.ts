import {
  Campaign,
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
    if (!["port", "encounter"].includes(this.state.phase)) {
      notify(this.state, "Orders are available in port or in battle.", "bad");
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
        if (c.order.action === "board" && this.state.phase !== "encounter") {
          notify(this.state, "No enemy ship to board.", "bad");
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
    if (start === goal) return;
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
    p.shipId = shipId;
    p.x = nodeX(node);
    p.y = nodeY(node);
    p.previousX = p.x;
    p.previousY = p.y;
    this.clearOrder(p);
  }
  private updatePirate(p: Pirate) {
    if (p.hp <= 0) return;
    p.previousX = p.x;
    p.previousY = p.y;
    if (p.cooldown > 0) p.cooldown--;
    const order = p.orders[0];
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
    p.targetId = target.id;
    const distance = Math.abs(target.x - p.x) + Math.abs(target.y - p.y);
    const ranged = p.role === "gunner";
    if (distance <= (ranged ? 5 : 1.15) && Math.abs(target.y - p.y) < 0.6) {
      this.searches.delete(p.id);
      p.path.length = 0;
      p.status = ranged ? "Firing pistol" : "Fighting";
      if (p.cooldown === 0) {
        const damage = p.damage + Math.floor(random(this.state) * 4);
        target.hp = Math.max(0, target.hp - damage);
        p.cooldown = ranged ? 22 : 15;
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
      for (const p of s.pirates) p.status = "Under sail";
      if (--s.travelTicks <= 0) this.arrive();
    } else {
      for (const p of s.pirates) this.updatePirate(p);
      if (s.phase === "encounter") {
        const captain = s.pirates.find(
          (p) => p.role === "captain" && p.side === "ally",
        );
        if (!captain || captain.hp <= 0 || s.ships[0].hp <= 0) {
          s.phase = "gameover";
          this.commands.length = 0;
          notify(s, "Your captain has fallen. A checkpoint awaits.", "bad");
        } else if (!s.pirates.some((p) => p.side === "enemy" && p.hp > 0))
          this.resolve();
      }
    }
    // Needs are simulation-time based. Port menus do not starve the crew.
    if (s.phase === "encounter" && s.tick % 100 === 0)
      for (const p of s.pirates)
        if (p.side === "ally" && p.hp > 0) {
          p.hunger = Math.max(0, p.hunger - 2);
          if (p.hunger < 60 && s.food > 0) {
            s.food--;
            p.hunger = Math.min(100, p.hunger + 35);
            p.status = "Eating provisions";
          }
          if (p.hunger === 0) {
            p.hp = Math.max(0, p.hp - 2);
            p.morale = Math.max(0, p.morale - 2);
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
      s.phase = "victory";
      s.resolved = true;
      node.cleared = true;
      s.reward = 80 + node.danger * 30;
      this.awardGold(s.reward);
      this.awardStock("food", 5);
      this.awardStock("parts", 4);
      notify(
        s,
        `Treasure found on ${node.name}: ${s.reward} gold, 5 provisions, 4 timber.`,
        "good",
      );
    } else {
      s.phase = "encounter";
      const ship = starterShip(2, true);
      ship.name = node.name;
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
  private resolve() {
    const s = this.state;
    if (s.resolved) return;
    s.resolved = true;
    const node = s.world.find((n) => n.id === s.location)!;
    node.cleared = true;
    s.reward = 100 + node.danger * 65;
    this.awardGold(s.reward);
    this.awardStock("parts", 6);
    this.awardStock("ammo", 3);
    for (const p of s.pirates)
      if (p.side === "ally" && p.hp > 0) {
        p.xp += 30;
        p.morale = Math.min(100, p.morale + 12);
        if (p.xp >= p.level * 30) {
          p.level++;
          p.damage += 2;
          p.maxHp += 8;
          p.hp = Math.min(p.maxHp, p.hp + 20);
        }
      }
    this.cleanup();
    s.phase = node.kind === "boss" ? "won" : "victory";
    notify(
      s,
      `Victory! ${s.reward} gold, 6 timber and 3 cannonballs recovered.`,
      "good",
    );
  }
  cleanup() {
    if (this.disposed) return;
    this.commands.length = 0;
    this.searches.clear();
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
    if (this.disposed || this.state.phase !== "encounter") return false;
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
    if (s.phase !== "encounter") {
      notify(s, "Cannons can fire during a ship encounter.", "bad");
      return false;
    }
    if (!s.ammo) {
      notify(s, "No cannonballs left.", "bad");
      return false;
    }
    const gunner = s.pirates.find(
      (p) =>
        p.side === "ally" && p.hp > 0 && p.shipId === 1 && p.cooldown === 0,
    );
    if (!gunner || !s.ships[0].stations.some((t) => t.kind === "cannon")) {
      notify(s, "A ready crew member must remain aboard to fire.", "bad");
      return false;
    }
    s.ammo--;
    gunner.cooldown = 40;
    gunner.status = "Loading cannon";
    const enemies = s.pirates.filter((p) => p.side === "enemy" && p.hp > 0);
    const target = enemies[Math.floor(random(s) * enemies.length)];
    if (target) {
      target.hp = Math.max(0, target.hp - 32);
      if (!target.hp) this.clearOrder(target);
    }
    notify(s, "Broadside! A cannonball strikes the enemy deck.", "good");
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
    for (const p of s.pirates) {
      p.hp = p.maxHp;
      p.hunger = 100;
      p.morale = 100;
      p.status = "Rested";
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
  edit(tiles: Tile[]) {
    if (this.disposed) return "Voyage closed.";
    const s = this.state;
    if (s.phase !== "port") return "Build only in port.";
    const ship = s.ships[0];
    const error = validateLayout(ship, tiles);
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
  }
}
