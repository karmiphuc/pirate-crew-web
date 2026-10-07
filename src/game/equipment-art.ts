import type { Weapon } from "../sim/model";

export const WEAPON_FRAMES: readonly Weapon[] = ["cutlass", "sabre", "pistol"];

/** Full character-frame coordinates let an independent item layer follow either facing. */
export function paintWeapon(ctx: CanvasRenderingContext2D, weapon: Weapon) {
  const pixel = (color: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const ink = "#353341",
    gold = "#e2bc73",
    steel = "#b8c9c5",
    light = "#f5e7bd";
  if (weapon === "pistol") {
    pixel(ink, 24, 28, 8, 3);
    pixel(steel, 25, 28, 5);
    pixel(ink, 25, 31, 3, 3);
    pixel("#956e4a", 25, 31, 2, 2);
    pixel(gold, 27, 30, 2);
  } else if (weapon === "sabre") {
    // Long straight polished blade and a swept brass guard distinguish the upgrade.
    pixel(ink, 27, 19, 3, 12);
    pixel(ink, 28, 17, 2, 2);
    pixel(steel, 28, 19, 1, 11);
    pixel(light, 29, 18, 1, 12);
    pixel(gold, 24, 31, 7);
    pixel(gold, 24, 32, 1, 3);
    pixel(gold, 25, 34, 4);
    pixel("#956e4a", 27, 32, 2, 2);
  } else {
    pixel(ink, 26, 27, 2, 4);
    pixel(ink, 27, 24, 2, 4);
    pixel(ink, 28, 22, 2, 3);
    pixel(steel, 27, 28, 1, 3);
    pixel(light, 28, 25, 1, 3);
    pixel(light, 29, 22, 1, 3);
    pixel(gold, 24, 31, 6);
    pixel("#956e4a", 26, 32, 2, 2);
  }
}
