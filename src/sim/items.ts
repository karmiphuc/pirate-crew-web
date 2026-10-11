import type { Pirate, WorldNode } from "./model";
import { POINTS_PER_LEVEL, POINT_CAP } from "./progression";

// Original balance for the browser game's 0..100 needs, not reference formulas.
export const ITEMS = {
  rum: { name: "Bottle of rum", price: 12, effect: "morale", amount: 35 },
  elixir: { name: "Elixir", price: 18, effect: "health", amount: 0.2 },
  boneMeal: { name: "Bone meal", price: 12, effect: "hunger", amount: 50 },
  feather: { name: "Feather", price: 30, effect: "experience", amount: 100 },
  sabre: { name: "Steel sabre", price: 60, effect: "equipment", amount: 0 },
  pistol: { name: "Flintlock", price: 85, effect: "equipment", amount: 0 },
  boots: {
    name: "Boots of Mobility",
    price: 65,
    effect: "equipment",
    amount: 0,
  },
  diaper: { name: "Diaper", price: 40, effect: "equipment", amount: 0 },
} as const;
export type ItemKind = keyof typeof ITEMS;
export type Accessory = "boots" | "diaper";
export const ACCESSORY_KINDS = ["boots", "diaper"] as const;
export type ItemStock = Record<ItemKind, number>;
export const ITEM_KINDS = Object.keys(ITEMS) as ItemKind[];
export const ITEM_STOCK_CAP = 99;
export function emptyItemStock(): ItemStock {
  return {
    rum: 0,
    elixir: 0,
    boneMeal: 0,
    feather: 0,
    sabre: 0,
    pistol: 0,
    boots: 0,
    diaper: 0,
  };
}
export function itemDescription(kind: ItemKind) {
  if (kind === "boots") return "Walk and climb 25% faster";
  if (kind === "diaper") return "This pirate adds no dirt to the home deck";
  const item = ITEMS[kind];
  switch (item.effect) {
    case "health":
      return "Restore 20% of maximum health";
    case "morale":
      return "Restore 35 morale";
    case "hunger":
      return "Restore 50 hunger";
    case "experience":
      return "Gain 100 experience";
    case "equipment":
      return "Equip from the hold in port";
  }
}
export function itemEffectReason(p: Pirate, kind: ItemKind): string | null {
  const effect = ITEMS[kind].effect;
  if (effect === "equipment")
    return "Use Duties & equipment to equip this item in port.";
  if (effect === "health" && p.hp >= p.maxHp) return "Health is already full.";
  if (effect === "morale" && p.morale >= 100) return "Morale is already full.";
  if (effect === "hunger" && p.hunger >= 100) return "Hunger is already full.";
  if (effect === "experience" && p.level >= 100)
    return "This pirate is already at the level limit.";
  return null;
}
export function awardExperience(p: Pirate, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0 || p.level >= 100) return;
  p.xp = Math.min(
    1_000_000_000,
    p.xp + Math.floor((amount * (100 + p.attributes.int)) / 100),
  );
  while (p.level < 100 && p.xp >= p.level * 30) {
    p.level++;
    p.trainingPoints = Math.min(POINT_CAP, p.trainingPoints + POINTS_PER_LEVEL);
    p.damage = Math.min(1000, p.damage + 2);
    p.maxHp = Math.min(1000, p.maxHp + 8);
    p.hp = Math.min(p.maxHp, p.hp + 20);
  }
}
/** At most four items. A local seed avoids changing combat/travel RNG or save reloads. */
export function encounterLoot(
  node: Pick<WorldNode, "seed" | "danger" | "kind">,
): ItemStock {
  const stock = emptyItemStock();
  let seed = (node.seed ^ Math.imul(node.danger + 1, 0x9e3779b9)) >>> 0 || 1;
  for (let i = 0; i < 2 + Math.min(2, node.danger); i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const kind = ITEM_KINDS[(seed >>> 0) % 4];
    stock[kind]++;
  }
  if (node.kind !== "island" && node.danger >= 2) {
    // Replace one consumable with a weapon; preserve the four-item cap.
    const kind = ITEM_KINDS.find((k) => stock[k] > 0)!;
    stock[kind]--;
    stock[(seed >>> 0) % 2 === 0 ? "sabre" : "pistol"]++;
  }
  if (node.danger >= 2 && (seed >>> 0) % 3 === 0) {
    const kind = ITEM_KINDS.find(
      (k) => stock[k] > 0 && ITEMS[k].effect !== "equipment",
    )!;
    stock[kind]--;
    stock[(seed >>> 0) % 2 === 0 ? "boots" : "diaper"]++;
  }
  return stock;
}
