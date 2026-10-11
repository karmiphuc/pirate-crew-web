import type { Pirate } from "../sim/model";

interface Body {
  x: number;
  y: number;
  visible: boolean;
  active: boolean;
  isCropped?: boolean;
}

// Native 40 × 56 bodies, with the scene's 34-pixel swimming crop.
// Input follows the rendered position, including interpolation and jump lift.
// No candidate array or bounds objects; at most 24 existing actor views.
export function hitPirate<T extends Body>(
  pirates: readonly Pick<Pirate, "id" | "hp">[],
  bodies: ReadonlyMap<number, T>,
  x: number,
  y: number,
  drawIndex: (body: T) => number,
): number | null {
  let hit: number | null = null,
    front = -1;
  for (const p of pirates) {
    const body = bodies.get(p.id);
    if (p.hp <= 0 || !body?.visible || !body.active) continue;
    const bottom = body.y + (body.isCropped ? -18 : 8);
    if (Math.abs(x - body.x) >= 22 || y <= body.y - 60 || y >= bottom) continue;
    const index = drawIndex(body);
    if (index > front) {
      front = index;
      hit = p.id;
    }
  }
  return hit;
}
