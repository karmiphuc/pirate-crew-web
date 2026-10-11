import type { Campaign, Pirate, Weapon } from "./model";
import { WEAPONS } from "./model";

export const ATTRIBUTE_KEYS = [
  "str",
  "vit",
  "int",
  "dex",
  "agi",
  "luck",
] as const;
export type Attribute = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<Attribute, number>;
export const ATTRIBUTE_CAP = 100;
export const POINTS_PER_LEVEL = 4;
export const POINT_CAP = 400;
// Category names follow the reference; these are authored, provisional formulas.
export const ATTRIBUTE_INFO = {
  str: { name: "Strength", effect: "+1 melee damage per point" },
  vit: { name: "Vitality", effect: "+4 maximum health per point, up to 1,000" },
  int: { name: "Intelligence", effect: "+1% earned experience per point" },
  dex: { name: "Dexterity", effect: "+1 ranged damage per point" },
  agi: { name: "Agility", effect: "+1% attack rate per point" },
  luck: {
    name: "Luck",
    effect: "+0.5% chance of a 1.5× critical hit per point",
  },
} as const;
export function emptyAttributes(): Attributes {
  return { str: 0, vit: 0, int: 0, dex: 0, agi: 0, luck: 0 };
}
export function attackDamage(p: Pirate, weapon: Weapon) {
  const stat = weapon === "pistol" ? p.attributes.dex : p.attributes.str;
  return (
    p.damage +
    WEAPONS[weapon].bonus +
    stat +
    Math.max(0, p.skillRanks.guard - 1)
  );
}
export function attackCooldown(p: Pirate, weapon: Weapon) {
  return Math.ceil((WEAPONS[weapon].cooldown * 100) / (100 + p.attributes.agi));
}
export const CREW_GROUPS = [1, 2, 3, 4] as const;
export type CrewGroup = (typeof CREW_GROUPS)[number];
export function groupMembers(s: Campaign, group: CrewGroup): number[] {
  return s.pirates
    .filter((p) => p.side === "ally" && p.hp > 0 && p.group === group)
    .map((p) => p.id);
}
