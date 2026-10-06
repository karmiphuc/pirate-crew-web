import { LIMITS, Ship, Tile, tileNode, nodeX, nodeY } from "./model";
export class Navigation {
  readonly nodes = new Map<number, number[]>();
  private readonly components = new Map<number, number>();
  constructor(readonly ship: Ship) {
    const solid = new Set<number>();
    const ladders = new Set<number>();
    for (const t of ship.tiles)
      (t.kind === "hull" ? solid : ladders).add(tileNode(t.x, t.y));
    for (const t of ship.tiles) {
      if (t.kind === "hull" && t.y > 0 && !solid.has(tileNode(t.x, t.y - 1)))
        this.nodes.set(tileNode(t.x, t.y - 1), []);
      if (t.kind === "ladder" && !solid.has(tileNode(t.x, t.y))) {
        this.nodes.set(tileNode(t.x, t.y), []);
        if (t.y > 0 && !solid.has(tileNode(t.x, t.y - 1)))
          this.nodes.set(tileNode(t.x, t.y - 1), []);
      }
    }
    for (const [n, edges] of this.nodes) {
      const x = nodeX(n),
        y = nodeY(n);
      if (x > 0 && this.nodes.has(n - 1)) edges.push(n - 1);
      if (x < LIMITS.width - 1 && this.nodes.has(n + 1)) edges.push(n + 1);
      if (
        y > 0 &&
        this.nodes.has(n - LIMITS.width) &&
        (ladders.has(n) || ladders.has(n - LIMITS.width))
      )
        edges.push(n - LIMITS.width);
      if (
        y < LIMITS.height - 1 &&
        this.nodes.has(n + LIMITS.width) &&
        (ladders.has(n) || ladders.has(n + LIMITS.width))
      )
        edges.push(n + LIMITS.width);
    }
    // Component labels belong to this graph; work-site selection needs no new BFS.
    const queue: number[] = [];
    for (const start of this.nodes.keys()) {
      if (this.components.has(start)) continue;
      queue.length = 0;
      queue.push(start);
      this.components.set(start, start);
      for (let i = 0; i < queue.length; i++) {
        for (const edge of this.nodes.get(queue[i]) ?? []) {
          if (!this.components.has(edge)) {
            this.components.set(edge, start);
            queue.push(edge);
          }
        }
      }
    }
  }
  nearestReachable(x: number, y: number, start: number) {
    const component = this.components.get(start);
    if (component === undefined) return -1;
    let nearest = -1,
      distance = Infinity;
    for (const [n, label] of this.components) {
      if (label !== component) continue;
      const d = Math.abs(nodeX(n) - x) + Math.abs(nodeY(n) - y);
      if (d < distance) {
        nearest = n;
        distance = d;
      }
    }
    return nearest;
  }
  nearest(x: number, y: number) {
    let result = -1,
      distance = Infinity;
    for (const n of this.nodes.keys()) {
      const d = Math.abs(nodeX(n) - x) + Math.abs(nodeY(n) - y);
      if (d < distance) {
        distance = d;
        result = n;
      }
    }
    return result;
  }
}
export class Search {
  private queue = new Int32Array(LIMITS.width * LIMITS.height);
  private parents = new Int32Array(LIMITS.width * LIMITS.height).fill(-2);
  private head = 0;
  private tail = 1;
  done = false;
  path: number[] | null = null;
  constructor(
    readonly graph: Navigation,
    readonly start: number,
    readonly goal: number,
  ) {
    this.queue[0] = start;
    this.parents[start] = -1;
    if (!graph.nodes.has(start) || !graph.nodes.has(goal)) this.done = true;
  }
  advance(budget: number): number {
    let used = 0;
    while (!this.done && this.head < this.tail && used < budget) {
      const n = this.queue[this.head++];
      used++;
      if (n === this.goal) {
        const path = [];
        let p = n;
        while (p !== this.start) {
          path.push(p);
          p = this.parents[p];
        }
        this.path = path.reverse();
        this.done = true;
        break;
      }
      for (const edge of this.graph.nodes.get(n) ?? [])
        if (this.parents[edge] === -2) {
          this.parents[edge] = n;
          this.queue[this.tail++] = edge;
        }
    }
    if (this.head === this.tail) this.done = true;
    return used;
  }
}
export function validateLayout(ship: Ship, tiles: Tile[]): string | null {
  if (tiles.length === 0 || tiles.length > LIMITS.width * LIMITS.height)
    return "A ship needs a connected hull.";
  const occupied = new Set<number>();
  for (const t of tiles) {
    if (
      !Number.isInteger(t.x) ||
      !Number.isInteger(t.y) ||
      t.x < 0 ||
      t.x >= LIMITS.width ||
      t.y < 1 ||
      t.y >= LIMITS.height ||
      !["hull", "ladder"].includes(t.kind)
    )
      return "Part lies outside the ship grid.";
    const n = tileNode(t.x, t.y);
    if (occupied.has(n)) return "Parts cannot overlap.";
    occupied.add(n);
  }
  const hull = tiles.filter((t) => t.kind === "hull");
  if (!hull.length) return "A ship needs a hull.";
  const visited = new Set<number>();
  const queue = [tileNode(hull[0].x, hull[0].y)];
  visited.add(queue[0]);
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    const x = nodeX(n);
    const edges = [n - LIMITS.width, n + LIMITS.width];
    if (x > 0) edges.push(n - 1);
    if (x < LIMITS.width - 1) edges.push(n + 1);
    for (const edge of edges)
      if (occupied.has(edge) && !visited.has(edge)) {
        visited.add(edge);
        queue.push(edge);
      }
  }
  if (visited.size !== occupied.size) return "Connect every part to the hull.";
  const graph = new Navigation({ ...ship, tiles });
  const base = graph.nearest(3, 3);
  for (const station of ship.stations) {
    const target = tileNode(station.x, station.y);
    const search = new Search(graph, base, target);
    search.advance(LIMITS.width * LIMITS.height);
    if (!search.path)
      return `The ${station.kind} station needs a reachable deck.`;
  }
  return null;
}
