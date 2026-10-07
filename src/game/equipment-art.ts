import type { Weapon } from "../sim/model";
import { PIRATE_HEIGHT } from "./pirate-art";
export const WEAPON_WIDTH = 96;
export const WEAPON_FRAMES: readonly Weapon[] = ["cutlass", "sabre", "pistol"];
export const WEAPON_POSES = ["idle", "ready", "attack"] as const;
export type WeaponPose = (typeof WEAPON_POSES)[number];
export const WEAPON_ANIMATIONS = {
  cutlass: {
    idle: "cutlass",
    ready: "cutlass-ready",
    attack: "cutlass-attack",
  },
  sabre: { idle: "sabre", ready: "sabre-ready", attack: "sabre-attack" },
  pistol: { idle: "pistol", ready: "pistol-ready", attack: "pistol-attack" },
} as const;
/** Pixel clusters shape steel, brass and walnut; equipment always remains independent of bodies. */
export function paintWeapon(
  ctx: CanvasRenderingContext2D,
  weapon: Weapon,
  pose: WeaponPose = "idle",
) {
  const px = (color: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const ink = "#192333",
    steel = "#a5b7b9",
    shade = "#607c8a",
    glint = "#e9ecd5",
    gold = "#ddb565",
    brass = "#9b713c",
    wood = "#815035",
    woodLight = "#b57646";
  const x = pose === "attack" ? 64 : 60,
    y = pose === "attack" ? 36 : pose === "ready" ? 34 : 38;
  if (weapon === "pistol") {
    // A dark steel barrel, stepped walnut stock, brass muzzle and curved grip.
    px(ink, x - 3, y - 5, 15, 5);
    px(shade, x + 1, y - 4, 8, 3);
    px(steel, x + 2, y - 4, 6);
    px(gold, x + 9, y - 4, 2, 3);
    px(brass, x + 9, y - 2, 2);
    px(ink, x + 11, y - 3, 1, 2);
    px(wood, x - 2, y - 3, 6, 4);
    px(woodLight, x - 1, y - 3, 4);
    px(ink, x - 1, y + 1, 4, 4);
    px(wood, x, y + 1, 2, 3);
    px(woodLight, x, y + 1);
    px(brass, x + 4, y, 3, 2);
    px(gold, x + 5, y);
    px(ink, x + 3, y - 7, 2, 2);
    px(steel, x + 3, y - 7);
    px(brass, x + 2, y - 5, 2);
    return;
  }
  if (pose === "attack") {
    const length = weapon === "cutlass" ? 18 : 21;
    px(ink, x + 3, y - 5, length - 2, 5);
    px(shade, x + 4, y - 4, length - 4, 3);
    px(steel, x + 4, y - 4, length - 4);
    px(glint, x + 5, y - 3, 5);
    px(glint, x + 13, y - 3, 5);
    if (weapon === "cutlass") {
      px(ink, x + length - 2, y - 8, 5, 4);
      px(shade, x + length - 1, y - 7, 3, 3);
      px(steel, x + length, y - 7, 2, 2);
      px(glint, x + length + 1, y - 8);
    } else {
      px(ink, x + length, y - 5, 3, 3);
      px(steel, x + length, y - 4, 2);
      px(glint, x + length + 2, y - 5);
    }
    px(brass, x + 1, y - 6, 2, 9);
    px(gold, x + 1, y - 5, 1, 7);
    px(ink, x - 3, y - 1, 5, 4);
    px(wood, x - 2, y, 4, 2);
    px(gold, x - 3, y, 1, 2);
  } else {
    if (weapon === "cutlass") {
      // A compact, broad blade with a gentle flare; its tip stays below the hat.
      px(ink, x + 3, y - 9, 5, 8);
      px(ink, x + 4, y - 16, 6, 8);
      px(ink, x + 6, y - 20, 6, 5);
      px(ink, x + 9, y - 23, 3, 4);
      px(shade, x + 4, y - 8, 3, 6);
      px(shade, x + 5, y - 15, 4, 7);
      px(shade, x + 7, y - 19, 4, 5);
      px(steel, x + 6, y - 8, 1, 6);
      px(steel, x + 8, y - 15, 1, 7);
      px(steel, x + 10, y - 19, 1, 5);
      px(steel, x + 10, y - 22, 1, 3);
      px(glint, x + 8, y - 13, 1, 3);
      px(glint, x + 10, y - 18, 1, 2);
    } else {
      // A slimmer sabre with a swept point, selective glints and basket guard.
      px(ink, x + 3, y - 18, 4, 16);
      px(ink, x + 4, y - 22, 4, 5);
      px(shade, x + 4, y - 17, 2, 14);
      px(steel, x + 5, y - 17, 1, 14);
      px(steel, x + 5, y - 21, 2, 4);
      px(glint, x + 6, y - 20, 1, 3);
      px(glint, x + 5, y - 10, 1, 3);
    }
    px(ink, x - 4, y - 2, 12, 3);
    px(brass, x - 3, y - 1, 10);
    px(gold, x - 2, y - 2, 9);
    px(ink, x, y, 4, 5);
    px(wood, x + 1, y + 1, 2, 3);
    px(woodLight, x + 1, y + 1);
    px(gold, x, y + 4, 4);
    if (weapon === "sabre") {
      px(brass, x - 3, y, 1, 5);
      px(gold, x - 2, y, 1, 4);
      px(gold, x - 1, y + 4, 4);
    }
  }
}
export const WEAPON_ATLAS_HEIGHT = PIRATE_HEIGHT * WEAPON_POSES.length;
