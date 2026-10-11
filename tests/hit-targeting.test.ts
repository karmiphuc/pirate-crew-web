import { expect, it } from "vitest";
import { hitPirate } from "../src/game/pirate-hit-test";

const body = (x = 300, y = 400, order = 1) => ({
  x,
  y,
  visible: true,
  active: true,
  isCropped: false,
  order,
});
const order = (b: ReturnType<typeof body>) => b.order;

it("selects the frontmost drawn living body even after a recreated actor changes display order", () => {
  const pirates = [
    { id: 3, hp: 90 },
    { id: 4, hp: 90 },
    { id: 5, hp: 0 },
  ];
  const bodies = new Map([
    [3, body(300, 400, 10)],
    [4, body(300, 400, 2)],
    [5, body(300, 400, 20)],
  ]);
  expect(hitPirate(pirates, bodies, 300, 370, order)).toBe(3);
  bodies.delete(3);
  expect(hitPirate(pirates, bodies, 300, 370, order)).toBe(4);
  bodies.get(4)!.visible = false;
  expect(hitPirate(pirates, bodies, 300, 370, order)).toBeNull();
});

it("follows interpolated or lifted rendered positions and excludes the submerged invisible lower body", () => {
  const pirates = [{ id: 3, hp: 90 }],
    b = body(720, 410),
    bodies = new Map([[3, b]]);
  expect(hitPirate(pirates, bodies, 720, 380, order)).toBe(3);
  expect(hitPirate(pirates, bodies, 300, 380, order)).toBeNull();
  b.y = 390;
  expect(hitPirate(pirates, bodies, 720, 335, order)).toBe(3);
  b.isCropped = true;
  expect(hitPirate(pirates, bodies, 720, 350, order)).toBe(3);
  expect(hitPirate(pirates, bodies, 720, 380, order)).toBeNull();
  b.active = false;
  expect(hitPirate(pirates, bodies, 720, 350, order)).toBeNull();
});
