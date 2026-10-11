/** Authored presentation geometry and deterministic tick limits, not original-game formulas. */
export const SHIP_SEPARATION = 32;
export const WATER_Y = 7;
export const SEA_TIMEOUT = 240;
export type SeaMode = "rope" | "fall" | "swim" | "tread" | "rescue" | "climb";
export interface SeaTransit {
  mode: SeaMode;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  startX: number;
  startY: number;
  originShip: number;
  originNode: number;
  targetShip: number;
  targetNode: number;
  targetRevision: number;
  ticks: number;
  progress: number;
  rescuerId: number | null;
}
export function seaX(shipId: number, localX: number) {
  return localX + (shipId === 1 ? 0 : SHIP_SEPARATION);
}
export function inWater(transit: Readonly<SeaTransit> | undefined) {
  return (
    !!transit &&
    transit.mode !== "rope" &&
    transit.mode !== "fall" &&
    transit.mode !== "climb"
  );
}
