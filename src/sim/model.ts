import { emptyItemStock, type ItemStock, type Accessory } from "./items";
import { generateWorld } from "./world";

export const LIMITS = {
  allies: 12,
  enemies: 12,
  width: 64,
  height: 24,
  commands: 64,
  orders: 8,
  notices: 64,
  nodes: 64,
  importBytes: 2 * 1024 * 1024,
} as const;
export type Phase =
  | "port"
  | "travel"
  | "encounter"
  | "aftermath"
  | "victory"
  | "gameover"
  | "won";
export type TileKind = "hull" | "ladder";
export interface Tile {
  x: number;
  y: number;
  kind: TileKind;
  /** Local plank damage, 0..100. At 100 the blueprint slot is a destroyed plank. */
  damage?: number;
}
export interface Station {
  x: number;
  y: number;
  kind: "cannon" | "food" | "medical";
}
export const DUTIES = [
  "guard",
  "cook",
  "clean",
  "repair",
  "medic",
  "gunner",
  "fish",
] as const;
export type Duty = (typeof DUTIES)[number];
export const SKILLS = [...DUTIES, "swim"] as const;
export type Skill = (typeof SKILLS)[number];
export const DUTY_NAMES: Record<Duty, string> = {
  guard: "Boarding party",
  cook: "Cook",
  clean: "Deck cleaner",
  repair: "Shipwright",
  medic: "Doctor",
  gunner: "Cannoneer",
  fish: "Fisher",
};
export const TRAITS = {
  swift: { name: "Swift", description: "Moves 20% faster." },
  industrious: { name: "Industrious", description: "Works 25% faster." },
  hearty: {
    name: "Hearty",
    description: "Uses half as much food between meals.",
  },
  gourmand: {
    name: "Gourmand",
    description: "Uses 50% more food between meals.",
  },
} as const;
export type Trait = keyof typeof TRAITS;
export function recruitTrait(index: number): Trait {
  return (["swift", "industrious", "hearty", "gourmand"] as const)[
    Math.max(0, index - 3) % 4
  ];
}
export const WEAPONS = {
  cutlass: { name: "Cutlass", price: 0, bonus: 0, range: 1.15, cooldown: 15 },
  sabre: {
    name: "Steel sabre",
    price: 60,
    bonus: 5,
    range: 1.15,
    cooldown: 13,
  },
  pistol: { name: "Flintlock", price: 85, bonus: 0, range: 5, cooldown: 22 },
} as const;
export type Weapon = keyof typeof WEAPONS;
export const FURNISHINGS = {
  bunk: { name: "Cabin bunk", price: 35, width: 2 },
  table: { name: "Mess table", price: 25, width: 2 },
  lantern: { name: "Brass lantern", price: 15, width: 1 },
} as const;
export type FurnitureKind = keyof typeof FURNISHINGS;
export const FURNITURE_KINDS = ["bunk", "table", "lantern"] as const;
export const FURNITURE_PLACED_CAP = 32;
export const FURNITURE_STOCK_CAP = 64;
export interface Furniture {
  x: number;
  y: number;
  kind: FurnitureKind;
}
export type FurnitureStock = Record<FurnitureKind, number>;
export interface Ship {
  id: number;
  name: string;
  kind: "ship" | "island";
  dirt: number;
  cannonCooldown: number;
  tiles: Tile[];
  stations: Station[];
  furnishings: Furniture[];
  hp: number;
  maxHp: number;
  revision: number;
}
export type Action =
  | "move"
  | "attack"
  | "board"
  | "retreat"
  | "collect"
  | "cannon"
  | "rescue";
export interface Order {
  action: Action;
  shipId?: number;
  node?: number;
  targetId?: number;
}
export interface Pirate {
  id: number;
  name: string;
  role: "captain" | "boarder" | "gunner" | "medic";
  duty: Duty;
  skills: Skill[];
  traits: Trait[];
  weapon: Weapon;
  meleeWeapon: Exclude<Weapon, "pistol"> | null;
  rangedWeapon: "pistol" | null;
  accessory: Accessory | null;
  ownedAccessories: Accessory[];
  ownedWeapons: Weapon[];
  armor: number;
  side: "ally" | "enemy";
  shipId: number;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  hp: number;
  maxHp: number;
  hunger: number;
  morale: number;
  level: number;
  xp: number;
  damage: number;
  cooldown: number;
  orders: Order[];
  path: number[];
  pathRevision: number;
  status: string;
  targetId: number | null;
}
export interface WorldNode {
  id: number;
  x: number;
  y: number;
  name: string;
  kind: "port" | "pirate" | "island" | "boss";
  danger: number;
  cleared: boolean;
  seed: number;
}
export interface Notice {
  id: number;
  text: string;
  tone: "info" | "good" | "bad";
}
export interface Campaign {
  schemaVersion: 8;
  campaignId: string;
  revision: number;
  tick: number;
  rng: number;
  nextId: number;
  phase: Phase;
  ships: Ship[];
  pirates: Pirate[];
  world: WorldNode[];
  location: number;
  destination: number | null;
  travelTicks: number;
  gold: number;
  food: number;
  meals: number;
  ammo: number;
  medicine: number;
  parts: number;
  furnitureStock: FurnitureStock;
  itemStock: ItemStock;
  notices: Notice[];
  noticeId: number;
  resolved: boolean;
  reward: number;
  tutorial: number;
}
export interface InputCommand {
  ids: number[];
  order: Order;
  queue: boolean;
}
export const NAMES = [
  "Calico Jack",
  "Molly Flint",
  "Barnaby",
  "Red Anne",
  "Old Salt",
  "Pegleg Pete",
  "Bonny",
  "Black Bart",
  "Nell",
  "Sparrow",
  "Hook",
  "Pip",
];
export function tileNode(x: number, y: number) {
  return y * LIMITS.width + x;
}
export function nodeX(n: number) {
  return n % LIMITS.width;
}
export function nodeY(n: number) {
  return Math.floor(n / LIMITS.width);
}
export function random(s: Campaign) {
  let x = s.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}
export function starterShip(id = 1, enemy = false): Ship {
  const tiles: Tile[] = [];
  for (let x = 0; x < 18; x++) tiles.push({ x, y: 4, kind: "hull" });
  for (let x = 2; x < 16; x++) tiles.push({ x, y: 5, kind: "hull" });
  for (let x = 4; x < 14; x++) tiles.push({ x, y: 6, kind: "hull" });
  // Two real cabin roofs, linked by the existing exterior ladder.
  for (let x = 0; x < 11; x++)
    if (x !== 5) tiles.push({ x, y: 1, kind: "hull" });
  for (let y = 1; y <= 3; y++) tiles.push({ x: 5, y, kind: "ladder" });
  return {
    id,
    name: enemy ? "The Crooked Cutlass" : "The Wayward Gull",
    kind: "ship",
    dirt: 0,
    cannonCooldown: 160,
    tiles,
    stations: [
      { x: 14, y: 3, kind: "cannon" },
      { x: 3, y: 3, kind: "food" },
      { x: 8, y: 3, kind: "medical" },
    ],
    furnishings: [
      { x: 0, y: 3, kind: "bunk" },
      { x: 6, y: 3, kind: "table" },
      { x: 9, y: 3, kind: "lantern" },
    ],
    hp: 100,
    maxHp: 100,
    revision: 0,
  };
}
export function makePirate(
  id: number,
  index: number,
  side: "ally" | "enemy" = "ally",
  danger = 1,
): Pirate {
  const x = 3 + index * 2;
  return {
    id,
    name:
      side === "ally"
        ? NAMES[index % NAMES.length]
        : ["Cutlass Carl", "Ratbeard", "Mad Morgan", "The Admiral"][index % 4],
    role:
      index === 0 && side === "ally"
        ? "captain"
        : index === 2
          ? "gunner"
          : "boarder",
    duty:
      side === "ally" && index === 1
        ? "cook"
        : index === 2
          ? "gunner"
          : "guard",
    skills:
      index === 1
        ? ["guard", "cook"]
        : index === 2
          ? ["guard", "gunner"]
          : ["guard"],
    weapon: index === 2 ? "pistol" : "cutlass",
    meleeWeapon: "cutlass",
    rangedWeapon: index === 2 ? "pistol" : null,
    accessory: null,
    ownedAccessories: [],
    ownedWeapons: index === 2 ? ["cutlass", "pistol"] : ["cutlass"],
    traits: side === "ally" && index >= 3 ? [recruitTrait(index)] : [],
    armor: 0,
    side,
    shipId: side === "ally" ? 1 : 2,
    x,
    y: 3,
    previousX: x,
    previousY: 3,
    hp: side === "ally" ? 90 : 30 + danger * 12,
    maxHp: side === "ally" ? 90 : 30 + danger * 12,
    hunger: 100,
    morale: 100,
    level: 1,
    xp: 0,
    damage: side === "ally" ? 12 : 3 + danger * 2,
    cooldown: 0,
    orders: [],
    path: [],
    pathRevision: 0,
    status: "On deck",
    targetId: null,
  };
}
export function createCampaign(
  seed = 71031,
  campaignId = `voyage-${seed}`,
): Campaign {
  seed = seed >>> 0 || 1;
  const world = generateWorld(seed);
  return {
    schemaVersion: 8,
    campaignId,
    revision: 0,
    tick: 0,
    rng: seed >>> 0 || 1,
    nextId: 6,
    phase: "port",
    ships: [starterShip()],
    pirates: [makePirate(3, 0), makePirate(4, 1), makePirate(5, 2)],
    world,
    location: 0,
    destination: null,
    travelTicks: 0,
    gold: 420,
    food: 18,
    meals: 6,
    ammo: 12,
    medicine: 5,
    parts: 12,
    furnitureStock: { bunk: 0, table: 0, lantern: 0 },
    itemStock: emptyItemStock(),
    notices: [
      {
        id: 1,
        text: "Welcome aboard. Recruit a sailor, stock the hold, then chart a course.",
        tone: "info",
      },
    ],
    noticeId: 1,
    resolved: false,
    reward: 0,
    tutorial: 0,
  };
}
export function notify(
  s: Campaign,
  text: string,
  tone: Notice["tone"] = "info",
) {
  const last = s.notices[s.notices.length - 1];
  if (last?.text === text) return;
  s.notices.push({ id: ++s.noticeId, text, tone });
  if (s.notices.length > LIMITS.notices) s.notices.shift();
}

export function islandTerrain(name: string, seed?: number): Ship {
  const tiles: Tile[] = [];
  const width = seed === undefined ? 21 : 18 + ((seed >>> 0) % 9);
  for (let x = 0; x < width; x++) {
    tiles.push({ x, y: 4, kind: "hull" });
    if (x > 0 && x < width - 1) tiles.push({ x, y: 5, kind: "hull" });
    if (x > 3 && x < width - 4) tiles.push({ x, y: 6, kind: "hull" });
  }
  return {
    id: 2,
    name,
    kind: "island",
    tiles,
    stations: [],
    furnishings: [],
    hp: 100,
    maxHp: 100,
    dirt: 0,
    cannonCooldown: 0,
    revision: 0,
  };
}
