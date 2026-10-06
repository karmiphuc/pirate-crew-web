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
  | "victory"
  | "gameover"
  | "won";
export type TileKind = "hull" | "ladder";
export interface Tile {
  x: number;
  y: number;
  kind: TileKind;
}
export interface Station {
  x: number;
  y: number;
  kind: "cannon" | "food" | "medical";
}
export interface Ship {
  id: number;
  name: string;
  tiles: Tile[];
  stations: Station[];
  hp: number;
  maxHp: number;
  revision: number;
}
export type Action = "move" | "attack" | "board" | "retreat";
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
  schemaVersion: 1;
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
  ammo: number;
  medicine: number;
  parts: number;
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
  for (let x = 6; x < 11; x++) tiles.push({ x, y: 1, kind: "hull" });
  for (let y = 1; y <= 3; y++) tiles.push({ x: 5, y, kind: "ladder" });
  return {
    id,
    name: enemy ? "The Crooked Cutlass" : "The Wayward Gull",
    tiles,
    stations: [
      { x: 14, y: 3, kind: "cannon" },
      { x: 3, y: 3, kind: "food" },
      { x: 8, y: 3, kind: "medical" },
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
  const world: WorldNode[] = [
    {
      id: 0,
      x: 17,
      y: 62,
      name: "Saltwater Harbour",
      kind: "port",
      danger: 0,
      cleared: false,
      seed,
    },
    {
      id: 1,
      x: 35,
      y: 49,
      name: "The Crooked Cutlass",
      kind: "pirate",
      danger: 1,
      cleared: false,
      seed: seed + 1,
    },
    {
      id: 2,
      x: 44,
      y: 76,
      name: "Castaway Cay",
      kind: "island",
      danger: 1,
      cleared: false,
      seed: seed + 2,
    },
    {
      id: 3,
      x: 60,
      y: 40,
      name: "Ratbeard’s Revenge",
      kind: "pirate",
      danger: 2,
      cleared: false,
      seed: seed + 3,
    },
    {
      id: 4,
      x: 69,
      y: 72,
      name: "Whispering Shoals",
      kind: "island",
      danger: 2,
      cleared: false,
      seed: seed + 4,
    },
    {
      id: 5,
      x: 76,
      y: 24,
      name: "The Scarlet Fleet",
      kind: "pirate",
      danger: 3,
      cleared: false,
      seed: seed + 5,
    },
    {
      id: 6,
      x: 88,
      y: 53,
      name: "Admiral Blackthorn",
      kind: "boss",
      danger: 4,
      cleared: false,
      seed: seed + 6,
    },
  ];
  return {
    schemaVersion: 1,
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
    ammo: 12,
    medicine: 5,
    parts: 12,
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
