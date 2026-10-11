import { WEAPONS, type Pirate, type Ship, type Weapon } from "./model";

/** Two carried slots, one shared attack cooldown. No reset on a weapon change. */
export function weaponForTarget(p: Pirate, distance: number): Weapon {
  if (p.meleeWeapon && distance <= WEAPONS[p.meleeWeapon].range)
    return p.meleeWeapon;
  return p.rangedWeapon ?? p.meleeWeapon!;
}

/** Hull cells block a chest-height shot. Decorative rear cabin walls do not. */
export function clearShot(ship: Ship, from: Pirate, to: Pirate) {
  const x = from.x + 0.5,
    y = from.y + 0.25,
    dx = to.x - from.x,
    dy = to.y - from.y;
  for (const tile of ship.tiles) {
    if (tile.kind !== "hull" || (tile.damage ?? 0) >= 100) continue;
    let enter = 0,
      leave = 1;
    if (Math.abs(dx) < 0.000001) {
      if (x < tile.x || x >= tile.x + 1) continue;
    } else {
      const a = (tile.x - x) / dx,
        b = (tile.x + 1 - x) / dx;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
    }
    if (Math.abs(dy) < 0.000001) {
      if (y < tile.y || y >= tile.y + 1) continue;
    } else {
      const a = (tile.y - y) / dy,
        b = (tile.y + 1 - y) / dy;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
    }
    if (enter < leave && leave > 0 && enter < 1) return false;
  }
  return true;
}
