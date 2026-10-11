/** Presentation-only grip centres, in native body pixels; never part of a save. */
export const HAND_ANCHORS = [
  [32, 39],
  [32, 38],
  [30, 38],
  [30, 38],
  [33, 38],
  [31, 38],
] as const;
export const HAND_POSES = {
  idle: HAND_ANCHORS,
  ready: [
    [33, 32],
    [33, 32],
    [31, 32],
    [31, 32],
    [34, 32],
    [32, 32],
  ],
  attack: [
    [37, 35],
    [37, 35],
    [35, 35],
    [35, 35],
    [38, 35],
    [36, 35],
  ],
  aim: [
    [36, 34],
    [36, 34],
    [34, 34],
    [34, 34],
    [37, 34],
    [35, 34],
  ],
  fire: [
    [35, 33],
    [35, 33],
    [33, 33],
    [33, 33],
    [36, 33],
    [34, 33],
  ],
} as const;
export type HandPose = keyof typeof HAND_POSES;
/** Equipment is authored around the captain's grip; every other character applies an offset. */
export const WEAPON_GRIPS = {
  idle: [60, 39],
  ready: [61, 32],
  attack: [65, 35],
  aim: [64, 34],
  fire: [63, 33],
} as const;
